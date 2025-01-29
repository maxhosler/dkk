import { FramedDAG } from "./dag";

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
}

export type EdgeData = {
	start_list_pos: [pos: number, out_of: number],
	end_list_pos:   [pos: number, out_of: number],
	middle_rel_coords: Vector
}

export type VertData = {
	position: Vector,
	spread: number
}

export class FramedDAGLayout
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
				middle_rel_coords: new Vector(0.5, 0.0)
			})
		);

		this.default_layout();
	}

	default_layout()
	{
		for(let v = 0; v < this.base_dag.num_verts(); v++)
		{
			let out_edges: number[] = this.base_dag.get_out_edges(v).unwrap();
			for(let i = 0; i < out_edges.length; i++)
			{
				let edge = out_edges[i];
				this.edge_data[edge].start_list_pos = [i, out_edges.length-1];
			}

			let in_edges: number[] = this.base_dag.get_in_edges(v).unwrap();
			for(let i = 0; i < in_edges.length; i++)
			{
				let edge = in_edges[i];
				this.edge_data[edge].end_list_pos = [i, in_edges.length-1];
			}
		}

		let depths: {[key: number]: number} = {}
		for(let src of this.base_dag.sources())
			all_depths(this.base_dag, src, 0, depths);

		let depth_total: {[key: number]: number} = {};
		for(let d of Object.values(depths))
			depth_total[d] = (depth_total[d] || 0) + 1;

		let depth_count: {[key: number]: number} = {};
		for(let i = 0; i < this.base_dag.num_verts(); i++)
		{
			let depth = depths[i];
			let depth_c = depth_count[depth] || 0;
			depth_count[depth] = depth_c + 1;
			let depth_t = depth_total[depth] - 1;

			let vd = this.vert_data[i];
			vd.position.y = depth_c - depth_t/2;
			vd.position.x = depth;
		}
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