import { prebuilt_dag_embedding } from "./draw/dag_layout";
import { DrawOptions } from "./draw/draw_options";
import { CliqueViewer } from "./modes/clique_viewer";
import { EmbeddingEditor } from "./modes/embedding_editor";
import { IMode } from "./modes/mode";
import { CVOpenPopup } from "./popup/cv-open";
import { EEOpenPopup } from "./popup/ee-open";
import { SettingsPopup } from "./popup/settings";

export class DKKProgram
{
    body: HTMLBodyElement;
	draw_options = new DrawOptions(true, true);
	mode: IMode = CliqueViewer.destructive_new(
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

        let settings_button: HTMLDivElement = document.getElementById("settings-button") as HTMLDivElement;
		settings_button.onclick = (ev) => {
            this.settings_button_click();
		};

        let switch_button: HTMLDivElement = document.getElementById("switch-button") as HTMLDivElement;
        switch_button.onclick = (ev) => {
            this.switch_button_click();
        }
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

        if(this.mode.name() == "embedding-editor")
        {
            this.mode = CliqueViewer.destructive_new(
                prebuilt_dag_embedding(0),
                this.draw_options
            );
        }
        else
        {
            this.mode = EmbeddingEditor.destructive_new(
                prebuilt_dag_embedding(0),
                this.draw_options
            )
        }
    }

	set_clique_viewer(idx: number)
	{
		var layout = prebuilt_dag_embedding(idx);
		this.mode = CliqueViewer.destructive_new(layout, this.draw_options);
	}
}
