import { BakedDAGEmbedding } from "../dag_layout";
import { Bezier, Vector } from "../util";

export class DrawOptions
{
	scale: number = 200;
	node_radius: number = 12;
	stroke_weight: number = 6;
	stroke_halo: number = 6;

	background_color: string = "#b0b0b0";
	selection_color: string = "#2160c487";
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

		ctx.fillStyle = "black";

		ctx.beginPath();
		ctx.arc(
			scaled.x,
			scaled.y,
			this.draw_options.node_radius,
			0, 2*Math.PI
		);
		ctx.fill();
	}

	draw_bez(edge: Bezier, color: string, ctx: DrawCtx, halo: boolean)
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
			let trans_bk = this.draw_options.background_color + "00"; //Assumes in hex form. 
			let bk = this.draw_options.background_color;
			grad.addColorStop(0.0,   trans_bk);
			grad.addColorStop(0.2,   trans_bk);
			grad.addColorStop(0.201, bk);
			grad.addColorStop(0.8,   bk);
			grad.addColorStop(0.801, trans_bk);
			grad.addColorStop(1.0,   trans_bk);

			ctx.strokeStyle = grad;
			ctx.lineWidth = this.draw_options.stroke_weight + this.draw_options.stroke_halo;
			ctx.stroke()
		}

		ctx.strokeStyle = color;
		ctx.lineWidth = this.draw_options.stroke_weight;
		ctx.stroke()
	}

	get_offset(): Vector
	{
		return new Vector( this.draw_options.scale/2, this.canvas.height/2 );
	}

	local_trans(vec: Vector)
	{
		return vec
			.scale(this.draw_options.scale)
			.add(this.get_offset());
	}

	local_trans_inv(vec: Vector)
	{
		return vec
			.sub(this.get_offset())
			.scale(1/this.draw_options.scale);
	}
}