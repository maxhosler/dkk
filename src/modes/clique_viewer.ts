import { DAGCanvas } from "../subelements/dag_canvas";
import { FramedDAGEmbedding } from "../dag_layout";
import { RIGHT_AREA, SIDEBAR_CONTENTS, SIDEBAR_HEAD } from "../html_elems";
import { Vector } from "../util";
import { DrawOptionBox } from "../subelements/draw_option_box";
import { DAGCliques } from "../routes/routes";
import { SwapBox } from "../subelements/swap_box";
import { FlowPolytope } from "../routes/polytope";
import { PolytopeCanvas } from "../subelements/polytope_canvas";
import { DrawOptions } from "../draw/draw_options";

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
        this.cliques = new DAGCliques(dag.base_dag);
        this.polytope = new FlowPolytope(this.cliques);
        this.draw_options.set_builtin_color_scheme(
            this.cliques.routes.length
        );
        draw_options.add_change_listener(() => {
            if(this) this.draw();
            if(this.swap_box) this.swap_box.update_color();
        });

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

        let cc = this.cliques.cliques[
            this.current_clique
        ];
        for(let i = 0; i < cc.routes.length; i++)
        { this.swap_box.set_color(i, cc.routes[i]) }

        this.update_route_enabled()
    }


    clique_canvas_click(position: Vector)
    {
        this.draw_clique()
    }

    route_swap(idx: number)
    {
        let old_clq = this.current_clique;
        let new_clq = this.cliques.route_swap_by_route_idx(
            this.current_clique,
            idx
        );

        this.current_clique = new_clq;

        let oc = this.cliques.cliques[old_clq];
        let nc = this.cliques.cliques[new_clq];
        this.poly_canvas.set_clique(nc);

        if(old_clq != new_clq) {
            let old_route = -1;
            for(let r of oc.routes)
            {
                if(!nc.routes.includes(r))
                {
                    old_route = r;
                    break;
                }
            }

            let new_route = -1;
            for(let r of nc.routes)
            {
                if(!oc.routes.includes(r))
                {
                    new_route = r;
                    break;
                }
            }

            if(old_route !== -1 && new_route !== -1)
                this.swap_box.swap_color(old_route, new_route);
            else
                console.warn("Old route and new clique do not differ as expected.")
        
            this.update_route_enabled();
        }

        this.draw();
    }

    update_route_enabled()
    {
        let nc = this.cliques.cliques[this.current_clique];
        for(let r of nc.routes)
        {
            let en = this.cliques.route_swap_by_route_idx(
                this.current_clique,
                r
            ) != this.current_clique;
            this.swap_box.show_enabled(r, en);
        }
    }

    /*
    Code for drawing
    */


    draw()
    {
        this.draw_clique();
        this.draw_hasse();
        this.draw_polytope();
        this.swap_box.update_color();
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
                this.draw_options.edge_weight(),
                true
            );

            //routes
            let routes = this.cliques.routes_at(edge_idx, this.current_clique);
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
                let mid = positions[i].add(positions[j]).scale(0.5);
                let rts = hasse.cover_routes[i][j];
                let color1 = this.draw_options.get_route_color(rts[0]);
                let color2 = this.draw_options.get_route_color(rts[1]);
                ctx.draw_line(
                    positions[i],
                    mid,
                    color1,
                    this.draw_options.hasse_edge_weight()
                );
                ctx.draw_line(
                    mid,
                    positions[j],
                    color2,
                    this.draw_options.hasse_edge_weight()
                );
            }
        }

        for(let i = 0; i < positions.length; i++)
        {   
            let color = "#000000";
            if(this.current_clique == i)
                color = "#ffffff";
            let pos = positions[i];
            ctx.draw_circ(
                pos,
                color,
                this.draw_options.node_radius()
            )
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