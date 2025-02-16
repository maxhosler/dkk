import { DrawOptions } from "./subelements/dag_canvas";
import { caracol_emb, prebuilt_dag_embedding } from "./dag_layout";
import { CliqueViewer } from "./modes/clique_viewer";
import { EmbeddingEditor } from "./modes/embedding_editor";

type PresetOption = {name: string, idx: number};
const PRESETS: PresetOption[] = [
    {name: "cube", idx: 0},
    {name: "cube-twist", idx: 1},
    {name: "caracol-4", idx: 2},
    {name: "test-c-4", idx: 3},
    {name: "psuedopants", idx: 4}
];

abstract class Popup
{
    close_callback: () => void;

    base: HTMLDivElement;
    window: HTMLDivElement;
    top_bar: HTMLDivElement;
    popup_body: HTMLDivElement;
    xout: HTMLDivElement;
    constructor(body: HTMLElement, title_name: string, close_callback: () => void)
    {
        this.close_callback = close_callback;

        let base = document.createElement("div");
        base.id = "shadow"
        base.className = "fullscreen"
        this.base = base;
        body.appendChild(base);

        let window = document.createElement("div");
        window.className = "popup-window";
        base.appendChild(window);
        this.window = window;

        let top_bar = document.createElement("div");
        top_bar.className = "popup-top-bar";
        window.appendChild(top_bar);
        this.top_bar = top_bar;

        let title = document.createElement("h3");
        title.innerText = title_name;
        top_bar.appendChild(title);

        let xout = document.createElement("div");
        xout.className = "popup-xout";
        xout.innerText = "X";
        xout.onclick = () => {
            this.close()
        };
        top_bar.appendChild(xout);
        this.xout = xout;

        let popup_body = document.createElement("div");
        popup_body.className = "popup-body";
        this.window.appendChild(popup_body);
        this.popup_body = popup_body;
        
    }

    close()
    {
        this.base.remove();
        this.close_callback();
    }
}

class OpenPopup extends Popup
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

class DKKProgram
{
    body: HTMLBodyElement;
	draw_options = new DrawOptions();
	mode: CliqueViewer | EmbeddingEditor = CliqueViewer.destructive_new(
		prebuilt_dag_embedding(0),
		this.draw_options
	);
    popup_open: boolean = false;

	constructor()
	{
        this.body = document.getElementsByTagName("body")[0] as HTMLBodyElement;
		let open_button: HTMLDivElement = document.getElementById("open-button") as HTMLDivElement;
		open_button.onclick = (ev) => {
            this.open_button_click();
		};
	}

    open_button_click()
    {
        if(this.popup_open) { return; }

        this.popup_open = true;
        let popup = new OpenPopup(
            this.body,
            this
        );
    }

	set_clique_viewer(idx: number)
	{
		var layout = prebuilt_dag_embedding(idx);
		this.mode = CliqueViewer.destructive_new(layout, this.draw_options);
	}
}

let dkk = new DKKProgram();
