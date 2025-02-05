import { DrawOptions } from "./subelements/dag_canvas";
import { prebuilt_dag_embedding } from "./dag_layout";
import { CliqueViewer } from "./modes/clique_viewer";


class DKKProgram
{
	draw_options = new DrawOptions();
	current_clique: number = 0;
	mode: CliqueViewer = CliqueViewer.destructive_new(
		prebuilt_dag_embedding(0),
		this.draw_options
	);

	constructor()
	{
		let open_button: HTMLDivElement = document.getElementById("open-button") as HTMLDivElement;
		open_button.onclick = (ev) => {
			this.current_clique = (this.current_clique+1)%3;
			this.set_clique_viewer(this.current_clique);
		};
	}

	set_clique_viewer(idx: number)
	{
		var layout = prebuilt_dag_embedding(idx);
		this.mode = CliqueViewer.destructive_new(layout, this.draw_options);
	}
}

let dkk = new DKKProgram();