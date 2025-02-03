import { Result, Option } from "./result";
import { BakedDAGEmbedding, FramedDAGEmbedding, prebuilt_dag_embedding } from "./dag_layout";
import { clear_page, RIGHT_AREA, SIDEBAR_CONTENTS, SIDEBAR_HEAD } from "./html_elems";
import { Bezier, Vector } from "./util";

type SelectionType = "none" | "vertex" | "edge";
class Selection
{
	readonly type: SelectionType;
	readonly inner: null | number  ;

	private constructor(type: SelectionType, inner: null|number)
	{
		this.type = type;
		this.inner = inner;
	}

	static none(): Selection
	{
		return new Selection("none", null);
	}

	static vertex(num: number): Selection
	{
		return new Selection("vertex", num);
	}

	static edge(num: number): Selection
	{
		return new Selection("edge", num);
	}
}

type DrawCtx = CanvasRenderingContext2D;
class EmbeddingEditorManager
{
	scale: number = 200;
	node_radius: number = 12;
	stroke_weight: number = 6;
	stroke_halo: number = 6;

	background_color: string = "#b0b0b0";
	selection_color: string = "#2160c487";

	canvas: HTMLCanvasElement;
	dag: FramedDAGEmbedding;

	offset: Option<Vector> = Option.none();
	selected: Selection = Selection.none();

	constructor(dag: FramedDAGEmbedding)
	{
		this.dag = dag;

		clear_page();
		SIDEBAR_HEAD.innerText = "Embedding Editor";
		
		let display_settings = document.createElement("div");
		display_settings.className = "sb-subsection";
		SIDEBAR_CONTENTS.appendChild(display_settings);

		//TODO: Scale slider

		//TODO: Node editor

		//TODO: Edge editor

		let draw_zone = document.createElement("canvas")
		draw_zone.id = "draw_zone";
		RIGHT_AREA.appendChild(draw_zone);
		this.canvas = draw_zone;
		this.canvas.addEventListener("click",
			(ev) => {
				this.canvas_click(new Vector(ev.layerX, ev.layerY))
			}
		)

		this.resize_canvas();
		addEventListener("resize", (event) => {
			if(this)
			this.resize_canvas();
		});
	}

	change_selection(sel: Selection)
	{
		this.selected = sel;
		this.draw();
	}

	canvas_click(position: Vector)
	{
		let clicked_vert = this.get_vertex_at(position);
		if (clicked_vert.is_some())
		{
			this.change_selection(
				Selection.vertex(clicked_vert.unwrap())
			);
		}
		else
		{
			let clicked_edge = this.get_edge_at(position);
			if(clicked_edge.is_some())
			{
				this.change_selection(
					Selection.edge(clicked_edge.unwrap())
				);
			}
			else
			{
				this.change_selection(
					Selection.none()
				);
			}
		}
			
	}

	//TODO: provide baked optional
	get_vertex_at(position: Vector): Option<number>
	{
		let dag = this.dag.bake();
		
		for(let i = 0; i < dag.verts.length; i++)
		{
			let vert_pos = this.local_trans(dag.verts[i]);
			if(position.sub(vert_pos).norm() <= this.node_radius)
				return Option.some(i);
		}
			
		return Option.none();
	}

	//TODO: provide baked optional
	get_edge_at(position: Vector): Option<number>
	{
		let dag = this.dag.bake();
		
		for(let i = dag.edges.length - 1; i >= 0; i--)
		{
			let bez = dag.edges[i].transform
				((v: Vector) => this.local_trans(v));

			if(bez.distance_to(position) <= this.stroke_weight)
				return Option.some(i);
		}
			
		return Option.none();
	}

	/*
	Code for drawing
	*/

	resize_canvas()
	{
		this.canvas.height = this.canvas.clientHeight;
		this.canvas.width = this.canvas.clientWidth;
		this.offset = Option.none();
		this.draw();
	}

	get_ctx(): DrawCtx
	{
		return this.canvas.getContext("2d") as DrawCtx;
	}

	draw()
	{		
		let ctx = this.get_ctx();
		let data = this.dag.bake();

		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		for(let edge of data.edges)
		{ this.draw_bez(edge, "#222222", ctx, true); }

		this.draw_selection_edge(data, ctx);

		for(let vert of data.verts)
		{ this.draw_node(vert, ctx); }

		this.draw_selection_vert(data, ctx);

	}

	draw_node(pos: Vector, ctx: DrawCtx)
	{
		let scaled = this.local_trans(pos);

		ctx.fillStyle = "black";

		ctx.beginPath();
		ctx.arc(
			scaled.x,
			scaled.y,
			this.node_radius,
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
			let trans_bk = this.background_color + "00"; //Assumes in hex form. 
			let bk = this.background_color;
			grad.addColorStop(0.0,   trans_bk);
			grad.addColorStop(0.2,   trans_bk);
			grad.addColorStop(0.201, bk);
			grad.addColorStop(0.8,   bk);
			grad.addColorStop(0.801, trans_bk);
			grad.addColorStop(1.0,   trans_bk);

			ctx.strokeStyle = grad;
			ctx.lineWidth = this.stroke_weight + this.stroke_halo;
			ctx.stroke()
		}

		ctx.strokeStyle = color;
		ctx.lineWidth = this.stroke_weight;
		ctx.stroke()
	}

	draw_selection_vert(data: BakedDAGEmbedding, ctx: DrawCtx)
	{
		if(this.selected.type == "vertex")
		{
			let vert = this.selected.inner as number;
			if(0 > vert || vert >= data.verts.length)
			{
				this.change_selection(Selection.none());
				return;
			}
			let vpos = this.local_trans(data.verts[vert]);
			ctx.fillStyle = this.selection_color;
			ctx.beginPath();
			ctx.arc(
				vpos.x,
				vpos.y,
				this.node_radius + 4,
				0, 2*Math.PI
			);
			ctx.fill();
		}
	}

	draw_selection_edge(data: BakedDAGEmbedding, ctx: DrawCtx)
	{
		if(this.selected.type == "edge")
		{
			let edge = this.selected.inner as number;
			if(0 > edge || edge >= data.edges.length)
			{
				this.change_selection(Selection.none());
				return;
			}
			let bez = data.edges[edge].transform
				((v: Vector) => this.local_trans(v));

			ctx.beginPath();
			ctx.moveTo(bez.start_point.x, bez.start_point.y);
			ctx.bezierCurveTo(
				bez.cp1.x, bez.cp1.y,
				bez.cp2.x, bez.cp2.y,
				bez.end_point.x, bez.end_point.y
			);

			ctx.strokeStyle = this.selection_color;
			ctx.lineWidth = this.stroke_weight + 5;
			ctx.stroke()
		}
	}

	get_offset(): Vector
	{
		if (this.offset.is_none())
		{
			let os = new Vector( this.scale/2, this.canvas.height/2 );
			this.offset = Option.some(os);
		}
		return this.offset.unwrap();
	}

	local_trans(vec: Vector)
	{
		return vec
			.scale(this.scale)
			.add(this.get_offset());
	}

	local_trans_inv(vec: Vector)
	{
		return vec
			.sub(this.get_offset())
			.scale(1/this.scale);
	}
}


const layout = prebuilt_dag_embedding(2);
const pm = new EmbeddingEditorManager(layout);
