import { Result, Option } from "./result";
import { FramedDAG, Edge, test_dag } from "./dag";
import { FramedDAGLayout } from "./dag_layout";

class PageManager
{
	draw_zone: HTMLCanvasElement;

	constructor()
	{
		this.draw_zone = document.getElementById("draw_zone") as HTMLCanvasElement;
	}
}

const pm = new PageManager();
const dag = test_dag();
const layout = new FramedDAGLayout(dag);
console.log(layout);