import { FramedDAGEmbedding } from "./draw/dag_layout";
import { DrawOptions } from "./draw/draw_options";
import { FramedDAG } from "./math/dag";
import { CliqueViewer, JSONCliqueData } from "./modes/clique_viewer";
import { EmbeddingEditor } from "./modes/embedding_editor";
import { IMode } from "./modes/mode";
import { NewPopup } from "./popup/new";
import { SettingsPopup } from "./popup/settings";
import { preset_dag_embedding } from "./preset";
import { SaveData } from "./load";
import { OpenPopup } from "./popup/open";

/*
This class handles the top-bar, swapping between modes, and most popups.
It is constructed once one page load.
*/
export class DKKProgram
{
    //Internal data and state
	draw_options = new DrawOptions(true, true);
	mode: IMode = EmbeddingEditor.destructive_new(
		preset_dag_embedding("cube"),
		this.draw_options
	);
    popup_open: boolean = false;

    /*************
    HTML Elements
    *************/
    body: HTMLBodyElement;

    //Button on the top bar
    settings_button: HTMLDivElement;
    switch_button: HTMLDivElement;
    open_button: HTMLDivElement;
    new_button: HTMLDivElement;
    save_button: HTMLDivElement;

    //Dropdown menu
    save_dropdown: HTMLDivElement;
    save_dropdown_shown: boolean = false;

    //Items in the dropdown menu
    save_dag_ddelem: HTMLDivElement;
    save_data_ddelem: HTMLDivElement;

	constructor()
	{
        this.body = document.getElementsByTagName("body")[0] as HTMLBodyElement;

        //Attaching all the 'onclick' events to buttons on the top-bar.
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

        this.save_button = document.getElementById("save-button") as HTMLDivElement;
        this.save_button.onclick = (ev) => {
            this.save_button_click();
        }

        //Get and hide the dropdown menu.
        this.save_dropdown = document.getElementById("save-dropdown") as HTMLDivElement;
        this.save_dropdown.style.display = "none";

        this.save_dag_ddelem = document.getElementById("dd-save-dag") as HTMLDivElement;
        this.save_data_ddelem = document.getElementById("dd-save-precomp") as HTMLDivElement;

        //Add events to the dropdown menu
        this.save_dag_ddelem.addEventListener("click",
            (ev) => {
                this.save_dag_dd_click();         //Save
                this.save_dropdown_shown = false; //Set dropdown to hidden
                this.show_hide_items();           //Update screen
                ev.stopPropagation();             //Prevent this from triggering parent events
            }
        )
        this.save_data_ddelem.addEventListener("click",
            (ev) => {
                this.save_data_dd_click();        //Ditto to above.
                this.save_dropdown_shown = false;
                this.show_hide_items();
                ev.stopPropagation();
            }
        )

        this.show_hide_items();
	}

    open_button_click()
    {
        if(this.popup_open) { return; } //Ignore if popup is open.

        //Opens a popup menu, different one based on state.
        this.popup_open = true;
        new OpenPopup(
            this.body,
            this
        );
        
    }

    settings_button_click()
    {
        if(this.popup_open) { return; } //Ignore if popup is open.

        //Open settings menu
        this.popup_open = true;
        new SettingsPopup(
            this.body,
            this
        );
    }

    switch_button_click()
    {
        if(this.popup_open) { return; } //Ignore if popup is open.

        //Grab current FramedDAGEmbedding from current mode.
        let embedding = this.mode.current_embedding();

        /*
        Don't switch if DAG isn't valid!
        Checks if DAG doesn't have unique sink and source.
        Other ways of being invalid (i.e. having cycles) are prevented
        from happening in the first place.
        */ 
        if(this.mode.name() == "embedding-editor" && !embedding.dag.valid())
        {
            alert("Can't view; not a connected DAG with one source and one sink!")
            return;
        }

        //Swap to the other mode.
        if(this.mode.name() == "embedding-editor")
        {
            this.set_mode(CliqueViewer.destructive_new(
                embedding,
                this.draw_options
            ));
        }
        else
        {
            this.set_mode(EmbeddingEditor.destructive_new(
                embedding,
                this.draw_options
            ));
        }
        this.show_hide_items();
    }

