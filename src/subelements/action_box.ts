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

	add_dual_spinner(
		name1: string,
		id1: string,
		minmax1: [number, number],
		action1: (val: number) => void,
		name2: string,
		id2: string,
		minmax2: [number, number],
		action2: (val: number) => void
	): {row: HTMLTableRowElement, spinner1: HTMLInputElement, spinner2: HTMLInputElement}
	{
		let row = document.createElement("tr");
		let table = document.createElement("table")
		row.appendChild(table);
		this.table.appendChild(row);

		let label1 = document.createElement("label");
		label1.htmlFor = id1;
		label1.innerText = name1;
		let label2 = document.createElement("label");
		label2.htmlFor = id2;
		label2.innerText = name2;

		let spinner1 = document.createElement("input");
		spinner1.type = "number";
		spinner1.addEventListener("change", (ev) => {
			action1(parseInt(spinner1.value))
		});
		spinner1.min = minmax1[0].toString();
		spinner1.max = minmax1[1].toString();

		let spinner2 = document.createElement("input");
		spinner2.type = "number";
		spinner2.addEventListener("change", (ev) => {
			action2(parseInt(spinner2.value))
		});
		spinner2.min = minmax2[0].toString();
		spinner2.max = minmax2[1].toString();

		let subrow1 = document.createElement("tr");
		let subcol11 = document.createElement("td");
		let subcol12 = document.createElement("td");
		subrow1.appendChild(subcol11);
		subrow1.appendChild(subcol12);

		let subrow2 = document.createElement("tr");
		let subcol21 = document.createElement("td");
		let subcol22 = document.createElement("td");
		subrow2.appendChild(subcol21);
		subrow2.appendChild(subcol22);

		table.appendChild(subrow1);
		table.appendChild(subrow2);

		subcol11.appendChild(label1);
		subcol12.appendChild(spinner1);

		subcol21.appendChild(label2);
		subcol22.appendChild(spinner2);

		return {row, spinner1, spinner2}
	}

	add_shortcut_popup(data: [string, string][])
	{
		let main_body = document.getElementsByTagName("body")[0] as HTMLBodyElement;

		let row = document.createElement("tr");
		let place = document.createElement("td");
		row.appendChild(place);

		let link = document.createElement("a");
		link.innerText = "Shortcuts";
		link.className = "small-link";
		link.onclick = (ev) => new ShortcutsPopup(main_body, data);
		place.appendChild(link);

		this.table.appendChild(row);
	}

}