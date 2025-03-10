import { BoundingBox, JSONBoundingBox, Vector2 } from "../util/num";
import { Result } from "../util/result";
import { Clique } from "./routes";

export class HasseDiagram
{
    readonly poset_size: number;
    readonly covering_relation: boolean[][];
    
    readonly layout_rows: Vector2[];
    readonly bounding_box: BoundingBox;
    
    readonly minimal_elt: number;
    readonly maximal_elt: number;

    readonly cover_routes: [lower: number, higher: number][][];

    constructor(poset_relation: boolean[][], cliques: Clique[])
    {
        //Extracts the covering relation from the poset relation.
        let covering_relation: boolean[][] = structuredClone(poset_relation);
        this.poset_size = covering_relation.length;
        for(let clq1 = 0; clq1 < this.poset_size; clq1++){
            for(let clq2 = 0; clq2 < this.poset_size; clq2++)
            {
                if(clq1 == clq2)
                {
                    covering_relation[clq1][clq2] = false;
                    continue;
                }
                if(!poset_relation[clq1][clq2]) continue;
                for(let clq_mid = 0; clq_mid < this.poset_size; clq_mid++)
                {
                    if(clq_mid == clq1 || clq_mid == clq2) continue;
                    if(poset_relation[clq1][clq_mid] && poset_relation[clq_mid][clq2])
                    {
                        covering_relation[clq1][clq2] = false;
                        break;
                    }
                }
            }
        }
        this.covering_relation = covering_relation;

        this.maximal_elt = -1
        this.minimal_elt = -1;
        for(let i = 0; i < this.poset_size; i++)
        {
            let num_geq = 0;
            for(let j = 0; j < this.poset_size; j++)
            {
                if(poset_relation[i][j])
                    num_geq += 1;
            }

            if(num_geq == 1)
                this.maximal_elt = i;
            if(num_geq == this.poset_size)
                this.minimal_elt = i;
        }

        this.layout_rows = HasseDiagram.compute_layout_rows(
            this.minimal_elt,
            this.covering_relation
        )

        this.bounding_box = new BoundingBox(this.layout_rows);

        this.cover_routes = [];
        for(let i = 0; i < this.poset_size; i++) {
            this.cover_routes.push([])
            for(let j = 0; j < this.poset_size; j++)
            {
                if (!this.covering_relation[i][j]) {
                    this.cover_routes[i].push([-1,-1]);
                    continue;
                }
                
                let lo_clq = cliques[i];
                let hi_clq = cliques[j];
                
                let lo_route = -1;
                let hi_route = -1;

                for(let r of lo_clq.routes)
                {
                    if(!hi_clq.routes.includes(r))
                    {
                        lo_route = r;
                        break;
                    }
                }

                for(let r of hi_clq.routes)
                {
                    if(!lo_clq.routes.includes(r))
                    {
                        hi_route = r;
                        break;
                    }
                }

                if(lo_route == -1 || hi_route == -1)
                {
                    console.warn("Clique covered by other clique do not differ as expected.")
                    this.cover_routes[i].push([-1,-1]);
                }

                this.cover_routes[i].push([lo_route, hi_route]);
            }
        }

        
    }

