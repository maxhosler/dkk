import { Result, Option } from "./result";
import { FramedDAG, Edge, test_dag } from "./dag";
import { BakedDAGEmbedding, FramedDAGEmbedding, Vector } from "./dag_layout";

class PageManager
{
	offset: Vector = new Vector(50, 50);
	scale: number = 50;
	node_radius: number = 3;
	draw_zone: HTMLCanvasElement;

	constructor()
	{
		this.draw_zone = document.getElementById("draw_zone") as HTMLCanvasElement;
	}

	draw_dag(data: BakedDAGEmbedding)
	{
		let ctx = this.draw_zone.getContext("2d");

		for(let edge of data.edges)
		{
			let st = this.local_trans(edge.start_point);
			let c1 = this.local_trans(edge.cp1);
			let c2 = this.local_trans(edge.cp2);
			let en = this.local_trans(edge.end_point);

			ctx?.beginPath();
			ctx?.moveTo(st.x, st.y);
			ctx?.bezierCurveTo(
				c1.x, c1.y,
				c2.x, c2.y,
				en.x, en.y
			);
			ctx?.stroke()
		}

		for(let vert of data.verts)
		{
			let scaled = this.local_trans(vert);

			ctx?.beginPath();
			ctx?.arc(
				scaled.x,
				scaled.y,
				this.node_radius,
				0, 2*Math.PI
			);
			ctx?.fill();
		}

	}

	local_trans(vec: Vector)
	{
		return vec.scale(this.scale).add(this.offset);
	}
}

const pm = new PageManager();
const dag = test_dag(2);
const layout = new FramedDAGEmbedding(dag);
pm.draw_dag(layout.bake())