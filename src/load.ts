import { z } from "zod";
import { FramedDAGEmbedding, JSONFramedDagEmbedding } from "./draw/dag_layout";
import { FramedDAG, JSONFramedDag } from "./math/dag";
import { JSONCliqueData } from "./modes/clique_viewer";
import { FlowPolytope } from "./math/polytope";
import { DAGCliques } from "./math/cliques";
import { Result } from "./util/result";
import { zod_err_to_string } from "./util/zod";

export type SaveData = 
    {datatype: "dag", data: FramedDAG} |
    {datatype: "emb_dag", data: FramedDAGEmbedding} |
    {datatype: "precomp", data: JSONCliqueData }

const SAVE_SCHEMA = z.discriminatedUnion("datatype", [
    z.object({
        datatype: z.literal("dag"),
        data: FramedDAG.json_schema()
    }),
    z.object({
        datatype: z.literal("emb_dag"),
        data: FramedDAGEmbedding.json_schema()
    }),
    z.object({
        datatype: z.literal("precomp"),
        data: z.object({
            dag: FramedDAGEmbedding.json_schema(),
            polytope: FlowPolytope.json_schema(),
            cliques: DAGCliques.json_schema(),
            hasse_overrides: z.record(z.coerce.number(), z.tuple([z.number(), z.number()]))
        })
    })
])

export function load_from_string(data: string): Result<SaveData>
{
    try
    {
        let ob = JSON.parse(data);
        return load_from_json(ob);
    }
    catch
    {
        return Result.err("Malformed JSON", "JSON string failed to parse.")
    }
}

export function load_from_json(data: Object): Result<SaveData>
{
    let res = SAVE_SCHEMA.safeParse(data);
    if(!res.success)
        return Result.err("MalformedData", zod_err_to_string(res.error))

    let out: SaveData;
    if(res.data.datatype == "precomp")
    {
        out = {
            datatype: "precomp",
            data: res.data.data
        };
    }
    else if(res.data.datatype == "emb_dag")
    {
        out = {
            datatype: "emb_dag",
            data: FramedDAGEmbedding.parse_json(res.data.data).unwrap()
        }
    }
    else if(res.data.datatype == "dag")
    {
        out = {
            datatype: "dag",
            data: FramedDAG.parse_json(res.data.data).unwrap()
        }
    }
    else
    {
        throw new Error("Type load not implemented!")
    }

    return Result.ok(out)
}