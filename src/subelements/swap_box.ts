import { DrawOptions } from "./dag_canvas";

export class SwapBox
{
    draw_options: DrawOptions;
    on_click: (idx: number) => void;

    static create(
        on_click: (idx: number) => void,
        draw_options: DrawOptions
    ): { box: SwapBox, element: HTMLDivElement }
	{
		let element = document.createElement("div")
		element.className = "sb-subsection";
		let box = new SwapBox(element, on_click, draw_options);
		return {
			box: box,
			element: element
		}
	}

    constructor(
        box: HTMLDivElement,
        on_click: (idx: number) => void,
        draw_options: DrawOptions
    )
    {
        this.draw_options = draw_options;
        this.on_click = on_click;
    }

    recolor()
    {
        
    }
}