    private static compute_layout_rows(
        min: number,
        covering_relation: boolean[][]
    ): Vector2[]
    {
    
        let max_depths: number[] = [];
        for(let i = 0; i < covering_relation.length; i++)
        {
            max_depths.push(0);
        }

        let srch = [min];
        let cur_depth = 0;
        while(srch.length != 0)
        {
            let next_row: number[] = [];
            for(let s of srch)
            {
                max_depths[s] = cur_depth;
                for(let i = 0; i < covering_relation.length; i++)
                    if(covering_relation[s][i])
                        next_row.push(i)

            }
            cur_depth += 1;
            srch = next_row;
        }

        let max_depth = max_depths.reduce((a,b) => Math.max(a,b), 0);
        let rows: number[][] = [];
        for(let d = 0; d <= max_depth; d++)
        {
            let next_row: number[] = [];
            for(let j = 0; j < max_depths.length; j++)
                if(max_depths[j] == d)
                    next_row.push(j)
            if(next_row.length > 0)
                rows.push(next_row);
        }        

        let edges: [number, number][] = [];
        for(let i = 0; i < covering_relation.length; i++)
            for(let j = 0; j < covering_relation.length; j++)
                if(covering_relation[i][j])
                    edges.push([i,j]);

        let row_of: {[key: number]: number} = {}
        for(let i = 0; i < rows.length; i++)
            for(let e of rows[i])
                row_of[e] = i;

        let dummy = -1;
        let get_dummy = () => {
            dummy -= 1;
            return dummy;
        }

        let extended_edges = []
        let extended_rows = structuredClone(rows);
        for(let edge of edges)
        {
            let [i,j] = edge;
            let row_i = row_of[i];
            let row_j = row_of[j];
            if(row_of[j] - row_of[i] == 1)
                extended_edges.push([i,j])
            else
            {
                let dummies = [];
                for(let r = row_i + 1; r < row_j; r++)
                {
                    let d = get_dummy();
                    dummies.push(d);
                    row_of[d] = r;
                    extended_rows[r].push(d);
                }
                extended_edges.push([i, dummies[0]]);
                for(let d_idx = 0; d_idx < dummies.length-1; d_idx++)
                {
                    extended_edges.push([
                        dummies[d_idx],
                        dummies[d_idx+1]
                    ])
                }
                extended_edges.push([dummies[dummies.length-1], j])
            }
        }

        for(let row of extended_rows)
        {
            row.sort();
        }
        
        let badness = () => HasseDiagram.comp_badness(extended_rows, edges, row_of);

        while(true)
        {
            let start_val = badness();
            for(let depth = 0; depth < extended_rows.length; depth++)
            {
                let swap = (x: number, y: number) => {
                    [ extended_rows[depth][x], extended_rows[depth][y] ]
                        = [ extended_rows[depth][y], extended_rows[depth][x] ];
                }

                if(extended_rows[depth].length == 0)
                    continue;
                let depth_start_val = badness();

                for(let i = 0; i < extended_rows[depth].length; i++)
                {
                    let do_break = false;
                    for(let j = i+1; j < extended_rows[depth].length; j++)
                    {
                        swap(i,j);
                        if(badness() < depth_start_val)
                        {
                            do_break = true;
                            break;
                        }
                        swap(i,j);
                    }
                    if(do_break) break;
                }

            }
            let end_val = badness();

            if(start_val - end_val < 0.01)
                break;
        }

        let positions: Vector2[] = [];
        for(let i = 0; i < covering_relation.length; i++)
        {
            positions.push(Vector2.zero())
        }
        for(let row_depth = 0; row_depth < extended_rows.length; row_depth++)
        {
            let row = extended_rows[row_depth];
            for(let j = 0; j < row.length; j++)
            {
                let idx = row[j];
                if(idx < 0) continue;
                let y = row_depth;
                let x = j - (row.length - 1)/2;
                positions[idx] = new Vector2(x,y);
            }
        }

        let avg = positions.reduce(
            (acc, nw) => acc.add(nw),
            Vector2.zero()
        ).scale(1/positions.length);

        return positions
            .map(v => v.sub(avg));
    }

    private static comp_badness(
        extended_rows: number[][], 
        edges: [number,number][], 
        row_of: {[key: number]: number}
    ): number
    {
        let badness = 0;

        for(let e of edges)
        {
            let pos: [number, number] = [0,0]
            for(let i of [0,1])
            {
                let row = row_of[e[i]];
                let rpos = extended_rows[row].indexOf(e[i]);
                let row_len = extended_rows[row].length;
                pos[i] = rpos - (row_len-1)/2;
            }
            badness += Math.abs(pos[0] - pos[1]);
        }

        return badness;
    }

    to_json_ob(): JSONHasseDiagram
    {
        return {
            poset_size: this.poset_size,
            covering_relation: structuredClone(this.covering_relation),
            layout_rows: this.layout_rows.map(x => x.to_json_ob()),
            bounding_box: this.bounding_box.to_json_ob(),
            minimal_elt: this.minimal_elt,
            maximal_elt: this.maximal_elt,
            cover_routes: structuredClone(this.cover_routes)
        }
    }

    static from_json_ob(ob: JSONHasseDiagram): Result<HasseDiagram>
    {
        //TODO: Validate
        let layout_rows: Vector2[] = ob.layout_rows.map(
            (x) => new Vector2(x[0], x[1])
        )
        let bounding_box = BoundingBox.from_json_ob(ob.bounding_box);
        if(bounding_box.is_err())
            return bounding_box.err_to_err()
        let just_fields = {
            poset_size: ob.poset_size,
            covering_relation: structuredClone(ob.covering_relation),
            layout_rows,
            bounding_box: bounding_box.unwrap(),
            minimal_elt: ob.minimal_elt,
            maximal_elt: ob.maximal_elt,
            cover_routes: structuredClone(ob.cover_routes)
        };
        Object.setPrototypeOf(just_fields, HasseDiagram);
        return Result.ok(just_fields as HasseDiagram);
    }

}
export type JSONHasseDiagram = {
    poset_size: number;
    covering_relation: boolean[][];
    layout_rows: [number,number][];
    bounding_box: JSONBoundingBox;
    minimal_elt: number;
    maximal_elt: number;
    cover_routes: [lower: number, higher: number][][];
}