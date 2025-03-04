import { DKKProgram } from "../main";
import { Popup } from "./popup";

export class EEOpenPopup extends Popup
{
	parent: DKKProgram;
	constructor(base: HTMLElement, parent: DKKProgram)
	{
		super(base, "Open", () => parent.popup_open = false);
		this.parent = parent;
	}

	
}
