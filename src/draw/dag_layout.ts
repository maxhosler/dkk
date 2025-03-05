import { Edge, FramedDAG } from "../math/dag";
import { Option } from "../util/result";
import { Bezier, clamp, Vector2 } from "../util/num";

export type AngleOverrideType = "none" | "absolute" | "relative";
export class AngleOverride
{
	readonly type: AngleOverrideType;
	readonly angle: number;

	constructor(type: AngleOverrideType, angle: number)
	{
		this.type = type;
		this.angle = angle;
	}

	get_vector(
		default_angle: number,
		direction_vec: Vector2
	): Vector2
	{
		if(this.type == "none")
			return direction_vec.rot(default_angle)
		if(this.type == "relative")
			return direction_vec.rot(this.angle)
		if(this.type == "absolute")
			return Vector2.right().rot(this.angle)
		throw new Error("Unhandled branch");
	}

	static none(): AngleOverride
	{
		return new AngleOverride("none", 0);
	}
	static absolute(ang: number): AngleOverride
	{
		return new AngleOverride("absolute", ang);
	}
	static relative(ang: number): AngleOverride
	{
		return new AngleOverride("relative", ang);
	}
}

export type EdgeData = {
	start_list_pos: [pos: number, out_of: number],
	end_list_pos:   [pos: number, out_of: number],

	start_ang_override: AngleOverride,
	end_ang_override:   AngleOverride,
}

export type VertData = {
	position: Vector2,
	spread_out: number,
	spread_in: number
}

export class FramedDAGEmbedding
{
	readonly dag: FramedDAG;
	
	vert_data: Array<VertData>;
	edge_data: Array<EdgeData>;

	constructor(dag: FramedDAG)
	{
		this.dag = dag.clone();
		this.vert_data = Array.from(
			{length:dag.num_verts()},
			() => ({
				position: Vector2.zero(),
				spread_out: Math.PI / 2,
				spread_in: Math.PI / 2
			})
		);
		this.edge_data = Array.from(
			{length:dag.num_edges()},
			() => ({ 
				start_list_pos: [1,1],
				end_list_pos: [1,1],
				start_ang_override: AngleOverride.none(),
				end_ang_override: AngleOverride.none(),
			})
		);

		this.default_layout();
	}

	default_layout()
	{
		this.default_edges();
		this.default_verts();
	}

	default_edges()
	{
		this.edge_data = Array.from(
			{length:this.dag.num_edges()},
			() => ({ 
				start_list_pos: [1,1],
				end_list_pos: [1,1],
				start_ang_override: AngleOverride.none(),
				end_ang_override: AngleOverride.none(),
			})
		);
		let edge_mid_heights: {[key:number]:number} = {};
		for(let v = 0; v < this.dag.num_verts(); v++)
		{
			let out_edges: number[] = this.dag.get_out_edges(v).unwrap();
			for(let i = 0; i < out_edges.length; i++)
			{
				let edge = out_edges[i];
				this.edge_data[edge].start_list_pos = [i, out_edges.length];
				edge_mid_heights[edge] = edge_mid_heights[edge] || 0;
				if(out_edges.length > 1)
					edge_mid_heights[edge] += i / (out_edges.length-1) - 0.5;
			}

			let in_edges: number[] = this.dag.get_in_edges(v).unwrap();
			for(let i = 0; i < in_edges.length; i++)
			{
				let edge = in_edges[i];
				this.edge_data[edge].end_list_pos = [i, in_edges.length];
				edge_mid_heights[edge] = edge_mid_heights[edge] || 0;
				if(in_edges.length > 1)
					edge_mid_heights[edge] += i / (in_edges.length-1) - 0.5;
			}
		}
	}

	default_verts()
	{
		this.vert_data = Array.from(
			{length:this.dag.num_verts()},
			() => ({
				position: Vector2.zero(),
				spread_out: Math.PI / 2,
				spread_in: Math.PI / 2
			})
		);

		let depths_arr: number[] = []

		for(let i = 0; i < this.dag.num_verts(); i++)
		{
			depths_arr.push(i)
		}
		depths_arr.sort(
			(a,b) => {
				if( this.dag.preceeds(a,b))
				{
					return -1;
				}
				else if (this.dag.preceeds(b,a))
				{
					return 1;
				}

				return a-b;

			}
		);
		for(let j = 0; j < depths_arr.length; j++)
		{
			let index = depths_arr[j];
			let vd = this.vert_data[index];
			vd.position = new Vector2(j - (depths_arr.length-1)/2,0);
		}
	}

	bake(): BakedDAGEmbedding
	{
		let verts: Vector2[] = [];
		let edges: Bezier[] = [];

		let vert_in_out: [Vector2,Vector2][] = [];

		for(let x of this.vert_data)
			verts.push(x.position.clone());
		
		for(let i = 0; i < this.dag.num_verts(); i++)
		{
			let before: number[] = [];
			for(let edge of this.dag.get_in_edges(i).unwrap())
			{
				let start = this.dag.get_edge(edge).unwrap().start;
				if(!before.includes(start))
					before.push(start)
			}

			let after: number[] = [];
			for(let edge of this.dag.get_out_edges(i).unwrap())
			{
				let end = this.dag.get_edge(edge).unwrap().end;
				if(!after.includes(end))
					after.push(end)
			}

			let before_avg = Vector2.zero();
			let after_avg = Vector2.zero();

			for(let b of before)
				before_avg = before_avg.add(verts[b].scale(1/before.length))
			for(let a of after)
				after_avg = after_avg.add(verts[a].scale(1/after.length))

			vert_in_out.push(
				[
					verts[i].sub(before_avg).normalized(),
					after_avg.sub(verts[i]).normalized(),
				]
			)
		}

		for(let i = 0; i < this.dag.num_edges(); i++)
		{
			let edge: Edge = this.dag.get_edge(i).unwrap();
			let edge_data = this.edge_data[i];

			let start_data = this.vert_data[edge.start];
			let end_data = this.vert_data[edge.end];

			let start_pos = start_data.position;
			let end_pos = end_data.position;
			let delta = end_pos.sub(start_pos);
			let tan_len = delta.norm() / 2;

			let spread_percents = spread_percent(edge_data);

			let start_tan = edge_data.start_ang_override
				.get_vector(
					spread_percents[0] * start_data.spread_out,
					vert_in_out[edge.start][1]
				).scale(tan_len);
			let end_tan = edge_data.end_ang_override
				.get_vector(
					-spread_percents[1] * end_data.spread_in,
					vert_in_out[edge.end][0]
				).scale(tan_len);

			let cp1 = start_pos.add( start_tan );
			let cp2 = end_pos.sub( end_tan );

			let bez: Bezier = new Bezier(
				start_pos,
				cp1,
				cp2,
				end_pos,
			);

			edges.push(bez);
		}

		return {
			verts: verts,
			edges: edges
		};
	}

	copy_in_data(vd: VertData[], ed: EdgeData[])
	{
		for(let i = 0; i < Math.min(vd.length, this.vert_data.length); i++)
			this.vert_data[i] = vd[i];
		
		for(let i = 0; i < Math.min(ed.length, this.edge_data.length); i++)
			this.edge_data[i] = ed[i];
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

export type BakedDAGEmbedding = 
{
	verts: Vector2[],
	edges: Bezier[]
};