    new_button_click()
    {
        if(this.popup_open) { return; } //Ignore if popup is open.

        //Open 'New DAG' popup.
        this.popup_open = true;
        new NewPopup(
            this.body,
            this
        );
    }

    load_save_data(data: SaveData)
    {
        if(data.datatype == "emb_dag")
        {
            let d = data.data;
            this.set_dag(d);
        }
        else if(data.datatype == "precomp")
        {
            let d = data.data;
            this.set_dag_precomp(d);
        }
        else if(data.datatype == "dag")
        {
            let d = data.data;
            this.set_dag(new FramedDAGEmbedding(d));
        }
    }

    save_button_click()
    {

        if(this.mode.name() == "embedding-editor")
            //If in embedding editor, just save the DAG to a file.
            this.save_current_data()
        else if(this.mode.name() == "clique-viewer")
        {
            //If in clique viewer, open dropdown menu so you can either
            //save just the DAG, or the DAG and precomputed data.
            this.save_dropdown_shown = !this.save_dropdown_shown;
            this.show_hide_items();
        }
    }

    //Save dag.
    save_dag_dd_click()
    {
        this.save_current_data();
    }

    /*
    Save dag and precomputed data. Only works if clique viewer.
    Will do nothing otherwise, but won't throw an error.
    */
    save_data_dd_click()
    {
        if(this.mode.name() == "clique-viewer")
        {
            let mode = this.mode as CliqueViewer;
            let json = {
                datatype: "precomp",
                data: mode.to_data_json_ob()
            }
            save_json_string(
                JSON.stringify(json), "dag_and_data"
            )
        }
    }

    //Save DAG to json file.
    save_current_data()
    {
        let data = this.mode.current_embedding().to_json_object();
        let json = {
            datatype: "emb_dag",
            data
        };
        save_json_string(JSON.stringify(json), "dag");
    }

    /*
    Updates the screen based on change of state;
    shows and hides certain elements based on the
    current mode, and handles showing and hiding
    the dropdown.
    */
    show_hide_items()
    {
        if(this.mode.name() == "embedding-editor")
        {
            this.new_button.style.display = "block";
            this.save_dropdown_shown = false;
        }
        if(this.mode.name() == "clique-viewer")
        {
            this.new_button.style.display = "none";
        }

        if(this.save_dropdown_shown)
            this.save_dropdown.style.display = "";
        else
            this.save_dropdown.style.display = "none";
    }

    //Loads the provided DAG into the current mode.
	set_dag(emb: FramedDAGEmbedding)
	{
		if(this.mode.name() == "clique-viewer")
		    this.set_mode(CliqueViewer.destructive_new(emb, this.draw_options));
        else if(this.mode.name() == "embedding-editor")
            this.set_mode(EmbeddingEditor.destructive_new(emb, this.draw_options));
	}

    /*
    Loads the provided DAG, as well as any precomputed data, into the 
    clique viewer. Since this is not intended to be called outside the clique
    viewer, does nothing when not.

    If the loaded data is found to be invalid, does nothing and shows alert.
    */
    set_dag_precomp(emb: JSONCliqueData)
    {
        if(this.mode.name() == "clique-viewer")
        {
            let attempt = CliqueViewer.precomp_destructive_new(emb, this.draw_options);
            if(attempt.is_ok())
                this.set_mode(attempt.unwrap())
            else
                alert("Invalid DAG data! "+attempt.error().err_message);
        }
    }

    set_mode(mode: IMode)
    {
        this.mode.clear_global_events();
        this.mode = mode;
    }
}

/*
Downloads JSON string to disk with name {name}.json.
Don't know why the only way to do this is this hack.
*/
function save_json_string(json: string, name: string)
{
    let blob = new Blob([json], {type: 'text/json'});
    let a = document.createElement("a");
    a.setAttribute('href', URL.createObjectURL(blob));
    a.setAttribute('download', name+'.json');
    let ev = new MouseEvent("click", {
        "view": window,
        "bubbles": true,
        "cancelable": false
    });
    a.dispatchEvent(ev);
    a.remove();
}