import { Result, Option } from "./result";


export const dag_error_types = {
    NoSuchVertex: "NoSuchVertex",
    IllegalCycle: "IllegalCycle"

};
export type Edge = { start: number, end: number };
export class FramedDAG {
    num_edges: number;
    num_verts: number;
    private out_edges: Array<Array<number>>; // out_edges[i] is the list of edges going out
                                             // of vertex v_i, in order
    private in_edges:  Array<Array<number>>; // Same as above, except with in-edges.
    private edges: Array<Edge> = [];

    constructor(num_verts: number) {
        this.num_edges = 0;
        this.num_verts = num_verts;

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
        return Number.isInteger(v) &&  v >= 0 && v < this.num_verts;
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

        let new_edge = this.num_edges;
        this.num_edges += 1;

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