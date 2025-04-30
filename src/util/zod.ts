import { ZodError } from "zod";

export function zod_err_to_string(err: ZodError): string
{
    let out = "";

    let extra_errs = err.issues.length - 3;
    for(let i = 0; i < Math.min(err.issues.length, 3); i++)
    {
        if(i != 0)
            out += "\n"
        for(let p of err.issues[i].path)
            out += p.toString() + "/"
        out += err.issues[i].message
    }
    if(extra_errs >= 1)
        out += `\n(${extra_errs} more...)`

    return out;
}