import { DKKProgram } from "../program";
import { Popup } from "./popup";

export class ShortcutsPopup extends Popup
{
	constructor(base: HTMLElement, data: [string,string][])
	{
		super(base, "Shortcuts", () => {});
		
		let table = document.createElement("table");
		table.id = "shortcuts-table";
		this.popup_body.appendChild(table);
		
		for(let row_data of data)
		{
			let row = document.createElement("tr");
			table.appendChild(row);

			let col1 = document.createElement("td");
			col1.innerText = row_data[0];
			let col2 = document.createElement("td");
			col2.innerText = row_data[1];

			row.appendChild(col1);
			row.appendChild(col2);
		}
	}
}