import { z } from "zod";
import { FramedDAGEmbedding, JSONFramedDagEmbedding } from "./draw/dag_layout";
import { FramedDAG, JSONFramedDag } from "./math/dag";
import { JSONCliqueData } from "./modes/clique_viewer";
import { FlowPolytope } from "./math/polytope";
import { DAGCliques } from "./math/cliques";
import { Result } from "./util/result";

export type SaveData = 
    {datatype: "dag", data: JSONFramedDag} |
    {datatype: "emb_dag", data: JSONFramedDagEmbedding} |
    {datatype: "precomp", data: JSONCliqueData }

const SAVE_SCHEMA = 
    z.object({
        datatype: z.literal("dag"),
        data: FramedDAG.json_schema()
    })
.or(
    z.object({
        datatype: z.literal("emb_dag"),
        data: FramedDAGEmbedding.json_schema()
    })
).or(
    z.object({
        datatype: z.literal("precomp"),
        data: z.object({
            dag: FramedDAGEmbedding.json_schema(),
            polytope: FlowPolytope.json_schema(),
            cliques: DAGCliques.json_schema(),
            hasse_overrides: z.record(z.number(), z.tuple([z.number(), z.number()]))
        })
    })
)

export function load_from_json(data: Object): Result<SaveData>
{
    let res = SAVE_SCHEMA.safeParse(data);
    if(!res.success)
        return Result.err("MalformedData", res.error.toString())

    return Result.ok(res.data)
}