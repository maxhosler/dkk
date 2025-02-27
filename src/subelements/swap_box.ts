import { DrawOptions } from "./dag_canvas";

export class SwapBox
{
    draw_options: DrawOptions;
    on_click: (idx: number) => void;
    boxes: HTMLDivElement[];
    route_idxs: number[];

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
        let color_idxs: number[] = []
        for(let i = 0; i < clique_size; i++)
        {
            let box = document.createElement("div");
            let idx = i+0;
            box.onclick = () => {
                this.on_click(this.route_idxs[idx]);
            };
            box.className = "swap_button";
            box.innerText = "Swap";
            
            main_box.appendChild(box);

            boxes.push(box);

            color_idxs.push(0);
        }
        this.boxes = boxes;
        this.route_idxs = color_idxs;
    }

    set_color(box_idx: number, color_idx: number)
    {   
        this.route_idxs[box_idx] = color_idx;
        this.update_color();
    }

    swap_color(old_color_idx: number, new_color_idx: number)
    {
        for(let i = 0; i < this.route_idxs.length; i++)
        {
            if (this.route_idxs[i] == old_color_idx)
            {
                this.route_idxs[i] = new_color_idx;
                this.update_color();
                return;
            }    
        }
        console.warn("Failed to swap color!")
    }

    update_color()
    {
        for(let i = 0; i < this.boxes.length; i++)
        {
            this.boxes[i].style.backgroundColor =
                this.draw_options.get_route_color(this.route_idxs[i]);
        }
    }
}