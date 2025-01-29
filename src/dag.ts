import { Result, Option } from "./result";


export const dag_error_types = {
    NoSuchVertex: "NoSuchVertex",
    IllegalCycle: "IllegalCycle"

};
export type Edge = { start: number, end: number };
export class FramedDAG {
    private _num_edges: number;
    private _num_verts: number;
    private out_edges: Array<Array<number>>; // out_edges[i] is the list of edges going out
                                             // of vertex v_i, in order
    private in_edges:  Array<Array<number>>; // Same as above, except with in-edges.
    private edges: Array<Edge> = [];

    constructor(num_verts: number) {
        this._num_edges = 0;
        this._num_verts = num_verts;

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
        return Number.isInteger(v) &&  v >= 0 && v < this._num_verts;
    }

    valid_edge(v: number): boolean
    {
        return Number.isInteger(v) &&  v >= 0 && v < this._num_edges;
    }

    num_edges(): number
    {
        return this._num_edges;
    }

    num_verts(): number
    {
        return this._num_verts;
    }

    get_edge(i: number): Option<Edge>
    {
        if(!this.valid_edge(i))
        {
            return Option.none();
        }
        return Option.some(this.edges[i]);
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

        let new_edge = this._num_edges;
        this._num_edges += 1;

        this.edges.push({start:start, end:end})
        this.out_edges[start].push(new_edge);
        this.in_edges[end].push(new_edge);

        return Result.ok(new_edge);
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

        for(let i = 0; i < this._num_verts; i++)
        {
            if(this.in_edges[i].length == 0)
                out.push( i );
        }

        return out;
    }

    clone(): FramedDAG
    {
        let out = new FramedDAG(this._num_verts);
        
        out._num_verts = this._num_verts;
        out._num_edges = this._num_edges;
        out.out_edges  = structuredClone(this.out_edges);
        out.in_edges   = structuredClone(this.in_edges);
        out.edges      = structuredClone(this.edges);

        return out;
    }
}

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

export function test_dag(): FramedDAG
{
    let out = new FramedDAG(3);
    out.add_edge(0,1).unwrap();
    out.add_edge(0,1).unwrap();
    out.add_edge(1,2).unwrap();
    out.add_edge(1,2).unwrap();
    return out;
}