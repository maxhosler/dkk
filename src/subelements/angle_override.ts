import { AngleOverride, AngleOverrideType } from "../draw/dag_layout";
import { Vector2 } from "../util/num";
import { VecSpinner } from "./vec_spinner";

const TYPES: AngleOverrideType[] = ["none", "relative", "absolute", "vec-abs"];
export class AngleOverrideController
{
	base: HTMLElement;
	dropdown: HTMLSelectElement;
	spinner: HTMLInputElement;

	vec_spinner: VecSpinner;

	change_listeners: ((val: AngleOverride) => void)[] = [];

	constructor( name: string, )
	{
		this.base = document.createElement("table");
		this.base.className = "angle-override-table";
		let row = document.createElement("tr");
		this.base.appendChild(row);

		let [col1,col2,col3] = [
			document.createElement("td"),
			document.createElement("td"),
			document.createElement("td"),
		];
		row.appendChild(col1);
		row.appendChild(col2);
		row.appendChild(col3);

		this.dropdown = document.createElement("select");
		this.spinner = document.createElement("input");
		this.vec_spinner = new VecSpinner();

		this.spinner.type = "number";
		this.spinner.step = "5";
		

		col1.innerText = name;
		col2.appendChild(this.dropdown);
		col3.appendChild(this.spinner);
		col3.appendChild(this.vec_spinner.base);

		for(let val of TYPES)
		{
			let opt = document.createElement("option");
			opt.value = val;
			opt.innerText = val;
			if(val == "none")
				opt.innerText = "auto"
			this.dropdown.appendChild(opt);
		}
		this.dropdown.value = "none";

		this.dropdown.addEventListener("change",
			(ev) => {
				this.update();
				this.fire_change_listeners();
			}
		)
		this.spinner.addEventListener("change",
			(ev) => this.fire_change_listeners()
		)
		this.vec_spinner.add_change_listeners(
			(v) => this.fire_change_listeners()
		)
		this.update();
	}

	update()
	{
		if(this.dropdown.value != "relative" && this.dropdown.value != "absolute")
		{
			this.spinner.style.display = "none"
		}
		else
		{
			this.spinner.style.display = "block"
		}

		this.vec_spinner.set_visible(this.dropdown.value == "vec-abs");
	}

	set_value(ov: AngleOverride)
	{
		if (ov.type == "absolute" || ov.type == "relative")
			this.spinner.value = Math.round( ov.inner as number * (-180 / Math.PI) ).toString();
		else
			this.spinner.value = "0";

		if (ov.type == "vec-abs")
		{
			this.vec_spinner.set_value(ov.inner as Vector2)
		} 
		else
		{
			this.vec_spinner.set_value(Vector2.right().scale(0.3))
		}

		this.dropdown.value = ov.type;
		this.update();
	}

	get_value(): AngleOverride
	{
		let angle = 0;
		try
		{
			angle = parseInt(this.spinner.value) * (-Math.PI / 180);
		}
		catch{}

		if(this.dropdown.value == "none")
			return AngleOverride.none();
		if(this.dropdown.value == "relative")
			return AngleOverride.relative(angle);
		if(this.dropdown.value == "absolute")
			return AngleOverride.absolute(angle);
		if(this.dropdown.value == "vec-abs")
			return AngleOverride.vec_abs(this.get_vec())
		throw new Error("Unhandled state.")
	}

	get_vec(): Vector2
	{
		return this.vec_spinner.get_value();
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

	add_change_listeners(
		listener: (val: AngleOverride) => void
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