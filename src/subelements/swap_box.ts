import { DrawOptions } from "../draw/draw_options";
import { Clique } from "../math/routes";

export class SwapBox
{
    main_box: HTMLDivElement;
    draw_options: DrawOptions;
    on_click: (idx: number) => void;
    on_mouseover: (idx: number) => void;
    on_mouseleave: (idx: number) => void;

    boxes: HTMLDivElement[];
    route_idxs: number[];

    static create(
        on_click: (idx: number) => void,
        on_mouseover: (idx: number) => void,
        on_mouseleave: (idx: number) => void,
        draw_options: DrawOptions,
        clique_size: number
    ): { box: SwapBox, element: HTMLDivElement }
	{
		let element = document.createElement("div")
		element.className = "sb-subsection";
		let box = new SwapBox(
            element,
            on_click,
            on_mouseover,
            on_mouseleave,
            draw_options,
            clique_size
        );
		return {
			box: box,
			element: element
		}
	}

    private constructor(
        main_box: HTMLDivElement,
        on_click: (idx: number) => void,
        on_mouseover: (idx: number) => void,
        on_mouseleave: (idx: number) => void,
        draw_options: DrawOptions,
        clique_size: number
    )
    {
        this.main_box = main_box;
        this.draw_options = draw_options;
        this.on_click = on_click;
        this.on_mouseleave = on_mouseleave;
        this.on_mouseover = on_mouseover;

        let boxes: HTMLDivElement[] = [];
        let color_idxs: number[] = []
        for(let i = 0; i < clique_size; i++)
        {
            let box = document.createElement("div");
            let idx = i+0;
            box.onclick = () => {
                this.on_click(this.route_idxs[idx]);
            };

            box.addEventListener("mouseover",
                () => this.on_mouseover(this.route_idxs[idx])
            )
            box.addEventListener("mouseleave",
                () => this.on_mouseleave(this.route_idxs[idx])
            )

            box.className = "swap_button";
            box.innerHTML = "<div class=\"swap-dot\"/>";
            
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

    show_enabled(route_idx: number, enabled: boolean)
    {
        let i = this.route_idxs.indexOf(route_idx);
        if(i===-1)
        {
            console.warn("Tried to show_enabled invalid index.");
            return;
        }
        let box = this.boxes[i];

        box.classList.remove("swap-greyed");
        if(!enabled)
        {
            box.classList.add("swap-greyed");
        }
    }

    refresh(clq: Clique)
    {
        if(this.route_idxs.length != clq.routes.length)
        {
            console.warn("Tried to set clique with incompatible size.");
            return;
        }

        for(let i = 0; i < clq.routes.length; i++)
        {
            this.route_idxs[i] = clq.routes[i];
        }
        this.update_color()
    }

    show_all_boxes()
    {
        for(let box of this.boxes)
            box.style.display = ""
    }

    hide_box(route_idx: number)
    {
        for(let i = 0; i < this.route_idxs.length; i++)
        {
            if(this.route_idxs[i] == route_idx)
            {
                this.boxes[i].style.display = "none"
            }
        }
    }
}