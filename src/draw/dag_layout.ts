import { Edge, FramedDAG, JSONFramedDag } from "../math/dag";
import { Result } from "../util/result";
import { Bezier, Vector2 } from "../util/num";
import { JSONable } from "../serialization";
import { z, ZodType } from "zod";


/*
This object represents an "override" of the default behavior for rendering
how edges are angled at their start and end.

"none" is default behavior
"absolute" is an absolute angle
"relative" is an angle relative to the line between the start and end vertices
"vec-abs" just directly sets the normal vector at the start of the bezier curve
*/
export type AngleOverrideType = "none" | "absolute" | "relative" | "vec-abs";
export class AngleOverride implements JSONable
{
	readonly type: AngleOverrideType;
	//Actual associated value, depends on the type
	//Should be Vector2 for vec-abs, a number (in radians) otherwise.
	readonly inner: number | Vector2; 

	private constructor(type: AngleOverrideType, angle: number | Vector2)
	{
		this.type = type;
		this.inner = angle;
	}

	/*
	Function for actually getting the normal vector. 
	Anywhere from all to none of the input values are
	actually used, based on the type.
	*/
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

	/*
	Factories, to guarantee the types match up
	*/
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

	static json_schema(): ZodType<JSONAngleOverride> {
		return z.object({
			type: (
				z.literal("none").or(
				z.literal("absolute").or(
				z.literal("relative").or(
				z.literal("vec-abs")
				)))
			),
			inner: z.number().or(z.tuple([z.number(), z.number()]))
		})
	}
	to_json_object(): JSONAngleOverride
	{
		let inner: number | [number, number];
		if(typeof this.inner == "number")
			inner = this.inner
		else
			inner = [this.inner.x, this.inner.y]
		return {
			type: structuredClone(this.type),
			inner
		}
	}
	static parse_json(raw_ob: Object): Result<AngleOverride>
	{
		let res = AngleOverride.json_schema().safeParse(raw_ob);
		if(!res.success)
			return Result.err("MalformedData", res.error.toString());

		let ob = res.data;
		let inner: number | Vector2
		if(typeof ob.inner == "number")
			inner = ob.inner;
		else
			inner = new Vector2(ob.inner[0], ob.inner[1])
		return Result.ok(new AngleOverride(ob.type, inner));
	}
}

//Layout data for a given edge.
export type EdgeData = {
	//Position in the framing at the start,
	//for example, [1,5] means the second (we index from 0) element out of 5
	start_list_pos: [pos: number, out_of: number], 
	//Same but for end
	end_list_pos:   [pos: number, out_of: number],

	//Overrides at start and end
	start_ang_override: AngleOverride,
	end_ang_override:   AngleOverride,
}

//Layout data for a given vertex
export type VertData = {
	position: Vector2,
	/*
	Spread is the angle over which edges are 
	spread-out when using default behavior.
	*/
	spread_out: number,
	spread_in: number
}

export class FramedDAGEmbedding implements JSONable
{
	readonly dag: FramedDAG;
	
	vert_data: Array<VertData>;
	edge_data: Array<EdgeData>;

	constructor(dag: FramedDAG)
	{
		//Fill with default values.
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
		//Assigns to each edge the default behavior, 
		//with incorrect start_ and end_list_pos
		this.edge_data = Array.from(
			{length:this.dag.num_edges()},
			() => ({ 
				start_list_pos: [1,1],
				end_list_pos: [1,1],
				start_ang_override: AngleOverride.none(),
				end_ang_override: AngleOverride.none(),
			})
		);
		//Correct compute start_ and end_list_pos
		this.recomp_list_pos();
	}

