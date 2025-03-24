import { Popup } from "./popup";

/*
This is the only current Popup object not constructed
by the DKKProgram object; instead, these are used in the
EmbeddingEditor to list keyboard shortcuts.

The "data" argument is a list of pairs of strings; the first
is the action and the second is the keyboard shortcut.

Each will be a row in a table in the resulting Popup.
*/

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