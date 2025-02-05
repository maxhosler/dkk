import { DrawOptions } from "./subelements/dag_canvas";
import { prebuilt_dag_embedding } from "./dag_layout";
import { CliqueViewer } from "./modes/clique_viewer";
import { EmbeddingEditor } from "./modes/embedding_editor";

abstract class Popup
{
    base: HTMLDivElement;
    window: HTMLDivElement;
    constructor(body: HTMLElement)
    {
        let base = document.createElement("div");
        base.id = "shadow"
        base.className = "fullscreen"
        this.base = base;
        body.appendChild(base);

        let window = document.createElement("div");
        window.className = "popup-window";
        base.appendChild(window);
        this.window = window;
    }

    close()
    {
        this.base.remove();
    }
}

class OpenPopup extends Popup
{
    constructor(base: HTMLElement)
    {
        super(base);
    }
}

class DKKProgram
{
    body: HTMLBodyElement;
	draw_options = new DrawOptions();
	mode: CliqueViewer | EmbeddingEditor = CliqueViewer.destructive_new(
		prebuilt_dag_embedding(0),
		this.draw_options
	);
    popup_open: boolean = false;

	constructor()
	{
        this.body = document.getElementsByTagName("body")[0] as HTMLBodyElement;
		let open_button: HTMLDivElement = document.getElementById("open-button") as HTMLDivElement;
		open_button.onclick = (ev) => {
            this.open_button_click();
		};
	}

    open_button_click()
    {
        if(this.popup_open) { return; }

        this.popup_open = true;
        let popup = new OpenPopup(this.body);
    }

	set_clique_viewer(idx: number)
	{
		var layout = prebuilt_dag_embedding(idx);
		this.mode = CliqueViewer.destructive_new(layout, this.draw_options);
	}
}

let dkk = new DKKProgram();