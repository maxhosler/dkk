import { z, ZodType } from "zod";
import { JSONable } from "../serialization";
import { Result, Option } from "../util/result";
import { zod_err_to_string } from "../util/zod";

/*
This is the object used for the DAG and its framing.
It is constructed as a DAG with no edges, and some number
of vertices. Edges can be added and removed with methods,
and the framing modified (new edges are added as the last
element of the framings at their endpoints by default).

However, note that these methods should not be used when
the DAG is loaded into the CliqueViewer! Things like the 
polytope and lattice are computed on load, and will not
be precomputed if modifications are made to the DAG.
*/

export const dag_error_types = {
    NoSuchVertex: "NoSuchVertex",
    IllegalCycle: "IllegalCycle",
};
export type Edge = { start: number, end: number };
export type JSONFramedDag = {num_verts: number, out_edges: number[][], in_edges: number[][]};
export class FramedDAG implements JSONable
{
    private f_num_edges: number;
    private f_num_verts: number;
    private out_edges: number[][]; // out_edges[i] is the list of edges going out
                                   // of vertex v_i, in order
    private in_edges:  number[][]; // Same as above, except with in-edges.
    private edges: Array<Edge> = [];

    constructor(num_verts: number) {
        this.f_num_edges = 0;
        this.f_num_verts = num_verts;

        this.out_edges = []
        this.in_edges  = []

        for(let i = 0; i < num_verts; i++)
        {
            this.out_edges.push([]);
            this.in_edges.push([]);
        }
    }

    valid_vert(v: number): boolean
    {
        return Number.isInteger(v) &&  v >= 0 && v < this.f_num_verts;
    }

    valid_edge(v: number): boolean
    {
        return Number.isInteger(v) &&  v >= 0 && v < this.f_num_edges;
    }

    num_edges(): number
    {
        return this.f_num_edges;
    }

    num_verts(): number
    {
        return this.f_num_verts;
    }

    get_edge(i: number): Option<Edge>
    {
        if(!this.valid_edge(i))
        {
            return Option.none();
        }
        return Option.some(structuredClone(this.edges[i]));
    }
    
    //If OK, returns index of new edge.
    add_edge(start: number, end: number) : Result<number>
    {
        for(let x of [[start, "start"], [end, "end"]])
        {
            let num: number = x[0] as number;
            let name: String = x[1] as String;
            
            if(!this.valid_vert(num))
            {
                return Result.err(dag_error_types.NoSuchVertex,
                    "Provided vertex with impossible index " +
                    num.toString() +
                    " for field " +
                    name + "."
                );
            }
        }

        if(this.preceeds(end, start).unwrap_or(false))
        {
            return Result.err(
                dag_error_types.IllegalCycle,
                "End preceeds start, introducing illegal cycle."
            );
        }

        let new_edge = this.f_num_edges;
        this.f_num_edges += 1;

        this.edges.push({start:start, end:end})
        this.out_edges[start].push(new_edge);
        this.in_edges[end].push(new_edge);

        return Result.ok(new_edge);
    }

    remove_edge(idx: number): boolean
    {
        if(idx < 0 && idx >= this.edges.length)
            return false;

        const clear = (lis: number[]) => 
        {
            let out = [];
            for(let x of lis)
            {
                if(x < idx)
                    out.push(x)
                if(x > idx)
                    out.push(x-1)
            }
            return out;
        };

        this.edges.splice(idx, 1);
        this.f_num_edges -= 1;

        for(let i = 0; i < this.f_num_verts; i++)
        {
            this.in_edges[i]  = clear(this.in_edges[i]);
            this.out_edges[i] = clear(this.out_edges[i]);
        }

        return true;
    }

    //checks if there is a path from start to end; err if verts not valid
    preceeds(start: number, end: number): Result<boolean>
    {
        for(let x of [[start, "start"], [end, "end"]])
        {
            let num: number = x[0] as number;
            let name: String = x[1] as String;
            
            if(!this.valid_vert(num))
            {
                return Result.err(dag_error_types.NoSuchVertex,
                    "Provided vertex with impossible index " +
                    num.toString() +
                    " for field " +
                    name + "."
                );
            }
        }

        let layer: Array<number> = [start];
        while (layer.length > 0)
        {
            let new_layer: Array<number> = [];
            for(let edge of this.edges)
            {
                if(layer.includes(edge.start))
                {
                    if(edge.end == end)
                    { return Result.ok(true); }
                    new_layer.push(edge.end);
                }
            }
            layer = new_layer;
        }

        return Result.ok(false);
    }

    //returns a copy of out edges
    get_out_edges(vert: number): Option<Array<number>>
    {
        if(!this.valid_vert(vert))
        {
            return Option.none();
        }
        return Option.some([...this.out_edges[vert]])
    }

    //returns a copy of in edges
    get_in_edges(vert: number): Option<Array<number>>
    {
        if(!this.valid_vert(vert))
        {
            return Option.none();
        }
        return Option.some([...this.in_edges[vert]])
    }

    reorder_out_edges(vert: number, new_arr: Array<number>): boolean
    {
        if(!this.valid_vert(vert)) { return false; }
        if(!valid_replacement(this.out_edges[vert], new_arr)) { return false; }
        this.out_edges[vert] = new_arr;
        return true;
    }

