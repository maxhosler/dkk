import { Edge, FramedDAG } from "./dag";
import { Option } from "./result";

type Matrix = [[number,number], [number, number]];
export class Vector
{
	public x: number;
	public y: number;

	constructor(x: number, y: number)
	{
		this.x=x;
		this.y=y;
	}

	static zero(): Vector
	{
		return new Vector(0,0);
	}

	scale(s: number): Vector
	{
		return new Vector(
			this.x * s,
			this.y * s
		);
	}

	add(v: Vector): Vector
	{
		return new Vector(
			this.x + v.x,
			this.y + v.y
		);
	}

	sub(v: Vector): Vector
	{
		return new Vector(
			this.x - v.x,
			this.y - v.y
		);
	}

	rot90(): Vector
	{
		return new Vector(
			-this.y,
			this.x
		);
	}

	rot(d: number): Vector
	{
		return new Vector(
			this.x * Math.cos(d) - this.y * Math.sin(d),
			this.x * Math.sin(d) + this.y * Math.cos(d)
		);
	}

	norm(): number
	{
		return Math.sqrt( 
			this.x * this.x +
			this.y * this.y
		);
	}

	normalized(): Vector
	{
		let n = this.norm();
		if (Math.abs(n) < 0.00000000001) {
			console.warn("Tried to normalize zero vector.")
			return Vector.zero();
		}
		return this.scale(1/n);
	}

	transform(m: Matrix): Vector
	{
		let c1 = new Vector(m[0][0], m[1][0]);
		let c2 = new Vector(m[0][1], m[1][1]);
		return c1.scale(this.x).add( c2.scale(this.y) )
	}

	clone(): Vector
	{
		return new Vector(
			this.x,
			this.y
		);
	}
}

export type EdgeData = {
	start_list_pos: [pos: number, out_of: number],
	end_list_pos:   [pos: number, out_of: number],

	start_vec_override: Option<Vector>,
	end_vec_override:   Option<Vector>,


	middle_rel_coords: Vector
}

export type VertData = {
	position: Vector,
	spread: number
}

export class FramedDAGEmbedding
{
	readonly base_dag: FramedDAG;
	
	vert_data: Array<VertData>;
	edge_data: Array<EdgeData>;

	constructor(dag: FramedDAG)
	{
		this.base_dag = dag.clone();
		this.vert_data = Array.from(
			{length:dag.num_verts()},
			() => ({
				position: Vector.zero(),
				spread: Math.PI / 2
			})
		);
		this.edge_data = Array.from(
			{length:dag.num_edges()},
			() => ({ 
				start_list_pos: [1,1],
				end_list_pos: [1,1],
				start_vec_override: Option.none(),
				end_vec_override: Option.none(),
				middle_rel_coords: new Vector(0.5, 0.0)
			})
		);

		this.default_layout();
	}

	default_layout()
	{
		let edge_mid_heights: {[key:number]:number} = {};
		for(let v = 0; v < this.base_dag.num_verts(); v++)
		{
			let out_edges: number[] = this.base_dag.get_out_edges(v).unwrap();
			for(let i = 0; i < out_edges.length; i++)
			{
				let edge = out_edges[i];
				this.edge_data[edge].start_list_pos = [i, out_edges.length];
				edge_mid_heights[edge] = edge_mid_heights[edge] || 0;
				if(out_edges.length > 1)
					edge_mid_heights[edge] += i / (out_edges.length-1) - 0.5;
			}

			let in_edges: number[] = this.base_dag.get_in_edges(v).unwrap();
			for(let i = 0; i < in_edges.length; i++)
			{
				let edge = in_edges[i];
				this.edge_data[edge].end_list_pos = [i, in_edges.length];
				edge_mid_heights[edge] = edge_mid_heights[edge] || 0;
				if(in_edges.length > 1)
					edge_mid_heights[edge] += i / (in_edges.length-1) - 0.5;
			}
		}
		for(let i = 0; i < this.base_dag.num_edges(); i++)
			this.edge_data[i].middle_rel_coords.y = 
				(edge_mid_heights[i] || 0)/2;

		let depths: {[key: number]: number} = {}
		for(let src of this.base_dag.sources())
			all_depths(this.base_dag, src, 0, depths);

		let depths_arr: [number, number][] = []

		for(let i = 0; i < this.base_dag.num_verts(); i++)
		{
			depths_arr.push([depths[i], i])
		}
		depths_arr.sort(
			(a,b) => {
				if(a[0] < b[0]) { return -1; }
				if(a[0] > b[0]) { return 1; }
				return a[1] - b[1];
			}
		);
		for(let j = 0; j < depths_arr.length; j++)
		{
			let index = depths_arr[j][1];
			let vd = this.vert_data[index];
			vd.position.x = j;
			vd.position.y = 0;
		}
	}

	bake(): BakedDAGEmbedding
	{
		let verts: Vector[] = [];
		let edges: Bezier[] = [];

		for(let x of this.vert_data)
			verts.push(x.position.clone());
		
		for(let i = 0; i < this.base_dag.num_edges(); i++)
		{
			let edge: Edge = this.base_dag.get_edge(i).unwrap();
			let edge_data = this.edge_data[i];

			let start_data = this.vert_data[edge.start];
			let end_data = this.vert_data[edge.end];

			let start_pos = start_data.position;
			let end_pos = end_data.position;
			let delta = end_pos.sub(start_pos);
			
			let tan_len = delta.norm() / 2;

			let spread_percents = spread_percent(edge_data);
			let start_tan = edge_data.start_vec_override.unwrap_or(
				delta.rot(spread_percents[0] * start_data.spread)
			).normalized().scale(tan_len);
			let end_tan = edge_data.end_vec_override.unwrap_or(
				delta.rot(-spread_percents[1] * end_data.spread)
			).normalized().scale(tan_len);

			let cp1 = start_pos.add( start_tan );
			let cp2 = end_pos.sub( end_tan );

			let bez: Bezier = {
				start_point: start_pos,
				end_point: end_pos,
				cp1: cp1,
				cp2: cp2
			};

			edges.push(bez);
		}

		return {
			verts: verts,
			edges: edges
		};
	}
}

function all_depths(
	framed_dag: FramedDAG,
	vert: number,
	vert_depth: number,
	depths: {[key: number]: number})
{
	depths[vert] = Math.min(vert_depth, depths[vert] || Infinity);
	for(let edge of framed_dag.get_out_edges(vert).unwrap())
	{
		let next = framed_dag.get_edge(edge).unwrap().end;
		all_depths(framed_dag, next, vert_depth+1, depths);
	}
}

function spread_percent(
	edge_data: EdgeData
): [start: number, end: number]
{
	let out: [number, number] = [0,0];
	let start_end = [edge_data.start_list_pos, edge_data.end_list_pos];
	for(let i = 0; i < 2; i++)
	{
		if (start_end[i][1] > 1)
			out[i] = start_end[i][0] / (start_end[i][1] - 1) - 0.5; 
	}
	return out;
}

export type Bezier = 
{
	start_point: Vector,
	end_point: Vector,
	
	cp1: Vector,
	cp2: Vector
}

export type BakedDAGEmbedding = 
{
	verts: Vector[],
	edges: Bezier[]
};