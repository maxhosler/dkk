/*
    Implementation of Rust-style errors and options, because those are nicer.
*/

/*
    Honestly, I'm not sure how good an idea doing this was. Without 
    the syntactic support provided by Rust, using these is still a bit hacky.
    The error stuff is still good, but I might want to go through and change all my
    Option<T>s to T?s.
*/

export type ResultError =
{
    readonly err_name: string,
    readonly err_message: string
}

/*
Result type. Either contains the expected value,
or an error explaining what went wrong. Prevents the need
for try{}catch{} blocks.
*/
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
            if(typeof ok === "undefined")
            { throw new Error("Invalid result construction, 'ok' undefined on success."); }

            this.ok = ok;
        }
        else
        {
            if(typeof err === "undefined")
            { throw new Error("Invalid result construction, 'err' undefined on failure."); }

            this.err = err;
        }
    }

    public static ok<T>(t: T): Result<T>
    {
        return new Result<T>(true, t, undefined);
    }

    public static err<T>(err_name: string, err_message: string): Result<T>
    {
        let err: ResultError = {
            err_message: err_message,
            err_name: err_name
        };
        return new Result<T>(false, undefined, err);
    }

    //Gets inner T, throws error if no such T
    unwrap(): T
    {
        if(!this.success)
        { throw new Error("Tried to unwrap failed Result.\nError: "+this.err?.err_name + "\nMessage: "+this.err?.err_message) }
        return this.ok as T;
    }

    //Gets innter T, returns {val} if no such T
    unwrap_or(val: T): T
    {
        if(this.success)
        { return this.ok as T; }
        return val;
    }

    //Just convert to nullable
    unwrap_or_null(): T | null
    {
        if(this.success)
        { return this.ok as T; }
        return null;
    }

    is_ok(): boolean
    {
        return this.success;
    }

    is_err(): boolean
    {
        return !this.success;
    }

    //Get inner error, throws error if no such error.
    error(): ResultError
    {
        if(this.success)
        { throw new Error("Tried to unwrap error from successful Result.") }
        return this.err as ResultError;
    }

    //Maps inner value using {fn} if it exists, does nothing otherwise.
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

//Optional type. Either contains a copy of T or nothing.
export class Option<T>
{
    valid: boolean;
    value: T | undefined

    private constructor(
        valid: boolean,
        some: T | undefined,
    )
    {
        this.valid = valid;
        if(valid)
        {
            if(typeof some === "undefined")
            { throw new Error("Invalid result construction, 'ok' undefined on success."); }

            this.value = some;
        }
        else
        {
            this.value = undefined;
        }
    }

    public static some<T>(t: T): Option<T>
    {
        return new Option<T>(true, t);
    }

    public static none<T>(): Option<T>
    {
        return new Option<T>(false, undefined);
    }

    //Gets inner T if it exists, throws error otherwise.
    unwrap(): T
    {
        if(!this.valid)
        { throw new Error("Tried to unwrap None.") }
        return this.value as T;
    }

    //Gets inner T if it exists, returns {val} otherwise.
    unwrap_or(val: T): T
    {
        if(this.valid)
        { return this.value as T; }
        return val;
    }

    //To nullable
    unwrap_or_null(): T | null
    {
        if(this.valid)
        { return this.value as T; }
        return null;
    }

    //Unwraps or throws error containing {err} otherwise.
    expect(err: string): T
    {
        if(!this.valid)
        { throw new Error(err) }
        return this.value as T;
    }

    is_some(): boolean
    {
        return this.valid;
    }

    is_none(): boolean
    {
        return !this.valid;
    }

    //Maps inner value using {fn} if it exists, does nothing otherwise.
    map<S>(fn: (a: T) => S): Option<S>
    {
        if(this.valid)
        {
            let new_some: S = fn(this.value as T);
            return Option.some(new_some);
        }
        else
        {
            return Option.none();
        }
    }
}