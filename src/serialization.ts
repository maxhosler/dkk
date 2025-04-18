import { Schema } from "zod";

export abstract class JSONable
{
    static json_schema(): Schema
    {
        throw new Error('Method not implemented! Use derived class');
    }

    abstract to_json_object(): Object
    to_json(): string
    {
        return JSON.stringify(this.to_json_object())
    }
}