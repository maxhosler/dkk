import { get_cookie, set_cookie } from "../util/cookie";
import { get_colors } from "./colors";

/*
This object stores all the settings relevant to how things are displayed.
It is stored in a JSON-string cookie so that the editor remember selections.

This class has some quirks. Fields starting with "f_" are automatically saved
to and loaded from the JSON object, and no others.

The protocol for adding a new field is the following:
1. Choose a name, say "XYZ".
2. Create a private field called f_XYZ
3. Create a getter function just called XYZ() which returns the relevant value.
4. Create a setter function called get_XYZ() which sets the relevant value and then calls on_change().
*/

const DRAW_OPTIONS_COOKIE_NAME: string = "draw-options-cookie"

type SimplexRenderMode = "solid" | "dots" | "blank";
type ColorSchemeMode = "computed";
export class DrawOptions
{
	private f_scale: number = 200;
	
	private f_scheme_mode: {mode: ColorSchemeMode, index: number} = {mode: "computed", index:2};

	//DAG
	private f_edge_weight: number = 6;
	private f_vert_radius: number = 12;
	private f_route_weight: number = 8;
	private f_edge_halo: number = 6; //Not in settings
	private f_label_framing: boolean = true;
	private f_arrows: boolean = true;
	private f_show_exceptional: boolean = true;

	//HASSE
	private f_hasse_edge_weight: number = 10;
	private f_hasse_show_cliques: boolean = true;
	private f_hasse_node_size: number = 10;
	private f_hasse_mini_dag_size: number = 300;
	private f_hasse_mini_vert_rad: number = 8;
	private f_hasse_mini_route_weight: number = 6;
	private f_hasse_padding: number = 70;
	private f_hasse_select_halo: number = 15;

	//POLYTOPE
	private f_simplex_render_mode: SimplexRenderMode = "dots";
	private f_dot_shade: boolean = false;
	private f_dot_on_top: boolean = true;
	private f_dot_radius: number = 5;
	
	//EDITOR
	private f_tangent_handle_size: number = 8;
	private f_tangent_arm_weight: number = 5;

	//BRICK
	private f_up_brick_color: string = '#00ff00';
	private f_down_brick_color: string = '#ffff00';
	private f_brick_compat_edge_color: string = '#ffff00';
	private f_bad_highlight_color: string = '#ff0000';
	private f_good_highlight_color: string = '#add8e6';

	private f_brick_width: number = 20;
	private f_brick_draw_compat_edges: boolean = true;
	private f_make_hasse_diagram_bricks: boolean = false; //TODO: make this functionality
	private f_draw_all_downbricks: boolean = true;
	private f_draw_brick_of_highlighted_route: boolean = false;
	private f_draw_brick_of_highlighted_brick: boolean = true;

	//COLORS
	private f_background_color: string = "#b0b0b0";
	private f_vertex_color: string = "#000000";
	private f_polytope_color: string = "#de5ed4";
	private f_simplex_color: string = "#c9e8f4";
	private f_edge_color: string = "#222222"; 
	private f_hasse_current_color: string = "#cdcdcd"; //Not in settings
	private f_hasse_node_color: string = "#000000";
	
	//Not settable
	private f_handle_color: string = "#9a50d3";
	private f_selection_color: string = "#2160c487";
	private f_hasse_bad_edge_color: string = "#ff0000";

	//AUXILIARY
	private change_listeners: (()=>void)[] = [];
	private do_sync_css: boolean;

	/*
	This constructor does nothing if the two boolean flags are set to
	false. This is used to get a 'dummy' copy of DrawOptions to copy default 
	values from.

	If load_from_cookies is true, then it tries to load the JSON cookie and
	copy in the values from it. It does nothing if this fails.

	If sync_css is true, it will try to, you guessed it, sync certain values
	into the current CSS style.
	*/
	constructor(load_from_cookies: boolean, sync_css: boolean)
	{
		this.do_sync_css = sync_css;
		if(!load_from_cookies){
			this.sync_css();
			return
		};
		let cookie_str = get_cookie(DRAW_OPTIONS_COOKIE_NAME);
		if(!cookie_str) return;

		
		let json_ob;
		try{
			json_ob = JSON.parse(cookie_str);
		} catch(e)
		{ console.warn("Failed to parse draw options cookie.", e); return; }

		for(let field in this)
		{
			if(field.substring(0,2) == "f_" && field in json_ob)
				// @ts-ignore
				this[field] = json_ob[field];
		}
	
		this.sync_css();
	}

	//Saves object to a cookie to be loaded during another session.
	save_to_cookies()
	{
		let struct = {};
		for(let field in this)
		{
			if(field.substring(0,2) == "f_")
				// @ts-ignore
				struct[field as string] = this[field]
		}

		let this_as_str = JSON.stringify(struct);
		set_cookie(DRAW_OPTIONS_COOKIE_NAME, this_as_str, 1000000000);
	}

