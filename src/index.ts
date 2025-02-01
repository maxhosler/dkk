import { Result, Option } from "./result";
import { FramedDAG, Edge, test_dag } from "./dag";
import { BakedDAGEmbedding, Bezier, FramedDAGEmbedding, Vector } from "./dag_layout";

type DrawCtx = CanvasRenderingContext2D;
class PageManager
{
	scale: number = 150;
	node_radius: number = 12;
	stroke_weight: number = 6;
	draw_zone: HTMLCanvasElement;

	offset: Option<Vector> = Option.none();

	constructor()
	{
		this.draw_zone = document.getElementById("draw_zone") as HTMLCanvasElement;
		this.resize_canvas();
		addEventListener("resize", (event) => {
			this.resize_canvas();
		});
	}

	resize_canvas()
	{
		this.draw_zone.height = this.draw_zone.clientHeight;
		this.draw_zone.width = this.draw_zone.clientWidth;
		this.offset = Option.none();
	}

	get_ctx(): DrawCtx
	{
		return this.draw_zone.getContext("2d") as DrawCtx;
	}

	draw_dag(data: BakedDAGEmbedding)
	{
		let ctx = this.get_ctx();

		for(let edge of data.edges)
		{ this.draw_bez(edge, "#222222", ctx); }

		for(let vert of data.verts)
		{ this.draw_node(vert, ctx); }

	}

	draw_node(pos: Vector, ctx: DrawCtx)
	{
		let scaled = this.local_trans(pos);

		ctx?.beginPath();
		ctx?.arc(
			scaled.x,
			scaled.y,
			this.node_radius,
			0, 2*Math.PI
		);
		ctx?.fill();
	}

	draw_bez(edge: Bezier, color: string, ctx: DrawCtx)
	{
		let st = this.local_trans(edge.start_point);
		let c1 = this.local_trans(edge.cp1);
		let c2 = this.local_trans(edge.cp2);
		let en = this.local_trans(edge.end_point);

		ctx.strokeStyle = color;
		ctx.lineWidth = this.stroke_weight;

		ctx.beginPath();
		ctx.moveTo(st.x, st.y);
		ctx.bezierCurveTo(
			c1.x, c1.y,
			c2.x, c2.y,
			en.x, en.y
		);
		ctx.stroke()
	}

	get_offset(): Vector
	{
		if (this.offset.is_none())
		{
			let os = new Vector( this.scale, this.draw_zone.height/2 );
			this.offset = Option.some(os);
		}
		return this.offset.unwrap();
	}

	local_trans(vec: Vector)
	{
		return vec.scale(this.scale).add(this.get_offset());
	}
}

const pm = new PageManager();
const dag = test_dag(2);
const layout = new FramedDAGEmbedding(dag);
pm.draw_dag(layout.bake())