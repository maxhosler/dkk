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
export class DrawOptions
{
	private f_scale: number = 200;
	private f_node_radius: number = 12;
	
	private f_edge_weight: number = 6;
	private f_edge_halo: number = 6;
	private f_route_weight: number = 8;

	private f_route_colors: string[] = ROUTE_RAINBOW;
	private f_background_color: string = "#b0b0b0";
	private f_selection_color: string = "#2160c487";
	private f_edge_color: string = "#222222";
	private f_node_color: string = "#000000";
	private f_simplex_render_mode: SimplexRenderMode = "solid";

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
	set_scale(scale: number)
	{
		this.f_scale = scale;
		this.on_change();
	}
	set_builtin_color_scheme(id: number)
	{
		this.f_route_colors = get_colors(id);
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
		return this.f_route_colors[i % this.f_route_colors.length];
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
		
		if(typeof json_ob.f_stroke_weight == "number")
			this.f_edge_weight = json_ob.f_stroke_weight;
		
		if(typeof json_ob.f_stroke_halo == "number")
			this.f_edge_halo = json_ob.f_stroke_halo;
		
		if(typeof json_ob.f_route_weight == "number")
			this.f_route_weight = json_ob.f_route_weight;
		
		//Cursed! Thumbs up!
		try{
		if(json_ob.f_route_colors.constructor.name == "Array")
		{
			for(let entry of json_ob.f_route_colors)
			{
				if(typeof entry != "string")
					throw new Error("");
			}
			this.f_route_colors = json_ob.f_route_colors;
		}
		} catch {}
			
		
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
		//TODO: Think about this. What do I want to reset?

		this.f_scale = 200;
		this.f_node_radius = 12;
		this.f_edge_weight = 6;
		this.f_edge_halo = 6;
		this.f_route_weight = 8;
		this.f_background_color = "#b0b0b0";
		this.f_selection_color = "#2160c487";
		this.f_edge_color = "#222222";
		this.f_node_color = "#000000";
		this.f_simplex_render_mode = "solid";

		this.on_change();
	}
}