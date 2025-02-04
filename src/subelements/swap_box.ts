import { DrawOptions } from "./dag_canvas";

export class SwapBox
{
    draw_options: DrawOptions;
    on_click: (idx: number) => void;
    boxes: HTMLDivElement[];

    static create(
        on_click: (idx: number) => void,
        draw_options: DrawOptions,
        clique_size: number
    ): { box: SwapBox, element: HTMLDivElement }
	{
		let element = document.createElement("div")
		element.className = "sb-subsection";
		let box = new SwapBox(element, on_click, draw_options, clique_size);
		return {
			box: box,
			element: element
		}
	}

    private constructor(
        main_box: HTMLDivElement,
        on_click: (idx: number) => void,
        draw_options: DrawOptions,
        clique_size: number
    )
    {
        this.draw_options = draw_options;
        this.on_click = on_click;

        let boxes: HTMLDivElement[] = [];
        for(let i = 0; i < clique_size; i++)
        {
            let box = document.createElement("div");
            let idx = i+0;
            box.onclick = () => {
                this.on_click(idx);
            };
            box.className = "swap_button";
            box.style.backgroundColor = this.draw_options.get_route_color(i);
            box.innerText = "Swap";
            
            main_box.appendChild(box);

            boxes.push(box);
        }
        this.boxes = boxes;
    }

    recolor()
    {
        for(let i = 0; i < this.boxes.length; i++)
            this.boxes[i].style.backgroundColor = this.draw_options.get_route_color(i);
    }
}