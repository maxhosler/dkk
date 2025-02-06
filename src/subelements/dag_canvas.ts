import { get_cookie, set_cookie } from "../cookie";
import { BakedDAGEmbedding } from "../dag_layout";
import { Bezier, Vector } from "../util";

const ROUTE_RAINBOW: string[] = [
    "#5b4db7",
    "#42adc7",
    "#81d152",
    "#f5f263",
    "#ff9d4f",
    "#ff5347",
];

const DRAW_OPTIONS_COOKIE_NAME: string = "draw-options-cookie"

export class DrawOptions
{
	private f_scale: number = 200;
	private f_node_radius: number = 12;
	private f_stroke_weight: number = 6;
	private f_stroke_halo: number = 6;
	private f_route_weight: number = 8;
	private f_route_colors: string[] = ROUTE_RAINBOW;
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
	set_scale(scale: number)
	{
		this.f_scale = scale;
		this.on_change();
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
	stroke_weight(): number
	{
		return this.f_stroke_weight;
	}
	stroke_halo(): number
	{
		return this.f_stroke_halo;
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

	constructor()
	{
		let cookie_str = get_cookie(DRAW_OPTIONS_COOKIE_NAME);
		if(!cookie_str) return;

		
		let json_ob;
		try{
			json_ob = JSON.parse(cookie_str);
		} catch(e)
		{ console.warn("Failed to parse draw options cookie.", e); return; }

		/*
		private f_scale: number = 200;
		private f_node_radius: number = 12;
		private f_stroke_weight: number = 6;
		private f_stroke_halo: number = 6;
		private f_route_weight: number = 8;
		private f_route_colors: string[] = ROUTE_RAINBOW;
		private f_background_color: string = "#b0b0b0";
		private f_selection_color: string = "#2160c487";
		private f_edge_color: string = "#222222";
		private f_node_color: string = "#000000";
		*/

		if(typeof json_ob.f_scale == "number")
			this.f_scale = json_ob.f_scale;

		if(typeof json_ob.f_node_radius == "number")
			this.f_node_radius = json_ob.f_node_radius;
		
		if(typeof json_ob.f_stroke_weight == "number")
			this.f_stroke_weight = json_ob.f_stroke_weight;
		
		if(typeof json_ob.f_stroke_halo == "number")
			this.f_stroke_halo = json_ob.f_stroke_halo;
		
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
	
		console.log(this);
	}
}

type DrawCtx = CanvasRenderingContext2D;
export class DAGCanvas
{
	canvas: HTMLCanvasElement;
	readonly draw_options: DrawOptions;

	static create(draw_options: DrawOptions): { canvas: DAGCanvas, element: HTMLCanvasElement }
	{
		let draw_zone = document.createElement("canvas")
		draw_zone.id = "draw_zone";
		let canvas = new DAGCanvas(draw_zone, draw_options);
		return {
			canvas: canvas,
			element: draw_zone
		}
	}

	private constructor(canvas: HTMLCanvasElement, draw_options: DrawOptions)
	{
		this.canvas = canvas;
		this.draw_options = draw_options;
		
		this.resize_canvas();
		addEventListener("resize", (event) => {
			if(this)
			this.resize_canvas();
		});
	}

	resize_canvas()
	{
		this.canvas.height = this.canvas.clientHeight;
		this.canvas.width = this.canvas.clientWidth;
	}

	get_ctx(): DrawCtx
	{
		return this.canvas.getContext("2d") as DrawCtx;
	}

	draw_node(pos: Vector, ctx: DrawCtx)
	{
		let scaled = this.local_trans(pos);

		ctx.fillStyle = this.draw_options.node_color();

		ctx.beginPath();
		ctx.arc(
			scaled.x,
			scaled.y,
			this.draw_options.node_radius(),
			0, 2*Math.PI
		);
		ctx.fill();
	}

	draw_bez(edge: Bezier, color: string, weight: number, ctx: DrawCtx, halo: boolean)
	{
		let e = edge.transform
			((v: Vector) => this.local_trans(v));

		ctx.beginPath();
		ctx.moveTo(e.start_point.x, e.start_point.y);
		ctx.bezierCurveTo(
			e.cp1.x, e.cp1.y,
			e.cp2.x, e.cp2.y,
			e.end_point.x, e.end_point.y
		);

		if (halo)
		{
			let grad=ctx.createLinearGradient(
				e.start_point.x,
				e.start_point.y,
				e.end_point.x,
				e.end_point.y
			);
			let trans_bk = this.draw_options.background_color() + "00"; //Assumes in hex form. 
			let bk = this.draw_options.background_color();
			grad.addColorStop(0.0,   trans_bk);
			grad.addColorStop(0.3,   trans_bk);
			grad.addColorStop(0.301, bk);
			grad.addColorStop(0.7,   bk);
			grad.addColorStop(0.701, trans_bk);
			grad.addColorStop(1.0,   trans_bk);

			ctx.strokeStyle = grad;
			ctx.lineWidth = weight + this.draw_options.stroke_halo();
			ctx.stroke()
		}

		ctx.strokeStyle = color;
		ctx.lineWidth = weight;
		ctx.stroke()
	}

	get_offset(): Vector
	{
		return new Vector( this.draw_options.scale()/2, this.canvas.height/2 );
	}

	local_trans(vec: Vector)
	{
		return vec
			.scale(this.draw_options.scale())
			.add(this.get_offset());
	}

	local_trans_inv(vec: Vector)
	{
		return vec
			.sub(this.get_offset())
			.scale(1/this.draw_options.scale());
	}
}