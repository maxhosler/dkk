import { DKKProgram } from "../main";
import { Popup } from "./popup";

type PresetOption = {name: string, idx: number};
const PRESETS: PresetOption[] = [
	{name: "cube", idx: 0},
	{name: "cube-twist", idx: 1},
	{name: "square", idx: 5},
	{name: "caracol-4", idx: 2},
	{name: "caracol-5", idx: 6},
	{name: "test-c-4", idx: 3},
	{name: "psuedopants", idx: 4}
];


export class OpenPopup extends Popup
{
	table: HTMLTableElement;
	preset_dropdown: HTMLSelectElement;

	parent: DKKProgram;
	constructor(base: HTMLElement, parent: DKKProgram)
	{
		super(base, "Open", () => parent.popup_open = false);
		this.parent = parent;

		let table = document.createElement("table");
		this.popup_body.appendChild(table);
		this.table = table;

		let preset_dropdown = document.createElement("select");
		for(let preset of PRESETS)
		{
			let opt = document.createElement("option");
			opt.value = preset.idx.toString();
			opt.innerText = preset.name;
			preset_dropdown.appendChild(opt);
		}
		this.preset_dropdown = preset_dropdown;

		let preset_button = document.createElement("button");
		preset_button.innerText = "Open";
		preset_button.onclick = () => this.load_preset();
		this.add_row("From preset", preset_dropdown, preset_button)
	}

	load_preset()
	{
		let idx = Number.parseInt(this.preset_dropdown.value);
		this.parent.set_clique_viewer(idx);
		this.close();
	}

	add_row(text: string, element1: HTMLElement | null, element2: HTMLElement | null)
	{
		let row = document.createElement("tr");
		
		let id = "option-"+text;

		let name = document.createElement("td");
		let name_label = document.createElement("label");
		name_label.htmlFor = id;
		name_label.innerText = text;
		name.appendChild(name_label);
		row.appendChild(name);

		let control1 = document.createElement("td");
		if(element1) {
			element1.id = id;
			control1.appendChild(element1);
		}
		row.appendChild(control1);

		let control2 = document.createElement("td");
		if(element2)
		{
			control2.appendChild(element2);
		}
		row.appendChild(control2);

		this.table.appendChild(row);
	}
}
