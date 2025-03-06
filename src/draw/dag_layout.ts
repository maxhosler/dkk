import { Edge, FramedDAG, JSONFramedDag } from "../math/dag";
import { Option, Result } from "../util/result";
import { Bezier, clamp, Vector2 } from "../util/num";

export type AngleOverrideType = "none" | "absolute" | "relative" | "vec-abs";
export class AngleOverride
{
	readonly type: AngleOverrideType;
	readonly inner: number | Vector2;

	private constructor(type: AngleOverrideType, angle: number | Vector2)
	{
		this.type = type;
		this.inner = angle;
	}

	get_vector(
		default_angle: number,
		direction_vec: Vector2,
		scale: number
	): Vector2
	{
		if(this.type == "none")
			return direction_vec.rot(default_angle).scale(scale)
		if(this.type == "relative")
			return direction_vec.rot(this.inner as number).scale(scale)
		if(this.type == "absolute")
			return Vector2.right().rot(this.inner as number).scale(scale)
		if(this.type == "vec-abs")
			return this.inner as Vector2;
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

	static vec_abs(vec: Vector2): AngleOverride
	{
		return new AngleOverride("vec-abs", vec);
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

export type JSONFramedDagEmbedding =
{
	dag: JSONFramedDag,
	vert_data: VertData[],
	edge_data: EdgeData[]
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
		this.recomp_list_pos();
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

	recomp_list_pos()
	{
		for(let v = 0; v < this.dag.num_verts(); v++)
		{
			let out_edges: number[] = this.dag.get_out_edges(v).unwrap();
			for(let i = 0; i < out_edges.length; i++)
			{
				let edge = out_edges[i];
				this.edge_data[edge].start_list_pos = [i, out_edges.length];0.5;
			}

			let in_edges: number[] = this.dag.get_in_edges(v).unwrap();
			for(let i = 0; i < in_edges.length; i++)
			{
				let edge = in_edges[i];
				this.edge_data[edge].end_list_pos = [i, in_edges.length];
			}
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
					vert_in_out[edge.start][1],
					tan_len
				);
			let end_tan = edge_data.end_ang_override
				.get_vector(
					-spread_percents[1] * end_data.spread_in,
					vert_in_out[edge.end][0],
					tan_len
				);

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

	remove_edge(idx: number): boolean
	{
		if(this.dag.remove_edge(idx))
		{
			this.edge_data.splice(idx, 1);
			return true;
		}
		return false;
	}

	add_edge(start: number, end: number): Result<number>
	{
		let res = this.dag.add_edge(start, end);
		if(res.is_ok())
		{
			this.edge_data.push({ 
				start_list_pos: [1,1],
				end_list_pos: [1,1],
				start_ang_override: AngleOverride.none(),
				end_ang_override: AngleOverride.none(),
			})
			this.recomp_list_pos();
		}

		return res;
	}

	to_json_ob(): JSONFramedDagEmbedding
	{
		return {
			dag: this.dag.to_json_ob(),
			vert_data: structuredClone(this.vert_data),
			edge_data: structuredClone(this.edge_data)
		};
	}

	to_json(): string
	{
		return JSON.stringify(this.to_json_ob())
	}

	static from_json(json: string): Result<FramedDAGEmbedding>
	{
        let obj: Object;
        try
        {
            obj = JSON.parse(json);
        }
        catch
        {
            return Result.err(
                "InvalidJSON",
                "JSON file was malformed."
            );
        }
        for(let field of ["dag", "vert_data", "edge_data"])
            if(!(field in obj))
                return Result.err("MissingField", "JSON missing field '"+field+"'.")
		
		let data = obj as JSONFramedDagEmbedding;

		//TODO Validate

		let dag = FramedDAG.from_json_ob(data.dag);
		if(dag.if_err())
			return dag.err_to_err();
		let emb = new FramedDAGEmbedding(dag.unwrap());
		emb.vert_data = data.vert_data;
		emb.edge_data = data.edge_data;

		return Result.ok(emb);
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

