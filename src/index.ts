import { Result, Option } from "./result";
import { FramedDAG, Edge, test_dag2 } from "./dag";
import { FramedDAGEmbedding } from "./dag_layout";

class PageManager
{
	draw_zone: HTMLCanvasElement;

	constructor()
	{
		this.draw_zone = document.getElementById("draw_zone") as HTMLCanvasElement;
	}
}

const pm = new PageManager();
const dag = test_dag2();
const layout = new FramedDAGEmbedding(dag);
console.log(layout.bake())