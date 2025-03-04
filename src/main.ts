import { FramedDAGEmbedding } from "./draw/dag_layout";
import { DrawOptions } from "./draw/draw_options";
import { FramedDAG } from "./math/dag";
import { CliqueViewer } from "./modes/clique_viewer";
import { EmbeddingEditor } from "./modes/embedding_editor";
import { IMode } from "./modes/mode";
import { CVOpenPopup } from "./popup/cv-open";
import { EEOpenPopup } from "./popup/ee-open";
import { NewPopup } from "./popup/new";
import { SettingsPopup } from "./popup/settings";
import { preset_dag_embedding } from "./preset";

export class DKKProgram
{
    body: HTMLBodyElement;
	draw_options = new DrawOptions(true, true);
	mode: IMode = EmbeddingEditor.destructive_new(
		preset_dag_embedding("cube"),
		this.draw_options
	);
    popup_open: boolean = false;

    settings_button: HTMLDivElement;
    switch_button: HTMLDivElement;
    open_button: HTMLDivElement;
    new_button: HTMLDivElement

	constructor()
	{
        this.body = document.getElementsByTagName("body")[0] as HTMLBodyElement;
		this.open_button = document.getElementById("open-button") as HTMLDivElement;
		this.open_button.onclick = (ev) => {
            this.open_button_click();
		};

        this.settings_button = document.getElementById("settings-button") as HTMLDivElement;
		this.settings_button.onclick = (ev) => {
            this.settings_button_click();
		};

        this.switch_button = document.getElementById("switch-button") as HTMLDivElement;
        this.switch_button.onclick = (ev) => {
            this.switch_button_click();
        };

        this.new_button = document.getElementById("new-button") as HTMLDivElement;
        this.new_button.onclick = (ev) => {
            this.new_button_click();
        };

        this.show_hide_items();
	}

    open_button_click()
    {
        if(this.popup_open) { return; }

        this.popup_open = true;
        if(this.mode.name() == "clique-viewer")
        {
            let popup = new CVOpenPopup(
                this.body,
                this
            );
        }
        else if(this.mode.name() == "embedding-editor")
        {
            let popup = new EEOpenPopup(
                this.body,
                this
            );
        }
        
    }

    settings_button_click()
    {
        if(this.popup_open) { return; }

        this.popup_open = true;
        let popup = new SettingsPopup(
            this.body,
            this
        );
    }

    switch_button_click()
    {
        if(this.popup_open) { return; }

        let dag = this.mode.current_dag();

        if(this.mode.name() == "embedding-editor")
        {
            this.mode = CliqueViewer.destructive_new(
                dag,
                this.draw_options
            );
        }
        else
        {
            this.mode = EmbeddingEditor.destructive_new(
                dag,
                this.draw_options
            )
        }
        this.show_hide_items();
    }

    new_button_click()
    {
        if(this.popup_open) { return; }

        this.popup_open = true;
        let popup = new NewPopup(
            this.body,
            this
        );
    }

    show_hide_items()
    {
        if(this.mode.name() == "embedding-editor")
        {
            this.new_button.style.display = "block";
        }
        if(this.mode.name() == "clique-viewer")
        {
            this.new_button.style.display = "none";
        }
    }

	set_clique_viewer(name: string)
	{
		var layout = preset_dag_embedding(name);
		this.mode = CliqueViewer.destructive_new(layout, this.draw_options);
	}

    set_new_clique(num_verts: number)
    {
        var newblank = new FramedDAG(num_verts);
        let layout = new FramedDAGEmbedding(newblank);
        this.mode = EmbeddingEditor.destructive_new(layout, this.draw_options);
    }
}