	default_verts()
	{
		/*
		This just lays out the vertices in a line, and gives them
		a spread of PI/2 radians.

		The order of the line is guaranteed to respect the precedence
		order of the DAG (so no edges go backwards). Position in the 
		list of vertices is used to compare incomparables.
		*/

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
		//Compute position in framing for each edge.

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

	/*
	"Bake" into data that can be more directly rendered.
	Vertices are just given positions, and all the other
	data is used to compute the Bezier curves for the edges.
	*/
	bake(): BakedDAGEmbedding
	{
		let verts: Vector2[] = [];
		let edges: Bezier[] = [];

		//each entry is the a pair of vectors, the directions from a given
		//vertex to its immediate predecessors and successors, respectively
		//used for 'default' and 'relative' AngleOverride behavior.
		let vert_in_out: [Vector2,Vector2][] = [];

		//The list of verts just takes directly from the VertData
		//No computation necessary!
		for(let x of this.vert_data)
			verts.push(x.position.clone());
		
		//Computing vert_in_out
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


		//Compute the bezier curves
		for(let i = 0; i < this.dag.num_edges(); i++)
		{
			let edge: Edge = this.dag.get_edge(i).unwrap();
			let edge_data = this.edge_data[i];

			//Vertex data for the start and end.
			let start_data = this.vert_data[edge.start];
			let end_data = this.vert_data[edge.end];

			//Start and end of bezier curves are just the vertices.
			let start_pos = start_data.position;
			let end_pos = end_data.position;

			//Default length of the tangent vector is half the length between
			//the endpoints
			let delta = end_pos.sub(start_pos);
			let tan_len = delta.norm() / 2;

			let spread_percents = spread_percent(edge_data);

			//Compute tangent vectors
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

			//Compute control points
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

	//Remove an edge from the framing,
	//doing any necessary housekeeping.
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

	
	static json_schema(): ZodType<JSONFramedDagEmbedding> {
		return z.object({
			dag: FramedDAG.json_schema(),
			vert_data: z.object({
				position: z.tuple([z.number(), z.number()]),
				spread_in: z.number(),
				spread_out: z.number()
			}).array(),
			edge_data: z.object({
				start_list_pos: z.tuple([z.number(), z.number()]),
				end_list_pos: z.tuple([z.number(), z.number()]),
				start_ang_override: AngleOverride.json_schema(),
				end_ang_override: AngleOverride.json_schema()
			}).array()
		})
	}
	to_json_object(): JSONFramedDagEmbedding
	{
		let vd: JSONVertData[] = [];
		let ed: JSONEdgeData[] = [];

		for(let v of this.vert_data)
		{
			vd.push({
				position: v.position.to_json_object(),
				spread_in: v.spread_in,
				spread_out: v.spread_out
			})
		}
		for(let e of this.edge_data)
		{
			ed.push({
				start_list_pos: structuredClone(e.start_list_pos),
				end_list_pos: structuredClone(e.end_list_pos),
				end_ang_override: e.end_ang_override.to_json_object(),
				start_ang_override: e.start_ang_override.to_json_object()
			})
		}

		return {
			dag: this.dag.to_json_object(),
			vert_data: vd,
			edge_data: ed
		};
	}

	to_json(): string
	{
		return JSON.stringify(this.to_json_object())
	}

	static parse_json(raw_ob: Object): Result<FramedDAGEmbedding>
	{
        let res = FramedDAGEmbedding.json_schema().safeParse(raw_ob);
        if(!res.success)
            return Result.err("MalformedData", res.error.toString());
		let jsonob = res.data;
		let dag = FramedDAG.parse_json(jsonob.dag).unwrap();

		if(dag.num_verts() != jsonob.vert_data.length)
			return Result.err("InvalidData", "Vertex embedding data not the same lenth as number of vertices.")
		if(dag.num_edges() != jsonob.edge_data.length)
			return Result.err("InvalidData", "Edge embedding data not the same lenth as number of edges.")

		let vert_data: VertData[] = jsonob.vert_data.map(
			(jsn) => { return {
				position: new Vector2(jsn.position[0], jsn.position[1]),
				spread_in: jsn.spread_in,
				spread_out: jsn.spread_out
			}}
		);
		let edge_data: EdgeData[] = jsonob.edge_data.map(
			(jsn) => {return {
				start_list_pos: jsn.start_list_pos,
				end_list_pos: jsn.end_list_pos,
				end_ang_override: AngleOverride.parse_json(jsn.end_ang_override).unwrap(),
				start_ang_override: AngleOverride.parse_json(jsn.start_ang_override).unwrap(),
			}}
		);
		
		let out = new FramedDAGEmbedding(dag);
		out.edge_data = edge_data;
		out.vert_data = vert_data;
		
		return Result.ok(out);
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

        return FramedDAGEmbedding.parse_json(obj);
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

export type JSONAngleOverride = {
	type: AngleOverrideType,
	inner: [number, number] | number
}
export type JSONEdgeData =
{
	start_list_pos: [pos: number, out_of: number], 
	end_list_pos:   [pos: number, out_of: number],
	start_ang_override: JSONAngleOverride,
	end_ang_override:   JSONAngleOverride,
}

export type JSONVertData = {
	position: [number, number],
	spread_out: number,
	spread_in: number
}

export type JSONFramedDagEmbedding =
{
	dag: JSONFramedDag,
	vert_data: JSONVertData[],
	edge_data: JSONEdgeData[]
}