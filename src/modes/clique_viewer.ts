import { DAGCanvas, DrawOptions } from "../subelements/dag_canvas";
import { FramedDAGEmbedding } from "../dag_layout";
import { RIGHT_AREA, SIDEBAR_CONTENTS, SIDEBAR_HEAD } from "../html_elems";
import { Vector } from "../util";
import { DrawOptionBox } from "../subelements/draw_option_box";
import { DAGRoutes } from "../routes/routes";

const ROUTE_RAINBOW: string[] = [
    "#5b4db7",
    "#42adc7",
    "#81d152",
    "#f5f263",
    "#ff9d4f",
    "#ff5347",
    "red",
    "red",
    "red",
    "red",
    "red",
]

export class CliqueViewer
{
    readonly draw_options: DrawOptions;
    readonly draw_options_box: DrawOptionBox;

    canvas: DAGCanvas;
    dag: FramedDAGEmbedding;
    routes: DAGRoutes;

    current_clique: number = 0;

    static destructive_new(
        dag: FramedDAGEmbedding,
        draw_options: DrawOptions,
    ): CliqueViewer
    {
        SIDEBAR_HEAD.innerHTML = "";
        SIDEBAR_CONTENTS.innerHTML = "";
        RIGHT_AREA.innerHTML = "";
        return new CliqueViewer
        (
            dag, draw_options,
            SIDEBAR_HEAD, SIDEBAR_CONTENTS, RIGHT_AREA
        );
    }

    static dummy_new(
        dag: FramedDAGEmbedding,
        draw_options: DrawOptions,
    ){
        let get_dummy = () => document.createElement("div");
        return new CliqueViewer
        (
            dag, draw_options,
            get_dummy(), get_dummy(), get_dummy()
        );
    }

    private constructor(
        dag: FramedDAGEmbedding,
        draw_options: DrawOptions,

        sidebar_head: HTMLDivElement,
        sidebar_contents: HTMLDivElement,
        right_area: HTMLDivElement
    )
    {
        this.dag = dag;
        this.draw_options = draw_options;
        this.routes = new DAGRoutes(dag.base_dag);

        //sidebar
        sidebar_head.innerText = "Clique Viewer";
        
        //Settings box
        let {box, element: box_element} = DrawOptionBox.create(draw_options);
        sidebar_contents.appendChild(box_element);
        box.add_on_change(
            () => {if(this) this.draw()}
        )
        this.draw_options_box = box;

        //Graph Canvas
        let {canvas, element: canvas_element} = DAGCanvas.create(draw_options);
		right_area.appendChild(canvas_element);
		canvas_element.addEventListener("click",
			(ev) => {
				this.canvas_click(new Vector(ev.layerX, ev.layerY))
			}
		)
        canvas.resize_canvas();
		this.canvas = canvas;

        //Draw and setup redraw
        this.draw();
        addEventListener("resize", (event) => {
            if(this)
            this.draw();
        });
    }


    canvas_click(position: Vector)
    {
        this.draw()
    }

    /*
    Code for drawing
    */


    draw()
    {		
        let ctx = this.canvas.get_ctx();
        let data = this.dag.bake();

        ctx.clearRect(0, 0, this.canvas.canvas.width, this.canvas.canvas.height);

        for(let edge_idx = 0; edge_idx < data.edges.length; edge_idx++)
        {
            let edge = data.edges[edge_idx];
            this.canvas.draw_bez(
                edge, 
                this.draw_options.edge_color + "22",
                this.draw_options.stroke_weight,
                ctx,
                true
            );

            //routes
            let routes = this.routes.routes_at_by_clique_idx(edge_idx, this.current_clique);
            if(routes.length == 0)
                continue;
            let full_width = this.draw_options.stroke_weight * Math.pow(routes.length, 0.9);
            let width = full_width / routes.length * 1.01;
            for(let i = 0; i < routes.length; i++)
            {
                let r = routes[i];
                let color = ROUTE_RAINBOW[r];
                let offset = Vector.zero();
                if(routes.length > 1)
                {
                    let percent = i / (routes.length - 1) - 0.5;
                    offset = new Vector(0, percent * width).scale(1/this.draw_options.scale);
                }
                this.canvas.draw_bez(
                    edge.transform((v) => v.add(offset)),
                    color,
                    width,
                    ctx,
                    false
                )
            }
        }



        for(let vert of data.verts)
        { this.canvas.draw_node(vert, ctx); }

    }

}