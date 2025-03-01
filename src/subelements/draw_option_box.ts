import { DrawOptions } from "../draw/draw_options";

const SCALE_LOWER: number = 80;
const SCALE_UPPER: number = 300;


export class DrawOptionBox
{
    draw_options: DrawOptions;

    scale_slider: HTMLInputElement;

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
        box: HTMLDivElement,
        draw_options: DrawOptions
    )
    {
        this.draw_options = draw_options;

        let scale_slider = this.build_slider(draw_options);
        this.scale_slider = scale_slider;

        let table = this.build_table(scale_slider);
        box.appendChild(table);
    }

    private build_slider(draw_options: DrawOptions): HTMLInputElement
    {
        let scale_slider = document.createElement("input");
        scale_slider.type = "range";
        scale_slider.className = "slider";
        scale_slider.min = SCALE_LOWER.toString();
        scale_slider.max = SCALE_UPPER.toString();
        scale_slider.value = draw_options.scale().toString();
        scale_slider.oninput = (ev) => {
            let as_num = Number(scale_slider.value);
            draw_options.set_scale(as_num);
        };
        return scale_slider;
    }

    private build_table(slider: HTMLInputElement): HTMLTableElement
    {
        let table = document.createElement("table");
        table.className = "inputtable";

        let data: {name: string, elem: HTMLElement}[] = [
            {name: "Scale", elem: slider},
        ];

        for(let row_data of data)
        {
            let row = document.createElement("tr");
            table.appendChild(row);

            let name = document.createElement("td");
            name.innerText = row_data.name;

            let obj = document.createElement("td");
            obj.appendChild(row_data.elem);

            row.appendChild(name);
            row.appendChild(obj);
        }

        return table;
    }

}