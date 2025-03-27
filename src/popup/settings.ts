import { DKKProgram } from "../program";
import { Popup } from "./popup";

/*
This is the popup that allows you to change the settings
stored in the DrawOptions object.
*/

export class SettingsPopup extends Popup
{
	parent: DKKProgram;

	reset_button: HTMLButtonElement;
	column_holder: HTMLTableRowElement;

	/*
	This is the list of functions which read the
	contents of the DrawOptions object into the
	input elements when they need to be updated
	*/
	get_funcs: (() => void)[] = [];

	constructor(base: HTMLElement, parent: DKKProgram)
	{
		super(base, "Settings", () => parent.popup_open = false);
		this.parent = parent;

		//Create table
		let base_table = document.createElement("table");
		base_table.className = "settings-column-table";
		this.column_holder = document.createElement("tr");
		this.popup_body.appendChild(base_table);
		base_table.appendChild(this.column_holder);

		//FIRST COLUMN
		this.add_column();
		this.add_title("DAG");

		this.add_stepper_row(
			"Vertex radius",
			"settings-vert-radius",
			(val) => this.parent.draw_options.set_vert_radius(val),
			() => this.parent.draw_options.vert_radius()
		);
		this.add_stepper_row(
			"Edge weight",
			"settings-edge-weight",
			(val) => this.parent.draw_options.set_edge_weight(val),
			() => this.parent.draw_options.edge_weight()
		);
		this.add_stepper_row(
			"Route weight",
			"settings-route-weight",
			(val) => this.parent.draw_options.set_route_weight(val),
			() => this.parent.draw_options.route_weight()
		);
		this.add_checkbox_row(
			"Framing labels",
			"settings-labels-cb",
			(val) => this.parent.draw_options.set_label_framing(val),
			() => this.parent.draw_options.label_framing()
		)
		this.add_checkbox_row(
			"Direction arrows",
			"settings-arrows-cb",
			(val) => this.parent.draw_options.set_arrows(val),
			() => this.parent.draw_options.arrows()
		)
		this.add_checkbox_row(
			"Show exceptional routes",
			"settings-exceptional-cb",
			(val) => this.parent.draw_options.set_show_exceptional(val),
			() => this.parent.draw_options.show_exceptional()
		)

		this.add_title("Hasse diagram");

		this.add_stepper_row(
			"Hasse edge weight",
			"settings-hasse-weight",
			(val) => this.parent.draw_options.set_hasse_edge_weight(val),
			() => this.parent.draw_options.hasse_edge_weight()
		);
		this.add_stepper_row(
			"Hasse node size",
			"settings-hasse-node-size",
			(val) => this.parent.draw_options.set_hasse_node_size(val),
			() => this.parent.draw_options.hasse_node_size()
		)
		this.add_checkbox_row(
			"Show cliques as nodes",
			"settings-hasse-cliques",
			(b) => this.parent.draw_options.set_hasse_show_cliques(b),
			() => this.parent.draw_options.hasse_show_cliques()
		);
		this.add_stepper_row(
			"Clique size",
			"settings-h-clique-size",
			(val) => this.parent.draw_options.set_hasse_mini_dag_size(val),
			() => this.parent.draw_options.hasse_mini_dag_size()
		);
		this.add_stepper_row(
			"Vertex size",
			"settings-h-vertex-size",
			(val) => this.parent.draw_options.set_hasse_mini_vert_rad(val),
			() => this.parent.draw_options.hasse_mini_vert_rad()
		);
		this.add_stepper_row(
			"Route weight",
			"settings-h-route-weight",
			(val) => this.parent.draw_options.set_hasse_mini_route_weight(val),
			() => this.parent.draw_options.hasse_mini_route_weight()
		);

		//SECOND COLUMN
		this.add_column();
		this.add_title("Polytope");
		this.add_selector_row(
			"Simplex mode",
			"settings-simpl-mode",
			[
				["solid", "solid"],
				["dots", "dots"],
				["blank", "blank"]
			],
			(val) => {
				this.parent.draw_options.set_simplex_render_mode(val);
			},
			() => this.parent.draw_options.simplex_render_mode()
		);
		this.add_checkbox_row(
			"Draw dots on top",
			"settings-dots-on-top",
			(b) => this.parent.draw_options.set_dot_on_top(b),
			() => this.parent.draw_options.dot_on_top()
		);
		this.add_checkbox_row(
			"Shade dots",
			"settings-dots-shade",
			(b) => this.parent.draw_options.set_dot_shade(b),
			() => this.parent.draw_options.dot_shade()
		);
		this.add_stepper_row(
			"Dot radius",
			"settings-dot-radius",
			(v) => this.parent.draw_options.set_dot_radius(v),
			() => this.parent.draw_options.dot_radius()
		);

		this.add_title("Brick diagram");
		//TODO:


		//THIRD COLUMN
		this.add_column();
		this.add_title("Colors");

		this.add_color_row(
			"Vertex color",
			"settings-vert-color",
			(val) => {
				this.parent.draw_options.set_vertex_color(val);
			},
			() => this.parent.draw_options.vertex_color()
		);
		this.add_color_row(
			"Edge color",
			"settings-edge-color",
			(val) => {
				this.parent.draw_options.set_edge_color(val);
			},
			() => this.parent.draw_options.edge_color()
		);
		this.add_color_row(
			"Background color",
			"settings-bg-color",
			(val) => {
				this.parent.draw_options.set_background_color(val);
			},
			() => this.parent.draw_options.background_color()
		);
		this.add_color_row(
			"Polytope color",
			"settings-polytope-color",
			(val) => {
				this.parent.draw_options.set_polytope_color(val);
			},
			() => this.parent.draw_options.polytope_color()
		);
		this.add_color_row(
			"Simplex color",
			"settings-simplex-color",
			(val) => {
				this.parent.draw_options.set_simplex_color(val);
			},
			() => this.parent.draw_options.simplex_color()
		);
		this.add_color_row(
			"Up-brick color",
			"settings-upbrick-color",
			(val) => {
				this.parent.draw_options.set_up_brick_color(val);
			},
			() => this.parent.draw_options.up_brick_color()
		);
		this.add_color_row(
			"Down-brick color",
			"settings-downbrick-color",
			(val) => {
				this.parent.draw_options.set_down_brick_color(val);
			},
			() => this.parent.draw_options.down_brick_color()
		);
		this.add_color_row(
			"Brick compat. color",
			"settings-brickcompat-color",
			(val) => {
				this.parent.draw_options.set_brick_compat_edge_color(val);
			},
			() => this.parent.draw_options.brick_compat_edge_color()
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
		for(let f of this.get_funcs)
			f();
	}

	private add_column(): HTMLTableElement
	{
		let col = document.createElement("td");
		this.column_holder.appendChild(col);
		let table = document.createElement("table");
		table.className = "settings-table";
		col.appendChild(table)
		return table;
	}

	private get_last_column(): HTMLTableElement
	{
		if(!this.column_holder.lastChild || !this.column_holder.lastChild.lastChild)
			return this.add_column();
		return this.column_holder.lastChild.lastChild as HTMLTableElement;
	}

	/*
	Each of these add_something_row methods follow a common pattern:
	add to the current last column of this.column_holder an input element
	of the relevant type, with a label given by "name" and the input element
	having id "id". the "onchange" method is to take the current value
	and put it into the DrawOptions object; the "getter" method does the opposite,
	writing the relevant value from DrawOptions into the input element.

	It returns the HTMLInputElement so it can be stored.
	*/

	//This is for number inputs.
	private add_stepper_row(
		name: string,
		id: string,
		onchange: (val: number) => void,
		getter: () => number
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

		this.get_last_column().appendChild(row);

		this.get_funcs.push(
			() => spinner.value = getter().toString()
		);

		return spinner;
	}

	//This is for selectors (dropdown menus)
	private add_selector_row(
		name: string,
		id: string,
		name_val_pairs: [string, string][],
		onchange: (val: string) => void,
		getter: () => string
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

		this.get_last_column().appendChild(row);

		this.get_funcs.push(
			() => selector.value = getter()
		);

		return selector;
	}

	//This is for color selectors
	private add_color_row(
		name: string,
		id: string,
		onchange: (val: string) => void,
		getter: () => string
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

		this.get_last_column().appendChild(row);

		this.get_funcs.push(
			() => colorsel.value = getter()
		);

		return colorsel;
	}

	//And this is for checkboxes!
	private add_checkbox_row(
		name: string,
		id: string,
		onchange: (val: boolean) => void,
		getter: () => boolean
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

		this.get_last_column().appendChild(row);

		this.get_funcs.push(
			() => tickbox.checked = getter()
		)

		return tickbox;
	}

	//This adds a title for different sections in the column.
	//Similar idea as above, although it isn't an input element.
	private add_title(
		name: string
	)
	{
		let row = document.createElement("tr");
		let d1 = document.createElement("td");
		let d2 = document.createElement("td");
		row.appendChild(d1);
		row.appendChild(d2);
		this.get_last_column().appendChild(row);

		let title = document.createElement("div");
		title.className = "settings-head";
		title.innerText = name;
		d1.appendChild(title);
	}
}