	//Resets to default values.
	reset()
	{
		let def = new DrawOptions(false, false);

		let old_mode: {mode: ColorSchemeMode, index: number} | null = null;
		if(this.f_scheme_mode.mode == "computed")
		{
			old_mode = this.f_scheme_mode;
		}

		for(let field in def)
		{
			if(field.substring(0,2) == "f_")
				// @ts-ignore
				this[field] = def[field];
		}

		if(old_mode)
		{
			this.f_scheme_mode = old_mode;
		}

		this.on_change();
	}

	/*
	Methods for 'change listeners'. These are methods
	passed to this object by add_change_listener and
	called whenever a value changes.
	*/
	add_change_listener(listener: () => void)
	{
		this.change_listeners.push(listener);
	}
	fire_change_listeners()
	{
		for(let f of this.change_listeners)
		{ try{ f(); } catch {  } }
	}
	clear_change_listeners()
	{
		this.change_listeners = [];
	}
	//To be called whenever an f_-value changes.
	on_change()
	{
		this.sync_css();
		this.fire_change_listeners()
		try{ this.save_to_cookies() }
		catch(e) { console.warn("Failed to save draw settings as cookie!", e) }
	}
	//Syncs certain CSS values with DrawOptions.
	sync_css()
	{
		if(!this.do_sync_css) { return; }
		document.documentElement.style.setProperty("--draw-background", this.background_color());
	}

	/****************
	* SETTERS       *
	****************/

	set_vert_radius(rad: number)
	{
		this.f_vert_radius = rad;
		this.on_change();
	}
	set_edge_weight(weight: number)
	{
		this.f_edge_weight = weight;
		this.on_change();
	}
	set_edge_color(col: string)
	{
		this.f_edge_color = col;
		this.on_change();
	}
	set_label_framing(b: boolean)
	{
		this.f_label_framing = b;
		this.on_change();
	}
	set_arrows(b: boolean)
	{
		this.f_arrows = b;
		this.on_change();
	}
	set_show_exceptional(b: boolean)
	{
		this.f_show_exceptional = b;
		this.on_change()
	}
	set_route_weight(weight: number)
	{
		this.f_route_weight = weight;
		this.on_change();
	}
	set_hasse_edge_weight(weight: number)
	{
		this.f_hasse_edge_weight = weight;
		this.on_change();
	}
	set_hasse_node_size(size: number)
	{
		this.f_hasse_node_size = size;
		this.on_change();
	}
	set_hasse_show_cliques(b: boolean)
	{
		this.f_hasse_show_cliques = b;
		this.on_change();
	}
	set_hasse_mini_vert_rad(r: number)
	{
		this.f_hasse_mini_vert_rad = r;
		this.on_change();
	}
	set_hasse_mini_route_weight(r: number)
	{
		this.f_hasse_mini_route_weight = r;
		this.on_change();
	} 
	set_hasse_mini_dag_size(r: number)
	{
		this.f_hasse_mini_dag_size = r;
		this.on_change()
	}
	set_hasse_node_color(col: string)
	{
		this.f_hasse_node_color = col;
		this.on_change();
	}
	set_hasse_current_color(col: string)
	{
		this.f_hasse_current_color = col;
		this.on_change();
	}
	set_scale(scale: number)
	{
		this.f_scale = scale;
		this.on_change();
	}
	set_builtin_color_scheme(id: number)
	{
		this.f_scheme_mode = {
			mode: "computed",
			index: id
		};
		this.on_change();
	}
	set_simplex_render_mode(mode: string)
	{
		if(mode == "solid" || mode == "dots" || mode == "blank")
		{
			this.f_simplex_render_mode = mode;
			this.on_change();
		}
		else
		{
			console.warn("Tried to change to invalid simplex render mode!");
		}
	}
	set_vertex_color(color: string)
	{
		this.f_vertex_color = color;
		this.on_change();
	}
	set_background_color(color: string)
	{
		this.f_background_color = color;
		this.on_change();
	}
	set_polytope_color(color: string)
	{
		this.f_polytope_color = color;
		this.on_change();
	}
	set_simplex_color(color: string)
	{
		this.f_simplex_color = color;
		this.on_change();
	}
	set_dot_shade(b: boolean)
	{
		this.f_dot_shade = b;
		this.on_change();
	}
	set_dot_on_top(b: boolean)
	{
		this.f_dot_on_top = b;
		this.on_change();
	}
	set_dot_radius(rad: number)
	{
		this.f_dot_radius = rad;
		this.on_change();
	}
	set_hasse_bad_edge_color(col: string)
	{
		this.f_hasse_bad_edge_color = col;
		this.on_change();
	}
	set_up_brick_color(col: string)
	{
		this.f_up_brick_color = col;
		this.on_change();
	}
	set_down_brick_color(col: string)
	{
		this.f_down_brick_color = col;
		this.on_change();
	}
	set_brick_compat_edge_color(col: string)
	{
		this.f_brick_compat_edge_color = col;
		this.on_change();
	}
	set_draw_all_downbricks(b: boolean)
	{
		this.f_draw_all_downbricks = b;
		this.on_change();
	}
	set_brick_width(w: number)
	{
		this.f_brick_width = w;
		this.on_change();
	}
	set_brick_draw_compat_edges(b: boolean)
	{
		this.f_brick_draw_compat_edges = b;
		this.on_change();
	}
	set_hasse_select_halo(w: number)
	{
		this.f_hasse_select_halo = w;
		this.on_change();
	}

