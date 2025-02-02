import { Result, Option } from "./result";
import { FramedDAG, Edge, prebuilt_dag } from "./dag";
import { BakedDAGEmbedding, Bezier, FramedDAGEmbedding, prebuilt_dag_embedding, Vector } from "./dag_layout";
import { clear_page, RIGHT_AREA, SIDEBAR } from "./html_elems";

type SelectionType = "none" | "vertex";
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
}

type DrawCtx = CanvasRenderingContext2D;
class EmbeddingEditorManager
{
	scale: number = 200;
	node_radius: number = 12;
	stroke_weight: number = 6;
	stroke_halo: number = 0;
	background_color: string = "#b0b0b0";
	selection_color: string = "#2160c4aa";

	canvas: HTMLCanvasElement;

	offset: Option<Vector> = Option.none();
	current_dag: Option<FramedDAGEmbedding> = Option.none();
	selected: Selection = Selection.none();

	constructor()
	{
		clear_page();

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
			this.change_selection(Selection.vertex(clicked_vert.unwrap()))
		}
		else
		{
			this.change_selection(Selection.none())
		}
	}

	get_vertex_at(position: Vector): Option<number>
	{
		if(this.current_dag.is_none()) { return Option.none() }
		let dag = this.current_dag.unwrap().bake();
		
		for(let i = 0; i < dag.verts.length; i++)
		{
			let vert_pos = this.local_trans(dag.verts[i]);
			if(position.sub(vert_pos).norm() <= this.node_radius)
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

	set_dag_embedding(dag: FramedDAGEmbedding)
	{
		this.current_dag = Option.some(dag);
		this.draw();
	}

	draw()
	{
		if(!this.current_dag.is_some()) { return; }
		
		let ctx = this.get_ctx();
		let data = this.current_dag.unwrap().bake();

		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		for(let edge of data.edges)
		{ this.draw_bez(edge, "#222222", ctx, true); }

		for(let vert of data.verts)
		{ this.draw_node(vert, ctx); }

		this.draw_selection(data, ctx);

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
		let st = this.local_trans(edge.start_point);
		let c1 = this.local_trans(edge.cp1);
		let c2 = this.local_trans(edge.cp2);
		let en = this.local_trans(edge.end_point);

		ctx.beginPath();
		ctx.moveTo(st.x, st.y);
		ctx.bezierCurveTo(
			c1.x, c1.y,
			c2.x, c2.y,
			en.x, en.y
		);

		if (halo)
		{
			ctx.strokeStyle = this.background_color;
			ctx.lineWidth = this.stroke_weight + this.stroke_halo;
			ctx.stroke()
		}

		ctx.strokeStyle = color;
		ctx.lineWidth = this.stroke_weight;
		ctx.stroke()
	}

	draw_selection(data: BakedDAGEmbedding, ctx: DrawCtx)
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

	get_offset(): Vector
	{
		if (this.offset.is_none())
		{
			let os = new Vector( this.scale, this.canvas.height/2 );
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
}

const pm = new EmbeddingEditorManager();
//const dag = prebuilt_dag(1);
//const layout = new FramedDAGEmbedding(dag);
const layout = prebuilt_dag_embedding(2);
pm.set_dag_embedding(layout);
