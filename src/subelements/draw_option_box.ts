import { DrawOptions } from "./dag_canvas";

export class DrawOptionBox
{
    draw_options: DrawOptions

    static create(draw_options: DrawOptions): { box: DrawOptionBox, element: HTMLDivElement }
	{
		let element = document.createElement("div")
		element.className = "sb-subsection";
		let box = new DrawOptionBox(element, draw_options);
		return {
			box: box,
			element: element
		}
	}

    constructor(
        box: HTMLElement,
        draw_options: DrawOptions
    )
    {
        this.draw_options = draw_options;
    }
}