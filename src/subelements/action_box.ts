import { ShortcutsPopup } from "../popup/shortcuts";

export class ActionBox
{
	box: HTMLDivElement;
	table: HTMLTableElement;

	static create(): { box: ActionBox, element: HTMLDivElement }
	{
		let element = document.createElement("div")
		element.className = "sb-subsection";
		let box = new ActionBox(element);
		return {
			box: box,
			element: element
		}
	}

	private constructor(
		box: HTMLDivElement,
	)
	{
		this.box = box;
		this.table = document.createElement("table");

		this.box.appendChild(this.table);
	}

	add_title(title: string)
	{
		let row = document.createElement("tr");
		let title_elem = document.createElement("div");
		title_elem.className = "actionbox-title"
		title_elem.innerText = title;
		row.appendChild(title_elem);
		this.table.appendChild(row);
	}

	add_tip(tip: string)
	{
		let row = document.createElement("tr");
		let tip_elem = document.createElement("div");
		tip_elem.className = "actionbox-tip"
		tip_elem.innerText = tip;
		row.appendChild(tip_elem);
		this.table.appendChild(row);
	}

	add_button(
		name: string,
		action: () => void
	): HTMLButtonElement
	{
		let row = document.createElement("tr");
		let button = document.createElement("button");
		button.innerText = name;
		button.onclick = (ev) => action();
		row.appendChild(button);
		this.table.appendChild(row);

		return button;
	}

	add_shortcut_popup(main_body: HTMLBodyElement)
	{
		let row = document.createElement("tr");
		let place = document.createElement("td");
		row.appendChild(place);

		let link = document.createElement("a");
		link.innerText = "Shortcuts";
		link.className = "small-link";
		link.onclick = (ev) => new ShortcutsPopup(main_body);
		place.appendChild(link);

		this.table.appendChild(row);
	}

}