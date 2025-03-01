import { get_cookie, set_cookie } from "../cookie";
import { get_colors } from "./colors";

const ROUTE_RAINBOW: string[] = [
    "#5b4db7",
    "#42adc7",
    "#81d152",
    "#f5f263",
    "#ff9d4f",
    "#ff5347",
];

const DRAW_OPTIONS_COOKIE_NAME: string = "draw-options-cookie"

type SimplexRenderMode = "solid" | "dots" | "blank";
type ColorSchemeMode = "computed";
export class DrawOptions
{
	private f_scale: number = 200;
	private f_node_radius: number = 12;
	
	private f_edge_weight: number = 6;
	private f_edge_halo: number = 6;
	private f_route_weight: number = 8;
	private f_hasse_edge_weight: number = 10;

	private f_scheme_mode: {mode: ColorSchemeMode, index: number} = {mode: "computed", index:2};
	private f_simplex_render_mode: SimplexRenderMode = "solid";

	private f_background_color: string = "#b0b0b0";
	private f_selection_color: string = "#2160c487";
	private f_edge_color: string = "#222222";
	private f_node_color: string = "#000000";

	private change_listeners: (()=>void)[] = [];

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

	set_node_radius(rad: number)
	{
		this.f_node_radius = rad;
		this.on_change();
	}
	set_edge_weight(weight: number)
	{
		this.f_edge_weight = weight;
		this.on_change();
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

	save_to_cookies()
	{
		//An awful hack to get around the fact that functions can't be cloned.
		let cl_store = this.change_listeners;
		this.change_listeners = [];
		let struct = structuredClone(this) as any;
		delete struct.change_listeners;
		this.change_listeners = cl_store;

		let this_as_str = JSON.stringify(struct);
		set_cookie(DRAW_OPTIONS_COOKIE_NAME, this_as_str, 1000000000);
	}
	on_change()
	{
		this.fire_change_listeners()
		try{ this.save_to_cookies() }
		catch(e) { console.warn("Failed to save draw settings as cookie!", e) }
	}

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
	node_radius(): number
	{
		return this.f_node_radius;
	}
	edge_weight(): number
	{
		return this.f_edge_weight;
	}
	edge_halo(): number
	{
		return this.f_edge_halo;
	}
	route_weight(): number
	{
		return this.f_route_weight;
	}
	hasse_edge_weight(): number
	{
		return this.f_hasse_edge_weight;
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
	node_color(): string
	{
		return this.f_node_color;
	}
	simplex_render_mode(): SimplexRenderMode
	{
		return this.f_simplex_render_mode;
	}

	constructor(load_from_cookies: boolean)
	{
		if(!load_from_cookies) return;
		let cookie_str = get_cookie(DRAW_OPTIONS_COOKIE_NAME);
		if(!cookie_str) return;

		
		let json_ob;
		try{
			json_ob = JSON.parse(cookie_str);
		} catch(e)
		{ console.warn("Failed to parse draw options cookie.", e); return; }

		if(typeof json_ob.f_scale == "number")
			this.f_scale = json_ob.f_scale;

		if(typeof json_ob.f_node_radius == "number")
			this.f_node_radius = json_ob.f_node_radius;
		
		if(typeof json_ob.f_edge_weight == "number")
			this.f_edge_weight = json_ob.f_edge_weight;
		
		if(typeof json_ob.f_edge_halo == "number")
			this.f_edge_halo = json_ob.f_edge_halo;
		
		if(typeof json_ob.f_route_weight == "number")
			this.f_route_weight = json_ob.f_route_weight;
		
		
		if(typeof json_ob.f_scheme_mode == "object")
		{
			if( typeof json_ob.f_scheme_mode.mode == "string" && 
				typeof json_ob.f_scheme_mode.mode.index == "number"
			){
				this.f_scheme_mode = json_ob.f_scheme_mode;
			}
		}
			
		
		if(typeof json_ob.f_background_color == "string")
			this.f_background_color = json_ob.f_background_color;
		
		if(typeof json_ob.f_selection_color == "string")
			this.f_selection_color = json_ob.f_selection_color;
		
		if(typeof json_ob.f_edge_color == "string")
			this.f_edge_color = json_ob.f_edge_color;

		if(typeof json_ob.f_node_color == "string")
			this.f_node_color = json_ob.f_node_color;

		if(typeof json_ob.f_simplex_render_mode == "string")
			this.f_simplex_render_mode = json_ob.f_simplex_render_mode;
	}

	reset()
	{
		let def = new DrawOptions(false);

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
}