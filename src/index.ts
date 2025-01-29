import { Result, Option } from "./result";
import { FramedDAG, Edge, test_dag } from "./dag";

class PageManager
{
	draw_zone: HTMLCanvasElement;

	constructor()
	{
		this.draw_zone = document.getElementById("draw_zone") as HTMLCanvasElement;
	}
}

const pm = new PageManager();