export class HasseDiagram
{
    private readonly poset_size: number;
    private readonly poset_relation: boolean[][];
    private readonly covering_relation: boolean[][];

    readonly minimal_elt: number;
    readonly maximal_elt: number;
    constructor(poset_relation: boolean[][])
    {
        this.poset_relation = poset_relation;
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

        let psuedograding = HasseDiagram.compute_psuedograding(
            this.minimal_elt,
            this.maximal_elt,
            this.covering_relation
        )
    }

    private static compute_psuedograding(
        min: number,
        max: number,
        covering_relation: boolean[][]
    )
    {
        let depths: number[][] = [];
        for(let i = 0; i < covering_relation.length; i++)
        {
            depths.push([]);
        }

        let srch = [min];
        let cur_depth = 0;
        while(srch.length != 0)
        {
            let next_row: number[] = [];
            for(let s of srch)
            {
                if(!depths[s].includes(cur_depth))
                    depths[s].push(cur_depth);
                for(let i = 0; i < covering_relation.length; i++)
                    if(covering_relation[s][i])
                        next_row.push(i)

            }
            cur_depth += 1;
            srch = next_row;
        }

        let integer_scale = 1;
        for(let d of depths)
        {
            integer_scale = lcm(integer_scale, d.length)
        }

        let scaled_depths = depths.map(
            (ls: number[]) => {
                let unscaled = ls.reduce((s, a) => s + a, 0);
                return unscaled * (integer_scale / ls.length)
            }
        )

        console.log(scaled_depths);
    }
}


//More juked code.
function gcd(a:number, b:number) { 
    for (let temp = b; b !== 0;) { 
        b = a % b; 
        a = temp; 
        temp = b; 
    } 
    return a; 
} 
  
function lcm(a:number, b:number) { 
    return (a * b) / gcd(a, b); 
} 
  