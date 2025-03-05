import { AngleOverride, AngleOverrideType } from "../draw/dag_layout";

const TYPES: AngleOverrideType[] = ["none", "relative", "absolute"];
export class AngleOverrideController
{
	base: HTMLElement;
	dropdown: HTMLSelectElement;
	spinner: HTMLInputElement;

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
		this.spinner.type = "number";
		this.spinner.step = "5";
		
		col1.innerText = name;
		col2.appendChild(this.dropdown);
		col3.appendChild(this.spinner);

		for(let val of TYPES)
		{
			let opt = document.createElement("option");
			opt.value = val;
			opt.innerText = val;
			if(val == "none")
				opt.innerText = "default"
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
		this.update();
	}

	update()
	{
		if(this.dropdown.value == "none")
		{
			this.spinner.style.display = "none"
		}
		else
		{
			this.spinner.style.display = "block"
		}
	}

	set_value(ov: AngleOverride)
	{
		this.spinner.value = Math.round( ov.angle * (180 / Math.PI) ).toString();
		this.dropdown.value = ov.type;
		this.update();
	}

	get_value(): AngleOverride
	{
		let angle = 0;
		try
		{
			angle = parseInt(this.spinner.value) * (Math.PI / 180);
		}
		catch{}

		return new AngleOverride(
			this.dropdown.value as AngleOverrideType,
			angle
		);
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