import { Schema } from "zod";
import { Result } from "./util/result";

export abstract class JSONable
{
    static json_schema(): Schema
    {
        throw new Error('Method not implemented! Use derived class');
    }

    abstract to_json_object(): Object;

    static parse_json(ob: Object): Result<any>
    {
        throw new Error('Method not implemented! Use derived class');
    }
}