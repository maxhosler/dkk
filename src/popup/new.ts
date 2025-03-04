import { DKKProgram } from "../main";
import { Popup } from "./popup";

export class NewPopup extends Popup
{
	input: HTMLInputElement;

	parent: DKKProgram;
	constructor(base: HTMLElement, parent: DKKProgram)
	{
		super(base, "New", () => parent.popup_open = false);
		this.parent = parent;

		let table = document.createElement("table");
		let row = document.createElement("tr");
		let col1 = document.createElement("td");
		let col2 = document.createElement("td");
		let col3 = document.createElement("td");

		this.popup_body.appendChild(table);
		table.appendChild(row);
		row.appendChild(col1);
		row.appendChild(col2);
		row.appendChild(col3);

		let label = document.createElement("label");
		label.htmlFor = "new-num";
		label.innerText = "Number of vertices";
		col1.appendChild(label);

		this.input = document.createElement("input");
		this.input.type = "number";
		this.input.value = "4";
		this.input.min = "1";
		this.input.id = "new-num";
		col2.appendChild(this.input);
		
		let button = document.createElement("button");
		button.innerText = "Create";
		button.onclick = (ev) => {
			this.done();
		};
		col3.appendChild(button);
	}

	done()
	{
		let num = parseInt(this.input.value);
		this.close();
		this.parent.set_new_clique(num);
	}
}