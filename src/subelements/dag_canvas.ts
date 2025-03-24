import { Bezier, Vector2 } from "../util/num";
import { DrawOptions } from "../draw/draw_options";
import { FramedDAG } from "../math/dag";
import { BakedDAGEmbedding, FramedDAGEmbedding } from "../draw/dag_layout";

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
		this.canvas.addEventListener("resize", (event) => {
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

	get_offset(): Vector2
	{
		return new Vector2( this.canvas.width/2, this.canvas.height/2 );
	}

	local_trans(vec: Vector2)
	{
		return vec
			.scale(this.draw_options.scale())
			.add(this.get_offset());
	}

	local_trans_inv(vec: Vector2)
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

	draw_node(pos: Vector2)
	{
		this.draw_circ(pos,
			this.parent.draw_options.vertex_color(),
			this.parent.draw_options.vert_radius()
		);
	}

	draw_circ(pos: Vector2, color: string, size: number)
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
			((v: Vector2) => this.parent.local_trans(v));

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

	draw_text(text: string, pos: Vector2, color: string, stroke: string, size: number)
	{
		this.ctx.font = size.toString() + "px Arial";
		this.ctx.fillStyle = color;
		this.ctx.strokeStyle = stroke;
		this.ctx.lineWidth = 6;


		let measure = this.ctx.measureText(text);

		let scaled = this.parent.local_trans(pos);
		let position = new Vector2(scaled.x - measure.width/2, scaled.y + size/2 -2);// + size/2);

		this.ctx.strokeText(text, position.x, position.y)
		this.ctx.fillText(text, position.x, position.y)

	}

	draw_line(
		start: Vector2,
		end: Vector2,
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

	draw_box(
		top: Vector2,
		bot: Vector2,
		color: string
	)
	{
		let t = this.parent.local_trans(top);
		let b = this.parent.local_trans(bot);

		let size = b.sub(t);

		this.ctx.beginPath();
		this.ctx.rect(t.x, t.y, size.x, size.y);

		this.ctx.fillStyle = color;
		this.ctx.fill()
	}

	draw_rounded_box(
		top: Vector2,
		bot: Vector2,
		radius: number,
		color: string
	)
	{
		let t = this.parent.local_trans(top);
		let b = this.parent.local_trans(bot);

		let size = b.sub(t);

		this.ctx.beginPath();
		this.ctx.roundRect(t.x, t.y, size.x, size.y, radius);

		this.ctx.fillStyle = color;
		this.ctx.fill()
	}

	decorate_edges_num(
		dag: FramedDAG,
		baked: BakedDAGEmbedding,
	)
	{
		
		for(let vert = 0; vert < dag.num_verts(); vert++)
		{
			let out_frame = dag.get_out_edges(vert).unwrap();
			for(let edge_idx = 0; edge_idx < out_frame.length; edge_idx++)
			{
				let edge = out_frame[edge_idx];
				let bez = baked.edges[edge];
				let pos = bez.point_distance_along(0.15, "start");
				this.draw_text(edge_idx.toString(), pos, "#ffffff", "#000000", 20);
			}

			let in_frame = dag.get_in_edges(vert).unwrap();
			for(let edge_idx = 0; edge_idx < in_frame.length; edge_idx++)
			{
				let edge = in_frame[edge_idx];
				let bez = baked.edges[edge];
				let pos = bez.point_distance_along(0.15, "end");
				this.draw_text(edge_idx.toString(), pos, "#ffffff", "#000000", 20);
			}
		}
	}

	decorate_edges_arrow(
		baked: BakedDAGEmbedding,
	)
	{
		const width = this.parent.draw_options.edge_weight() * 2;
		
		for(let edge = 0; edge < baked.edges.length; edge++)
		{
			let bez = baked.edges[edge];
			let direc  = bez.get_direc(0.5).normalized().scale(-1);
			let midway = this.parent.local_trans(bez.get_point(0.5))
				.add(direc.scale(-width));
			let p1 = midway
				.add(direc.scale(width))
				.add(direc.rot90().scale(width));
			let p2 = midway
				.add(direc.scale(width))
				.add(direc.rot90().scale(-width));		

			this.ctx.fillStyle = this.parent.draw_options.edge_color();

			this.ctx.beginPath();
			this.ctx.moveTo(midway.x, midway.y);
			this.ctx.lineTo(p1.x, p1.y);
			this.ctx.lineTo(p2.x, p2.y);

			this.ctx.fill();
		}
	}
}
