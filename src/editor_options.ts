import { get_cookie, set_cookie } from "./util/cookie";


const EDITOR_OPTIONS_COOKIE_NAME = "editor-options-cookie"

export class EditorOptions
{
    private f_reembed_add: boolean = true;
    private f_reembed_remove: boolean = true;
    private f_reembed_swap: boolean = true;

    set_reembed_add(b: boolean)
    {
        this.f_reembed_add = b;
        this.save_to_cookies();
    }
    set_reembed_remove(b: boolean)
    {
        this.f_reembed_remove = b;
        this.save_to_cookies();
    }
    set_reembed_swap(b: boolean)
    {
        this.f_reembed_swap = b;
        this.save_to_cookies();
    }

    reembed_add(): boolean
    {
        return this.f_reembed_add;
    }
    reembed_remove(): boolean
    {
        return this.f_reembed_remove;
    }
    reembed_swap(): boolean
    {
        return this.f_reembed_swap;
    }

    constructor()
    {
        let cookie_str = get_cookie(EDITOR_OPTIONS_COOKIE_NAME);
        if(!cookie_str) return;

        
        let json_ob;
        try{
            json_ob = JSON.parse(cookie_str);
        } catch(e)
        { console.warn("Failed to parse editor options cookie.", e); return; }

        for(let field in this)
        {
            if(field.substring(0,2) == "f_" && field in json_ob)
                // @ts-ignore
                this[field] = json_ob[field];
        }
    }

    save_to_cookies()
    {
        //An awful hack to get around the fact that functions can't be cloned.
        let struct = structuredClone(this) as any;

        let this_as_str = JSON.stringify(struct);
        set_cookie(EDITOR_OPTIONS_COOKIE_NAME, this_as_str, 1000000000);
    }
}