    reorder_in_edges(vert: number, new_arr: Array<number>): boolean
    {
        if(!this.valid_vert(vert)) { return false; }
        if(!valid_replacement(this.in_edges[vert], new_arr)) { return false; }
        this.in_edges[vert] = new_arr;
        return true;
    }

    sources(): Array<number>
    {
        let out: number[] = [];

        for(let i = 0; i < this.f_num_verts; i++)
        {
            if(this.in_edges[i].length == 0)
                out.push( i );
        }

        return out;
    }

    sinks(): Array<number>
    {
        let out: number[] = [];

        for(let i = 0; i < this.f_num_verts; i++)
        {
            if(this.out_edges[i].length == 0)
                out.push( i );
        }

        return out;
    }

    source(): Option<number>
    {
        let ls = this.sources();
        if(ls.length == 1)
            return Option.some(ls[0]);
        return Option.none();
    }

    sink(): Option<number>
    {
        let ls = this.sinks();
        if(ls.length == 1)
            return Option.some(ls[0]);
        return Option.none();
    }

    clone(): FramedDAG
    {
        let out = new FramedDAG(this.f_num_verts);
        
        out.f_num_verts = this.f_num_verts;
        out.f_num_edges = this.f_num_edges;
        out.out_edges  = structuredClone(this.out_edges);
        out.in_edges   = structuredClone(this.in_edges);
        out.edges      = structuredClone(this.edges);

        return out;
    }

    //Check if this is a valid framed DAG
    //with one source and sink, and connected
    valid(): boolean
    {
        let onesource = this.sources().length == 1;
        let onesink = this.sinks().length == 1;

        //Should guarantee connectedness, as 
        //If there are two conn-components, they
        //each have at least one source/sink

        return onesink && onesource;
    }

    static json_schema(): ZodType<JSONFramedDag> {
        return z.object({
            num_verts: z.number(),
            out_edges: z.number().array().array(),
            in_edges: z.number().array().array()
        })
    }
    to_json_object(): JSONFramedDag
    {
        return {
            num_verts: this.num_verts(),
            out_edges: structuredClone(this.out_edges),
            in_edges: structuredClone(this.in_edges)
        }
    }

    static parse_json(raw_ob: Object): Result<FramedDAG>
    {
        let res = FramedDAG.json_schema().safeParse(raw_ob);
        if(!res.success)
            return Result.err("MalformedData", zod_err_to_string(res.error))
        
        let data = res.data;

        let edges: {[e: number]: [number, number]} = {};
        let max_edge = -1;
        for(let v = 0; v < data.num_verts; v++)
        {
            for(let e of data.out_edges[v])
            {
                if(!(e in edges))
                    edges[e] = [-1,-1]
                if(edges[e][0] != -1) return Result.err("InvalidData", `Edge ${e} has multiple start points.`)
                edges[e][0] = v;
                max_edge = Math.max(e, max_edge);
            }
            for(let e of data.in_edges[v])
            {
                if(!(e in edges))
                    edges[e] = [-1,-1]
                if(edges[e][1] != -1) return Result.err("InvalidData", `Edge ${e} has multiple end points.`)
                edges[e][1] = v;
                max_edge = Math.max(e, max_edge);
            }
        }
        let num_edges = max_edge + 1;

        let out = new FramedDAG(data.num_verts);

        for(let e = 0; e < num_edges; e++)
        {
            if(!(e in edges))
                return Result.err("InvalidData", "Edge list not saturated.")

            let edge = edges[e];

            if(edge[0] == -1)
                return Result.err("InvalidData", `Edge ${e} has no start point.`);
            if(edge[1] == -1)
                return Result.err("InvalidData", `Edge ${e} has no end point.`)

            let succ = out.add_edge(edge[0], edge[1])

            if(!succ.is_ok())
                return succ.err_to_err()
        }

        for(let v = 0; v < data.num_verts; v++)
        {
            let in_framing = data.in_edges[v];
            let out_framing = data.out_edges[v];

            let in_succ = out.reorder_in_edges(v, in_framing);
            let out_succ = out.reorder_out_edges(v, out_framing);

            //Is this possible, given how the rest of the function works?
            if(!in_succ)
                return Result.err("InvalidData", `In-ordering on vertex ${v} invalid.`);
            if(!out_succ)
                return Result.err("InvalidData", `Out-ordering on vertex ${v} invalid.`)
        }

        return Result.ok(out);
    }

    static from_json_string(str: string): Result<FramedDAG>
    {
        let obj: Object;
        try
        {
            obj = JSON.parse(str);
        }
        catch
        {
            return Result.err(
                "InvalidJSON",
                "JSON file was malformed."
            );
        }
        
        let data = obj as JSONFramedDag;

        return FramedDAG.parse_json(data);
    }
}

//Basically checks that two arrays are equal as (multi-)sets.
function valid_replacement(arr1: Array<number>, arr2: Array<number>): boolean
{
    if(arr1.length != arr2.length) { return false; }

    let a1 = arr1.toSorted();
    let a2 = arr2.toSorted();

    for(let i = 0; i < a1.length; i++)
        if (a1[i] != a2[i])
            return false;
    
    return true;
}

