/*
    Implementation of Rust-style errors, because those are nicer.
*/

export type ResultError =
{
    readonly err_name: String,
    readonly err_message: String
}

export class Result<T> {
    public success: boolean;
    private ok: T | undefined = undefined;
    private err: ResultError | undefined = undefined;

    private constructor(
        success: boolean,
        ok: T | undefined,
        err: ResultError | undefined
    )
    {
        this.success = success;
        if(success)
        {
            if(!ok)
            { throw new Error("Invalid result construction, 'ok' undefined on success."); }

            this.ok = ok;
        }
        else
        {
            if(!err)
            { throw new Error("Invalid result construction, 'err' undefined on failure."); }

            this.err = err;
        }
    }

    public static ok<T>(t: T): Result<T>
    {
        return new Result<T>(true, t, undefined);
    }

    public static err<T>(err_name: String, err_message: String): Result<T>
    {
        let err: ResultError = {
            err_message: err_message,
            err_name: err_name
        };
        return new Result<T>(false, undefined, err);
    }

    unwrap(): T
    {
        if(!this.success)
        { throw new Error("Tried to unwrap failed Result.\nError: "+this.err?.err_name + "\nMessage: "+this.err?.err_message) }
        return this.ok as T;
    }

    unwrap_or(val: T): T
    {
        if(this.success)
        { return this.ok as T; }
        return val;
    }

    unwrap_or_null(): T | null
    {
        if(this.success)
        { return this.ok as T; }
        return null;
    }

    error(): ResultError
    {
        if(this.success)
        { throw new Error("Tried to unwrap error from successful Result.") }
        return this.err as ResultError;
    }

    map<S>(fn: (a: T) => S): Result<S>
    {
        if(this.success)
        {
            let new_ok: S = fn(this.ok as T);
            return Result.ok(new_ok);
        }
        else
        {
            let err = this.err;
            return new Result<S>(false, undefined, err);
        }
    }

    err_to_err<S>(): Result<S>
    {
        if(this.success)
        { throw new Error("Tried to unwrap error from successful Result.") }

        let err = this.err;
        return new Result<S>(false, undefined, err);
    }
}

