import { DKKProgram } from "../main";
import { Popup } from "./popup";

export class ShortcutsPopup extends Popup
{
	constructor(base: HTMLElement)
	{
		super(base, "Shortcuts", () => {});

		this.popup_body.innerHTML = `
			<table id="shortcuts-table">
				<tr>
					<td>Add edge</td>
					<td>E</td>
				</tr>
				<tr>
					<td>Remove edge</td>
					<td>Backspace</td>
				</tr>
				<tr>
					<td>Swap framing at start</td>
					<td>S</td>
				</tr>
				<tr>
					<td>Swap framing at end</td>
					<td>Shift+S</td>
				</tr>
			</table>
		`;
	}
}