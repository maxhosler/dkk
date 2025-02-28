import { get_colors } from "../draw/colors";
import { get_cookie, set_cookie } from "../cookie";
import { BakedDAGEmbedding } from "../dag_layout";
import { Bezier, Vector } from "../util";
import { DrawOptions } from "../draw/draw_options";



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
		let pheight = (this.canvas.parentElement?.clientHeight || 2);
		let pwidth  = (this.canvas.parentElement?.clientWidth || 2);

		this.canvas.style.height = pheight.toString() + "px";
		this.canvas.style.width = pwidth.toString() + "px";

		this.canvas.height = pheight - 2; //-2 to account for border
		this.canvas.width = pwidth - 2;
	}

	get_ctx(): DAGCanvasContext
	{
		return new DAGCanvasContext(this);
	}

	get_offset(): Vector
	{
		return new Vector( this.canvas.width/2, this.canvas.height/2 );
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

	width(): number
	{
		return this.canvas.width
	}

	height(): number
	{
		return this.canvas.height
	}
}

export class DAGCanvasContext
{
	private parent: DAGCanvas;
	private ctx: CanvasRenderingContext2D;

	constructor(dc: DAGCanvas)
	{
		this.parent = dc;
		this.ctx = dc.canvas.getContext("2d") as CanvasRenderingContext2D;
	}

	clear()
	{
		this.ctx.clearRect(0, 0, this.parent.canvas.width, this.parent.canvas.height)
	}

	draw_node(pos: Vector)
	{
		this.draw_circ(pos,
			this.parent.draw_options.node_color(),
			this.parent.draw_options.node_radius()
		);
	}

	draw_circ(pos: Vector, color: string, size: number)
	{
		let scaled = this.parent.local_trans(pos);

		this.ctx.fillStyle = color;

		this.ctx.beginPath();
		this.ctx.arc(
			scaled.x,
			scaled.y,
			size,
			0, 2*Math.PI
		);
		this.ctx.fill();
	}

	draw_bez(edge: Bezier, color: string, weight: number, halo: boolean)
	{
		let e = edge.transform
			((v: Vector) => this.parent.local_trans(v));

		this.ctx.beginPath();
		this.ctx.moveTo(e.start_point.x, e.start_point.y);
		this.ctx.bezierCurveTo(
			e.cp1.x, e.cp1.y,
			e.cp2.x, e.cp2.y,
			e.end_point.x, e.end_point.y
		);

		if (halo)
		{
			let grad=this.ctx.createLinearGradient(
				e.start_point.x,
				e.start_point.y,
				e.end_point.x,
				e.end_point.y
			);
			let trans_bk = this.parent.draw_options.background_color() + "00"; //Assumes in hex form. 
			let bk = this.parent.draw_options.background_color();
			grad.addColorStop(0.0,   trans_bk);
			grad.addColorStop(0.3,   trans_bk);
			grad.addColorStop(0.301, bk);
			grad.addColorStop(0.7,   bk);
			grad.addColorStop(0.701, trans_bk);
			grad.addColorStop(1.0,   trans_bk);

			this.ctx.strokeStyle = grad;
			this.ctx.lineWidth = weight + this.parent.draw_options.edge_halo();
			this.ctx.stroke()
		}

		this.ctx.strokeStyle = color;
		this.ctx.lineWidth = weight;
		this.ctx.stroke()
	}

	draw_line(
		start: Vector,
		end: Vector,
		color: string,
		weight: number
	)
	{
		let s = this.parent.local_trans(start);
		let e = this.parent.local_trans(end);

		this.ctx.beginPath();
		this.ctx.moveTo(s.x, s.y);
		this.ctx.lineTo(e.x, e.y);

		this.ctx.strokeStyle = color;
		this.ctx.lineWidth = weight;
		this.ctx.stroke()
	}
}