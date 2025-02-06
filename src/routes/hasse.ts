export class HasseDiagram
{
    private readonly poset_size: number;
    private readonly poset_relation: boolean[][];
    private readonly covering_relation: boolean[][];
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
        console.log(covering_relation);
    }
}