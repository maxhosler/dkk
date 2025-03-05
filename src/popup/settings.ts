import { DKKProgram } from "../main";
import { Popup } from "./popup";

export class SettingsPopup extends Popup
{
	parent: DKKProgram;

	vert_radius_spinner: HTMLInputElement;
	edge_weight_spinner: HTMLInputElement;
	route_weight_spinner: HTMLInputElement;
	label_checkbox: HTMLInputElement;
	arrow_checkbox: HTMLInputElement;

	hasse_weight_spinner: HTMLInputElement;
	hasse_show_clique_cb: HTMLInputElement;
	hasse_clique_spinner: HTMLInputElement;
	hasse_vert_spinner: HTMLInputElement;
	hasse_route_spinner: HTMLInputElement;

	simplrend_dropdown: HTMLSelectElement;
	dot_on_top_cb: HTMLInputElement;
	dot_shade_cb: HTMLInputElement;
	dot_radius_spinner: HTMLInputElement;

	vertex_color_selector: HTMLInputElement;
	background_color_selector: HTMLInputElement;
	polytope_color_selector: HTMLInputElement;
	simplex_color_selector: HTMLInputElement;

	reset_button: HTMLButtonElement;

	constructor(base: HTMLElement, parent: DKKProgram)
	{
		super(base, "Settings", () => parent.popup_open = false);
		this.parent = parent;

		let base_table = document.createElement("table");
		base_table.className = "settings-column-table";
		let column_holder = document.createElement("tr");
		this.popup_body.appendChild(base_table);
		base_table.appendChild(column_holder);

		let col1 = document.createElement("td");
		let col2 = document.createElement("td");
		column_holder.appendChild(col1);
		column_holder.appendChild(col2);

		//FIRST COLUMN
		let col1_table = document.createElement("table");
		col1_table.className = "settings-table";
		col1.appendChild(col1_table);

		SettingsPopup.add_title(col1_table, "DAG");

		this.vert_radius_spinner = SettingsPopup.add_stepper_row(
			col1_table,
			"Vertex radius",
			"settings-vert-radius",
			(val) => this.parent.draw_options.set_vert_radius(val)
		);
		this.edge_weight_spinner = SettingsPopup.add_stepper_row(
			col1_table,
			"Edge weight",
			"settings-edge-weight",
			(val) => this.parent.draw_options.set_edge_weight(val)
		);
		this.route_weight_spinner = SettingsPopup.add_stepper_row(
			col1_table,
			"Route weight",
			"settings-route-weight",
			(val) => this.parent.draw_options.set_route_weight(val)
		);
		this.label_checkbox = SettingsPopup.add_tickbox_row(
			col1_table,
			"Framing labels",
			"settings-labels-cb",
			(val) => this.parent.draw_options.set_label_framing(val)
		)
		this.arrow_checkbox = SettingsPopup.add_tickbox_row(
			col1_table,
			"Direction arrows",
			"settings-arrows-cb",
			(val) => this.parent.draw_options.set_arrows(val)
		)

		SettingsPopup.add_title(col1_table, "Hasse diagram");

		this.hasse_weight_spinner = SettingsPopup.add_stepper_row(
			col1_table,
			"Hasse edge weight",
			"settings-hasse-weight",
			(val) => this.parent.draw_options.set_hasse_edge_weight(val)
		);
		this.hasse_show_clique_cb = SettingsPopup.add_tickbox_row(
			col1_table,
			"Show cliques as nodes",
			"settings-hasse-cliques",
			(b) => this.parent.draw_options.set_hasse_show_cliques(b)
		);
		this.hasse_clique_spinner = SettingsPopup.add_stepper_row(
			col1_table,
			"Clique size",
			"settings-h-clique-size",
			(val) => this.parent.draw_options.set_hasse_mini_dag_size(val)
		);
		this.hasse_vert_spinner = SettingsPopup.add_stepper_row(
			col1_table,
			"Vertex size",
			"settings-h-vertex-size",
			(val) => this.parent.draw_options.set_hasse_mini_vert_rad(val)
		);
		this.hasse_route_spinner = SettingsPopup.add_stepper_row(
			col1_table,
			"Route weight",
			"settings-h-route-weight",
			(val) => this.parent.draw_options.set_hasse_mini_route_weight(val)
		);
		

		SettingsPopup.add_title(col1_table, "Polytope");

		this.simplrend_dropdown = SettingsPopup.add_selector_row(
			col1_table,
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
		this.dot_on_top_cb = SettingsPopup.add_tickbox_row(
			col1_table,
			"Draw dots on top",
			"settings-dots-on-top",
			(b) => this.parent.draw_options.set_dot_on_top(b)
		);
		this.dot_shade_cb = SettingsPopup.add_tickbox_row(
			col1_table,
			"Shade dots",
			"settings-dots-shade",
			(b) => this.parent.draw_options.set_dot_shade(b)
		);
		this.dot_radius_spinner = SettingsPopup.add_stepper_row(
			col1_table,
			"Dot radius",
			"settings-dot-radius",
			(v) => this.parent.draw_options.set_dot_radius(v)
		)

		//SECOND COLUMN
		let col2_table = document.createElement("table");
		col2_table.className = "settings-table";
		col2.appendChild(col2_table);

		SettingsPopup.add_title(col2_table, "Colors");

		this.vertex_color_selector = SettingsPopup.add_color_row(
			col2_table,
			"Vertex color",
			"settings-vert-color",
			(val) => {
				this.parent.draw_options.set_vertex_color(val);
			}
		);
		this.background_color_selector = SettingsPopup.add_color_row(
			col2_table,
			"Background color",
			"settings-bg-color",
			(val) => {
				this.parent.draw_options.set_background_color(val);
			}
		);
		this.polytope_color_selector = SettingsPopup.add_color_row(
			col2_table,
			"Polytope color",
			"settings-polytope-color",
			(val) => {
				this.parent.draw_options.set_polytope_color(val);
			}
		);
		this.simplex_color_selector = SettingsPopup.add_color_row(
			col2_table,
			"Simplex color",
			"settings-simplex-color",
			(val) => {
				this.parent.draw_options.set_simplex_color(val);
			}
		);

		//RESET BUTTON
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
		this.vert_radius_spinner.value = 
			this.parent.draw_options.vert_radius().toString();
		this.edge_weight_spinner.value = 
			this.parent.draw_options.edge_weight().toString();
		this.route_weight_spinner.value = 
			this.parent.draw_options.route_weight().toString();
		this.label_checkbox.checked = 
			this.parent.draw_options.label_framing();
		this.arrow_checkbox.checked = 
			this.parent.draw_options.arrows();

		this.hasse_weight_spinner.value = 
			this.parent.draw_options.hasse_edge_weight().toString();
		this.hasse_show_clique_cb.checked = 
			this.parent.draw_options.hasse_show_cliques();
		this.hasse_clique_spinner.value = 
			this.parent.draw_options.hasse_mini_dag_size().toString();    
		this.hasse_vert_spinner.value = 
			this.parent.draw_options.hasse_mini_vert_rad().toString();
		this.hasse_route_spinner.value = 
			this.parent.draw_options.hasse_mini_route_weight().toString();

		this.vertex_color_selector.value = 
			this.parent.draw_options.vertex_color();
		this.background_color_selector.value = 
			this.parent.draw_options.background_color();
		this.polytope_color_selector.value = 
			this.parent.draw_options.polytope_color();
		this.simplex_color_selector.value = 
			this.parent.draw_options.simplex_color();

		this.dot_on_top_cb.checked =
			this.parent.draw_options.dot_on_top();
		this.dot_shade_cb.checked =
			this.parent.draw_options.dot_shade();
		this.dot_radius_spinner.value = 
			this.parent.draw_options.dot_radius().toString();
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
		spinner.addEventListener("change", (ev) => {
			onchange(parseInt(spinner.value))
		});

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

	private static add_color_row(
		table: HTMLTableElement,
		name: string,
		id: string,
		onchange: (val: string) => void
	): HTMLInputElement
	{
		let label = document.createElement("label");
		label.htmlFor = id;
		label.innerText = name;

		let colorsel = document.createElement("input");
		colorsel.type = "color";
		colorsel.id = id;
		colorsel.addEventListener("change", (ev) => {
			onchange(colorsel.value)
		});

		let row = document.createElement("tr");
		let d1 = document.createElement("td");
		let d2 = document.createElement("td");
		row.appendChild(d1);
		row.appendChild(d2);

		d1.appendChild(label);
		d2.appendChild(colorsel);

		table.appendChild(row);

		return colorsel;
	}

	private static add_tickbox_row(
		table: HTMLTableElement,
		name: string,
		id: string,
		onchange: (val: boolean) => void
	): HTMLInputElement
	{
		let label = document.createElement("label");
		label.htmlFor = id;
		label.innerText = name;

		let tickbox = document.createElement("input");
		tickbox.type = "checkbox";
		tickbox.id = id;
		tickbox.addEventListener("change", (ev) => {
			onchange(tickbox.checked)
		});

		let row = document.createElement("tr");
		let d1 = document.createElement("td");
		let d2 = document.createElement("td");
		row.appendChild(d1);
		row.appendChild(d2);

		d1.appendChild(label);
		d2.appendChild(tickbox);

		table.appendChild(row);

		return tickbox;
	}
}
