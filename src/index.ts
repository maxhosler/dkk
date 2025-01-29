import { Result, Option } from "./result";
import { FramedDAG, Edge, test_dag } from "./dag";

class PageManager
{
	draw_zone: HTMLDivElement;

	constructor()
	{
		this.draw_zone = document.getElementById("draw_zone") as HTMLDivElement;
	}
}

const pm = new PageManager();