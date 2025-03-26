import { FramedDAGEmbedding } from "../draw/dag_layout";
import { DKKProgram } from "../program";
import { preset_dag_embedding, PRESETS } from "../preset";
import { Popup } from "./popup";
import { JSONCliqueData } from "../modes/clique_viewer";

/*
Popup for opening saved data.

The OpenPopup itself is not directly constructed;
instead it is inherited by a version for the CliqueViewer
and the EmbeddingEditor. Currently, the latter adds nothing
to the base, but this is done for symmetry and future extensibility.
*/

export class OpenPopup extends Popup
{
	error_div: HTMLDivElement;
	table: HTMLTableElement;
	preset_dropdown: HTMLSelectElement;

	parent: DKKProgram;
	constructor(base: HTMLElement, parent: DKKProgram)
	{
		super(base, "Open", () => parent.popup_open = false);
		this.parent = parent;

		this.error_div = document.createElement("div");
		this.error_div.id = "open-error-zone";
		this.popup_body.appendChild(this.error_div);

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
		
		//Create normal file-opening option.
		let file_open = document.createElement("input");
		file_open.type = "file";
		file_open.accept = "json";
		file_open.addEventListener("change", async () => {
			//only run if exactly 1 file is selected.
			if (file_open.files && file_open.files.length == 1) {
				//Get first file
				let file = file_open.files[0];
				let reader = new FileReader();

				//when successfully read, parse JSON.
				//If malformed, show error. Otherwise, close and load.
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

	//Add row to internal table; text is label, element1 and element2 are the 
	//elements of the next columns
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

	//Shows error as red text.
	show_err(err: string)
	{
		this.error_div.innerText = err;
	}
}

export class EEOpenPopup extends OpenPopup
{
	constructor(base: HTMLElement, parent: DKKProgram)
	{
		super(base, parent)
	}
}

//This adds the additional option to load DAG with precomputed data.
export class CVOpenPopup extends OpenPopup
{
	constructor(base: HTMLElement, parent: DKKProgram)
	{
		super(base, parent);

		//This is the precompted file opener
		let file_open = document.createElement("input");
		file_open.type = "file";
		file_open.accept = "json";
		file_open.addEventListener("change", async () => {
			//Functions exactly the same as above, 
			//Just with a different parsing function.
			if (file_open.files && file_open.files.length == 1) {
				let file = file_open.files[0];
				let reader = new FileReader();
				reader.onload = () => {
					let res: Object;
					try{
						res = JSON.parse(reader.result as string);
					}
					catch
					{
						this.show_err("Invalid JSON.");
						return;
					}

					this.parent.set_dag_precomp(res as JSONCliqueData);
					this.close();

				};
				reader.onerror = () =>
				{
					this.show_err(reader.error?.message as string)
				};
				reader.readAsText(file);
			}
		});
		this.add_row("From file (precomputed)", file_open, null);
	}
}