	/****************
	* GETTERS       *
	****************/

	get_route_color(i: number): string
	{
		let scheme: string[];
		if(this.f_scheme_mode.mode == "computed")
		{
			scheme = get_colors(this.f_scheme_mode.index);
		}
		else
		{
			throw new Error("Impossible")
		}
		return scheme[i % scheme.length];
	}
	scale(): number
	{
		return this.f_scale;
	}
	hasse_select_halo(): number
	{
		return this.f_hasse_select_halo;
	}
	vert_radius(): number
	{
		return this.f_vert_radius;
	}
	edge_weight(): number
	{
		return this.f_edge_weight;
	}
	edge_halo(): number
	{
		return this.f_edge_halo;
	}
	label_framing(): boolean
	{
		return this.f_label_framing;
	}
	arrows(): boolean
	{
		return this.f_arrows; 
	}
	show_exceptional(): boolean
	{
		return this.f_show_exceptional;
	}
	tangent_handle_size(): number
	{
		return this.f_tangent_handle_size;
	}
	tangent_arm_weight(): number
	{
		return this.f_tangent_arm_weight;
	}
	route_weight(): number
	{
		return this.f_route_weight;
	}
	hasse_edge_weight(): number
	{
		return this.f_hasse_edge_weight;
	}
	hasse_show_cliques(): boolean
	{
		return this.f_hasse_show_cliques;
	}
	hasse_padding(): number
	{
		return this.f_hasse_padding;
	}
	background_color(): string
	{
		return this.f_background_color;
	}
	selection_color(): string
	{
		return this.f_selection_color;
	}
	edge_color(): string
	{
		return this.f_edge_color;
	}
	vertex_color(): string
	{
		return this.f_vertex_color;
	}
	polytope_color(): string
	{
		return this.f_polytope_color;
	}
	simplex_color(): string
	{
		return this.f_simplex_color;
	}
	hasse_current_color(): string
	{
		return this.f_hasse_current_color;
	}
	handle_color(): string
	{
		return this.f_handle_color;
	}
	hasse_node_color(): string
	{
		return this.f_hasse_node_color;
	}
	hasse_current_node_color(): string
	{
		return this.f_hasse_current_color;
	}
	hasse_node_size(): number
	{
		return this.f_hasse_node_size;
	}
	hasse_mini_vert_rad(): number
	{
		return this.f_hasse_mini_vert_rad;
	}
	hasse_mini_route_weight(): number
	{
		return this.f_hasse_mini_route_weight;
	}
	hasse_mini_dag_size(): number
	{
		return this.f_hasse_mini_dag_size;
	}
	simplex_render_mode(): SimplexRenderMode
	{
		return this.f_simplex_render_mode;
	}
	dot_shade(): boolean
	{
		return this.f_dot_shade;
	}
	dot_on_top(): boolean
	{
		return this.f_dot_on_top;
	}
	dot_radius(): number
	{
		return this.f_dot_radius;
	}
	hasse_bad_edge_color(): string
	{
		return this.f_hasse_bad_edge_color;
	}
	up_brick_color(): string
	{
		return this.f_up_brick_color;
	}
	down_brick_color(): string
	{
		return this.f_down_brick_color;
	}
	brick_compat_edge_color(): string
	{
		return this.f_brick_compat_edge_color;
	}
	brick_draw_compat_edges(): boolean
	{
		return this.f_brick_draw_compat_edges;
	}
	bad_highlight_color(): string
	{
		return this.f_bad_highlight_color;
	}
	good_highlight_color(): string
	{
		return this.f_good_highlight_color;
	}
	make_hasse_diagram_bricks(): boolean
	{
		return this.f_make_hasse_diagram_bricks;
	}
	brick_width(): number
	{
		return this.f_brick_width;
	}
	draw_all_downbricks(): boolean
	{
		return this.f_draw_all_downbricks;
	}
	draw_brick_of_highlighted_route(): boolean
	{
		return this.f_draw_brick_of_highlighted_route;
	}
	draw_brick_of_highlighted_brick(): boolean
	{
		return this.f_draw_brick_of_highlighted_brick;
	}
}
