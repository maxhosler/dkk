import { caracol_emb, prebuilt_dag_embedding } from "./dag_layout";
import { DrawOptions } from "./draw/draw_options";
import { CliqueViewer } from "./modes/clique_viewer";
import { EmbeddingEditor } from "./modes/embedding_editor";

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

class SettingsPopup extends Popup
{
    parent: DKKProgram;

    simplrend_dropdown: HTMLSelectElement;

    node_radius_spinner: HTMLInputElement;
    edge_weight_spinner: HTMLInputElement;
    route_weight_spinner: HTMLInputElement;
    hasse_weight_spinner: HTMLInputElement;

    reset_button: HTMLButtonElement;

    constructor(base: HTMLElement, parent: DKKProgram)
    {
        super(base, "Settings", () => parent.popup_open = false);
        this.parent = parent;

        let table = document.createElement("table");
        table.className = "settings-table";
        this.popup_body.appendChild(table);

        SettingsPopup.add_title(table, "Size and Weight");

        this.node_radius_spinner = SettingsPopup.add_stepper_row(
            table,
            "Node radius",
            "settings-node-radius",
            (val) => this.parent.draw_options.set_node_radius(val)
        );
        this.edge_weight_spinner = SettingsPopup.add_stepper_row(
            table,
            "Edge weight",
            "settings-edge-weight",
            (val) => this.parent.draw_options.set_edge_weight(val)
        );
        this.route_weight_spinner = SettingsPopup.add_stepper_row(
            table,
            "Route weight",
            "settings-route-weight",
            (val) => this.parent.draw_options.set_route_weight(val)
        );
        this.hasse_weight_spinner = SettingsPopup.add_stepper_row(
            table,
            "Hasse edge weight",
            "settings-hasse-weight",
            (val) => this.parent.draw_options.set_hasse_edge_weight(val)
        );

        SettingsPopup.add_title(table, "Misc.");

        this.simplrend_dropdown = SettingsPopup.add_selector_row(
            table,
            "Simplex mode",
            "settings-simpl-mode",
            [
                ["solid", "solid"],
                ["dots", "dots"],
                ["blank", "blank"]
            ],
            (val) => {
                this.parent.draw_options.set_simplex_render_mode(val);
            }
        );

        this.reset_button = document.createElement("button");
        this.reset_button.onclick = (ev) => this.reset_settings();
        this.reset_button.innerText = "Reset";
        this.reset_button.id = "reset-button";
        this.popup_body.appendChild(this.reset_button);

        this.sync_with_settings();
    }

    reset_settings()
    {
        this.parent.draw_options.reset();
        this.sync_with_settings();
    }

    sync_with_settings()
    {
        this.simplrend_dropdown.value = 
            this.parent.draw_options.simplex_render_mode();
        this.node_radius_spinner.value = 
            this.parent.draw_options.node_radius().toString();
        this.edge_weight_spinner.value = 
            this.parent.draw_options.edge_weight().toString();
        this.route_weight_spinner.value = 
            this.parent.draw_options.route_weight().toString();
        this.hasse_weight_spinner.value = 
            this.parent.draw_options.hasse_edge_weight().toString();
    }

    private static add_stepper_row(
        table: HTMLTableElement,
        name: string,
        id: string,
        onchange: (val: number) => void
    ): HTMLInputElement
    {
        let label = document.createElement("label");
        label.htmlFor = id;
        label.innerText = name;

        let spinner = document.createElement("input");
        spinner.type = "number";
        spinner.id = id;
        spinner.step = "1";
        spinner.min = "1";
        spinner.onclick = (ev) => {
            onchange(parseInt(spinner.value))
        };

        let row = document.createElement("tr");
        let d1 = document.createElement("td");
        let d2 = document.createElement("td");
        row.appendChild(d1);
        row.appendChild(d2);

        d1.appendChild(label);
        d2.appendChild(spinner);

        table.appendChild(row);

        return spinner;
    }

    private static add_selector_row(
        table: HTMLTableElement,
        name: string,
        id: string,
        name_val_pairs: [string, string][],
        onchange: (val: string) => void
    ): HTMLSelectElement
    {
        let label = document.createElement("label");
        label.htmlFor = id;
        label.innerText = name;

        let selector = document.createElement("select");
        selector.id = id;
        for(let pair of name_val_pairs)
        {
            let opt = document.createElement("option");
            opt.value = pair[1];
            opt.innerText = pair[0];
            selector.appendChild(opt);
        }
        selector.addEventListener("change", (ev) => {
            onchange(selector.value)
        });

        let row = document.createElement("tr");
        let d1 = document.createElement("td");
        let d2 = document.createElement("td");
        row.appendChild(d1);
        row.appendChild(d2);

        d1.appendChild(label);
        d2.appendChild(selector);

        table.appendChild(row);

        return selector;
    }

    private static add_title(
        table: HTMLTableElement,
        name: string
    )
    {
        let row = document.createElement("tr");
        let d1 = document.createElement("td");
        let d2 = document.createElement("td");
        row.appendChild(d1);
        row.appendChild(d2);
        table.appendChild(row);

        let title = document.createElement("div");
        title.className = "settings-head";
        title.innerText = name;
        d1.appendChild(title);
    }
}

class DKKProgram
{
    body: HTMLBodyElement;
	draw_options = new DrawOptions(true);
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

        let settings_button: HTMLDivElement = document.getElementById("settings-button") as HTMLDivElement;
		settings_button.onclick = (ev) => {
            this.settings_button_click();
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

    settings_button_click()
    {
        if(this.popup_open) { return; }

        this.popup_open = true;
        let popup = new SettingsPopup(
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

var dkk = new DKKProgram();
