import { Vector2 } from "../util/num";

export class VecSpinner
{
    base: HTMLDivElement;
    spinner1: HTMLInputElement;
    spinner2: HTMLInputElement;

    change_listeners: ((val: Vector2) => void)[] = [];
    
    constructor()
    {
        this.base = document.createElement("div");
        this.spinner1 = document.createElement("input");
        this.spinner2 = document.createElement("input");
        
        for(let spn of [this.spinner1, this.spinner2])
        {
            spn.type = "number";
            spn.value = "0";
            spn.step = "0.05";
        }

        this.base.appendChild(this.spinner1);
        this.base.appendChild(this.spinner2);

        this.spinner1.addEventListener("change",
            (v) => this.fire_change_listeners()
        )
        this.spinner2.addEventListener("change",
            (v) => this.fire_change_listeners()
        )
    }

	set_visible(bool: boolean)
	{
		if(bool)
		{
			this.base.style.display = "";
		}
		else
		{
			this.base.style.display = "none"
		}
	}

    get_value(): Vector2
    {
        return new Vector2(
            parseFloat(this.spinner1.value),
            -parseFloat(this.spinner2.value)
        )
    }

    set_value(v: Vector2)
    {
        this.spinner1.value = v.x.toString();
        this.spinner2.value = (-v.y).toString();
    }

    add_change_listeners(
        listener: (val: Vector2) => void
    )
    {
        this.change_listeners.push(listener);
    }

    fire_change_listeners()
	{
		for(let f of this.change_listeners)
			f(this.get_value())
	}
}