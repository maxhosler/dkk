import { DAGCanvas, DrawOptions } from "../subelements/dag_canvas";
import { FramedDAGEmbedding } from "../dag_layout";
import { RIGHT_AREA, SIDEBAR_CONTENTS, SIDEBAR_HEAD } from "../html_elems";
import { Vector } from "../util";
import { DrawOptionBox } from "../subelements/draw_option_box";
import { DAGCliques } from "../routes/routes";
import { SwapBox } from "../subelements/swap_box";
import { FlowPolytope } from "../routes/polytope";
import { PolytopeCanvas } from "../subelements/polytope_canvas";

export class CliqueViewer
{
    readonly draw_options: DrawOptions;

    readonly draw_options_box: DrawOptionBox;
    readonly swap_box: SwapBox;
    
    readonly dag: FramedDAGEmbedding;
    readonly polytope: FlowPolytope;
    readonly cliques: DAGCliques;

    readonly clique_canvas: DAGCanvas;
    readonly hasse_canvas: DAGCanvas;
    readonly poly_canvas: PolytopeCanvas;

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
        draw_options.add_change_listener(() => {
            if(this) this.draw_clique();
            if(this.swap_box) this.swap_box.recolor();
        })
        this.cliques = new DAGCliques(dag.base_dag);
        this.polytope = new FlowPolytope(this.cliques);

        //sidebar
        sidebar_head.innerText = "Clique Viewer";
        
        //Settings box
        let {box, element: box_element} = DrawOptionBox.create(draw_options);
        sidebar_contents.appendChild(box_element);
        this.draw_options_box = box;

        //Swap box
        let {box: swap_box, element: swap_box_element} = SwapBox.create(
            (idx: number) => {
                this.route_swap(idx);
            },
            draw_options,
            this.cliques.clique_size
        );
        sidebar_contents.appendChild(swap_box_element);
        this.swap_box = swap_box;

        //Right area dividers
        let segments = build_right_area_zones();
        right_area.appendChild(segments.root);

        //Graph Canvas
        let {canvas: clique_canvas, element: c_canvas_element} = DAGCanvas.create(draw_options);
		segments.clique.appendChild(c_canvas_element);
		c_canvas_element.addEventListener("click",
			(ev) => {
				this.clique_canvas_click(new Vector(ev.layerX, ev.layerY))
			}
		)
        clique_canvas.resize_canvas();
		this.clique_canvas = clique_canvas;

        //Hasse Canvas
        let {canvas: hasse_canvas, element: h_canvas_element} = DAGCanvas.create(draw_options);
        segments.hasse.appendChild(h_canvas_element);
        hasse_canvas.resize_canvas();
        this.hasse_canvas = hasse_canvas;

        //Polytope canvas
        let {canvas: poly_canvas, element: p_canvas_element} = PolytopeCanvas.create(draw_options);
        segments.poly.appendChild(p_canvas_element);
        poly_canvas.resize_canvas();
        poly_canvas.set_polytope(this.polytope, this.cliques.cliques[this.current_clique]);
        this.poly_canvas = poly_canvas;

        //Draw and setup redraw
        this.draw();
        addEventListener("resize", (event) => {
            if(this)
            this.draw();
        });
    }


    clique_canvas_click(position: Vector)
    {
        this.draw_clique()
    }

    route_swap(idx: number)
    {
        this.current_clique = 
            this.cliques.route_swap(
                this.current_clique,
                idx
            );
        this.draw();
    }

    /*
    Code for drawing
    */


    draw()
    {
        this.draw_clique();
        this.draw_hasse();
        this.draw_polytope();
    }

    draw_clique()
    {		
        let ctx = this.clique_canvas.get_ctx();
        let data = this.dag.bake();

        ctx.clear();

        for(let edge_idx = 0; edge_idx < data.edges.length; edge_idx++)
        {
            let edge = data.edges[edge_idx];
            ctx.draw_bez(
                edge, 
                this.draw_options.edge_color() + "22",
                this.draw_options.stroke_weight(),
                true
            );

            //routes
            let routes = this.cliques.routes_at_by_clique_idx(edge_idx, this.current_clique);
            if(routes.length == 0)
                continue;
            let full_width = this.draw_options.route_weight() * Math.pow(routes.length, 0.8);
            let width = full_width / routes.length * 1.01;
            for(let i = 0; i < routes.length; i++)
            {
                let r = routes[i];
                let color = this.draw_options.get_route_color(r);
                let offset = Vector.zero();
                if(routes.length > 1)
                {
                    let percent = i / (routes.length - 1) - 0.5;
                    offset = new Vector(0, percent * (full_width - width)).scale(1/this.draw_options.scale());
                }
                ctx.draw_bez(
                    edge.transform((v) => v.add(offset)),
                    color,
                    width,
                    false
                )
            }
        }



        for(let vert of data.verts)
        { ctx.draw_node(vert); }

    }

    draw_hasse()
    {
        let ctx = this.hasse_canvas.get_ctx();
        ctx.clear();
        const PADDING: number = 100;

        let v_width = Math.max(1,
            this.hasse_canvas.width() - 2*PADDING
        );
        let v_height = Math.max(1,
            this.hasse_canvas.height() - 2*PADDING
        );

        let hasse = this.cliques.hasse;
        let hasse_ext = hasse.bounding_box.extent().scale(2);

        let w_scale = v_width / hasse_ext.x ;
        let h_scale = v_height / hasse_ext.y;
        let scale = Math.min(w_scale, h_scale) / this.draw_options.scale();

        let positions = hasse.layout_rows
            .map(v => v.scale(scale));

        for(let i = 0; i < hasse.covering_relation.length; i++)
        for(let j = 0; j < hasse.covering_relation.length; j++)
        {
            if(hasse.covering_relation[i][j])
            {
                ctx.draw_line(
                    positions[i],
                    positions[j],
                    "#000000",
                    5
                );
            }
        }

        for(let pos of positions)
        {            
            ctx.draw_node(pos);
        }
    }

    draw_polytope()
    {
        this.poly_canvas.draw();
    }

}

function build_right_area_zones(): {
    root: HTMLDivElement,
    poly: HTMLDivElement,
    hasse: HTMLDivElement,
    clique: HTMLDivElement
}
{
    let root = document.createElement("div");
    root.id = "clq-root";

    let lft = document.createElement("div");
    let right = document.createElement("div");
    root.appendChild(lft);
    root.appendChild(right);

    let top = document.createElement("div");
    let bot = document.createElement("div");

    lft.appendChild(top);
    lft.appendChild(bot);

    return {root, poly: bot, hasse: right, clique: top};
}