import { FramedDAGEmbedding } from "../draw/dag_layout";
import { DKKProgram } from "../main";
import { preset_dag_embedding, PRESETS } from "../preset";
import { Popup } from "./popup";

export class CVOpenPopup extends Popup
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
			opt.value = preset.name;
			opt.innerText = preset.name;
			preset_dropdown.appendChild(opt);
		}
		this.preset_dropdown = preset_dropdown;

		let preset_button = document.createElement("button");
		preset_button.innerText = "Open";
		preset_button.onclick = () => this.load_preset();
		this.add_row("From preset", preset_dropdown, preset_button);
		
		let file_open = document.createElement("input");
		file_open.type = "file";
		file_open.accept = "json";
		file_open.addEventListener("change", async () => {
			if (file_open.files)
			if (file_open.files.length == 1) {
				let file = file_open.files[0];
				let reader = new FileReader();
				reader.onload = () => {
					let fe = FramedDAGEmbedding.from_json(reader.result as string);
					if(fe.is_err())
					{
						this.show_err(fe.error().err_message);
						return;
					}

					this.parent.set_dag(fe.unwrap());
					this.close();

				};
				reader.onerror = () =>
				{
					this.show_err(reader.error?.message as string)
				};
				reader.readAsText(file);
			}
		});
		this.add_row("From file", file_open, null);
	}

	load_preset()
	{
		let name = this.preset_dropdown.value;
		this.parent.set_dag(preset_dag_embedding(name));
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

	show_err(err: string)
	{
		console.log(err);
		//TODO:
	}
}
