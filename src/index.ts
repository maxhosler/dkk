import { DrawOptions } from "./subelements/dag_canvas";
import { prebuilt_dag_embedding } from "./dag_layout";
import { CliqueViewer } from "./modes/clique_viewer";
import { EmbeddingEditor } from "./modes/embedding_editor";

abstract class Popup
{
    close_callback: () => void;

    base: HTMLDivElement;
    window: HTMLDivElement;
    top_bar: HTMLDivElement;
    xout: HTMLDivElement;
    constructor(body: HTMLElement, title_name: string, close_callback: () => void)
    {
        this.close_callback = close_callback;

        let base = document.createElement("div");
        base.id = "shadow"
        base.className = "fullscreen"
        this.base = base;
        body.appendChild(base);

        let window = document.createElement("div");
        window.className = "popup-window";
        base.appendChild(window);
        this.window = window;

        let top_bar = document.createElement("div");
        top_bar.className = "popup-top-bar";
        window.appendChild(top_bar);
        this.top_bar = top_bar;

        let title = document.createElement("h3");
        title.innerText = title_name;
        top_bar.appendChild(title);

        let xout = document.createElement("div");
        xout.className = "popup-xout";
        xout.innerText = "X";
        xout.onclick = () => {
            this.close()
        };
        top_bar.appendChild(xout);
        this.xout = xout;
    }

    close()
    {
        this.base.remove();
        this.close_callback();
    }
}

class OpenPopup extends Popup
{
    constructor(base: HTMLElement, close_callback: () => void)
    {
        super(base, "Open", close_callback);
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
        let popup = new OpenPopup(
            this.body,
            () => this.popup_open = false
        );
    }

	set_clique_viewer(idx: number)
	{
		var layout = prebuilt_dag_embedding(idx);
		this.mode = CliqueViewer.destructive_new(layout, this.draw_options);
	}
}

let dkk = new DKKProgram();