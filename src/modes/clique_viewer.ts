import { DAGCanvas, DAGCanvasContext } from "../subelements/dag_canvas";
import { BakedDAGEmbedding, FramedDAGEmbedding, JSONFramedDagEmbedding } from "../draw/dag_layout";
import { RIGHT_AREA, SIDEBAR_CONTENTS, SIDEBAR_HEAD } from "../html_elems";
import { Bezier, BoundingBox, Vector2 } from "../util/num";
import { DrawOptionBox } from "../subelements/draw_option_box";
import { DAGCliques, JSONDAGCliques } from "../math/routes";
import { SwapBox } from "../subelements/swap_box";
import { FlowPolytope, JSONFlowPolytope } from "../math/polytope";
import { PolytopeCanvas } from "../subelements/polytope_canvas";
import { DrawOptions } from "../draw/draw_options";
import { IMode, ModeName } from "./mode";
import { Option } from "../util/result";
import { css_str_to_rgb, hsl_to_rgb, rgb_to_hsl } from "../draw/colors";

export class CliqueViewer implements IMode
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

    readonly resize_event: (ev: UIEvent) => void;

    current_clique: number = 0;
    
    current_dag_bez: {bez: Bezier, route: number, width: number}[] = [];
    moused_over_route: Option<number> = Option.none();

    name(): ModeName {
        return "clique-viewer"
    }
    current_embedding(): FramedDAGEmbedding {
        return this.dag;
    }
    current_data_json(): string {
        return this.dag.to_json();
    }

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
        this.cliques = new DAGCliques(dag.dag);
        this.polytope = new FlowPolytope(this.cliques);
        this.draw_options.set_builtin_color_scheme(
            this.cliques.routes.length
        );

        draw_options.add_change_listener(() => {
            let nc = this.cliques.cliques[this.current_clique];
            this.poly_canvas.set_clique(nc);
            this.draw();
            this.update_swap_box();
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
            (idx: number) => {
                this.moused_over_route = Option.some(idx);
                this.draw();
            },
            (idx: number) => {
                if(!this.moused_over_route.is_some()) return;
                if(this.moused_over_route.unwrap() != idx) return;
                this.moused_over_route = Option.none();
                this.draw();
            },
            draw_options,
            this.cliques.clique_size
        );
        sidebar_contents.appendChild(swap_box_element);
        this.swap_box = swap_box;

        //Right area dividers
        let segments = build_right_area_zones();
        right_area.appendChild(segments.root);

        //Resize
        if(this.polytope.dim > 3)
        {
            segments.poly.className = "clq-minify";
        }


        //Graph Canvas
        let {canvas: clique_canvas, element: c_canvas_element} = DAGCanvas.create(draw_options);
		segments.clique.appendChild(c_canvas_element);
		c_canvas_element.addEventListener("click",
			(ev) => {
				this.clique_canvas_click(new Vector2(ev.layerX, ev.layerY))
			}
		)
        c_canvas_element.addEventListener("mousemove",
            (ev) => {
                this.update_moused_over(new Vector2(ev.layerX, ev.layerY))
            }
        );
        c_canvas_element.addEventListener("mouseleave",
            (ev) => {
                this.moused_over_route.is_some()
                {
                    this.moused_over_route = Option.none();
                    this.draw();
                }
            }
        )
        clique_canvas.resize_canvas();
		this.clique_canvas = clique_canvas;

        //Hasse Canvas
        let {canvas: hasse_canvas, element: h_canvas_element} = DAGCanvas.create(draw_options);
        segments.hasse.appendChild(h_canvas_element);
        hasse_canvas.resize_canvas();
        h_canvas_element.addEventListener("click",
			(ev) => {
				this.hasse_canvas_click(new Vector2(ev.layerX, ev.layerY))
			}
		)
        this.hasse_canvas = hasse_canvas;

        //Polytope canvas
        let {canvas: poly_canvas, element: p_canvas_element} = PolytopeCanvas.create(draw_options);
        segments.poly.appendChild(p_canvas_element);
        poly_canvas.resize_canvas();
        poly_canvas.set_polytope(this.polytope, this.cliques.cliques[this.current_clique]);
        this.poly_canvas = poly_canvas;

        //Draw and setup redraw
        this.resize_event = (event) => {
            this.clique_canvas.resize_canvas();
            this.hasse_canvas.resize_canvas();
            this.poly_canvas.resize_canvas();

            this.draw()
        };
        this.draw();
        addEventListener("resize", this.resize_event);

        let cc = this.cliques.cliques[ this.current_clique ];
        for(let i = 0; i < cc.routes.length; i++)
        { this.swap_box.set_color(i, cc.routes[i]) }

        this.update_route_enabled();
        this.update_swap_box();
    }

    clear_global_events(): void {
        removeEventListener("resize", this.resize_event);
    }


    clique_canvas_click(position: Vector2)
    {
        if(this.moused_over_route.is_some())
        {
            let r = this.moused_over_route.unwrap();
            this.moused_over_route = Option.none();
            this.route_swap(r);
        }
        this.draw()
        this.update_moused_over(position);
    }

    hasse_canvas_click(position: Vector2)
    {
        let canvas_pos = this.hasse_canvas.local_trans_inv(position);
        let positions = this.get_hasse_positions();
        let closest = -1;
        let min_dist = Infinity;
        for(let i = 0; i < positions.length; i++)
        {
            let dist = positions[i].sub(canvas_pos).norm();
            if(dist <= min_dist)
            {
                closest = i;
                min_dist = dist;
            }
        }

        if(closest >= 0) {
            this.current_clique = closest;
            this.refresh_swapbox()
        }

        this.draw()
    }

    refresh_swapbox()
    {
        let clq = this.cliques.cliques[this.current_clique];
        this.swap_box.refresh(clq);
        for(let r of clq.routes)
        {
            let enabled = this.cliques.route_swap_by_route_idx
            (
                this.current_clique, r
            ) != this.current_clique;
            this.swap_box.show_enabled(r, enabled)
        };

        this.poly_canvas.set_clique(clq)
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
        
            if(this.moused_over_route.is_some() && old_route == this.moused_over_route.unwrap())
                this.moused_over_route = Option.some(new_route);

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

    update_swap_box()
    {
        this.swap_box.update_color();
        if(this.draw_options.show_exceptional())
            this.swap_box.show_all_boxes()
        else
            for(let r of this.cliques.exceptional_routes)
                this.swap_box.hide_box(r);
    }

    update_moused_over(position: Vector2)
    {
        let route_at = this.get_route_at(position);
        let changed = (
            route_at.valid != this.moused_over_route.valid || 
            route_at.value != this.moused_over_route.value
        );
        if(changed)
        {
            this.moused_over_route = route_at;
            this.draw();
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
        this.current_dag_bez = [];

        ctx.clear();

        for(let edge_idx = 0; edge_idx < data.edges.length; edge_idx++)
        {
            let edge = data.edges[edge_idx];
            let orthog = edge.end_point
                .sub(edge.start_point)
                .rot90()
                .normalized();
            ctx.draw_bez(
                edge, 
                this.draw_options.edge_color() + "22",
                this.draw_options.edge_weight(),
                false
            );

            //routes
            let routes = this.cliques.routes_at(edge_idx, this.current_clique);
            if(!this.draw_options.show_exceptional())
                routes = routes.filter( i => !this.cliques.exceptional_routes.includes(i));
            if(routes.length == 0)
                continue;
            let full_width = this.draw_options.route_weight() * Math.pow(routes.length, 0.8);
            let width = full_width / routes.length * 1.01;
            for(let i = 0; i < routes.length; i++)
            {
                let r = routes[i];
                let color = this.draw_options.get_route_color(r);
                let offset = Vector2.zero();
                if(routes.length > 1)
                {
                    let percent = i / (routes.length - 1) - 0.5;
                    offset = orthog.scale(percent * (full_width - width)/this.draw_options.scale());
                }
                let bez = edge.transform((v) => v.add(offset));
                this.current_dag_bez.push({
                    bez, route: r, width
                });
                ctx.draw_bez(
                    bez,
                    color,
                    width,
                    false
                )
            }
        }

        if(this.moused_over_route.is_some())
        {
            let route = this.moused_over_route.unwrap();
            let color = lighten_css_str(
                this.draw_options.get_route_color(route),
                0.15
            );
            for(let cd of this.current_dag_bez)
            {
                if(cd.route != route) continue;
                ctx.draw_bez(
                    cd.bez,
                    color,
                    cd.width*1.1,
                    false
                );
            }
        }

        if(this.draw_options.label_framing())
			ctx.decorate_edges_num(
				this.dag.dag,
				data
			);

        for(let vert of data.verts)
        { ctx.draw_node(vert); }

    }

    draw_hasse()
    {
        let ctx = this.hasse_canvas.get_ctx();
        ctx.clear();

        let hasse = this.cliques.hasse;
        let positions = this.get_hasse_positions();

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

        if(!this.draw_options.hasse_show_cliques())
        {
            for(let i = 0; i < positions.length; i++)
            {   
                let color = this.draw_options.hasse_node_color();
                if(this.current_clique == i)
                    color = this.draw_options.hasse_current_node_color();

                let pos = positions[i];
                ctx.draw_circ(
                    pos,
                    color,
                    this.draw_options.hasse_node_size()
                );
            }
        }
        else
        {
            let data = this.dag.bake();
            for(let i = 0; i < positions.length; i++)
            {   
                let pos = positions[i];
                this.draw_mini_clique(
                    pos,
                    i,
                    data,
                    ctx
                );
            }
        }
        
        
    }

    draw_polytope()
    {
        this.poly_canvas.draw();
    }

    draw_mini_clique(
        center: Vector2,
        clique_idx: number,
        data: BakedDAGEmbedding,
        ctx: DAGCanvasContext
    )
    {
        let rad = 1.0;
        for(let p of data.verts)
            rad = Math.max(p.norm(), rad);
        
        let scale = this.draw_options.hasse_mini_dag_size() / (rad * this.draw_options.scale());

        let box = new BoundingBox([]);
        for(let edge_idx = 0; edge_idx < data.edges.length; edge_idx++) {

            let edge = data.edges[edge_idx].transform(
                (v) => v.scale(scale).add(center) 
            );
            box.add_point(edge.start_point);
            box.add_point(edge.cp1);
            box.add_point(edge.cp2);
            box.add_point(edge.end_point);
        }
        box.pad(1.0 * this.draw_options.hasse_mini_vert_rad() / this.draw_options.scale());
        ctx.draw_box(
            box.top_corner,
            box.bot_corner,
            this.draw_options.background_color()
        )
        if(clique_idx == this.current_clique)
        {
            ctx.draw_rounded_box(
                box.top_corner,
                box.bot_corner,
                10,
                this.draw_options.hasse_current_color()
            );
        }

        for(let edge_idx = 0; edge_idx < data.edges.length; edge_idx++) {

            let edge = data.edges[edge_idx].transform(
                (v) => v.scale(scale).add(center) 
            );
            let orthog = edge.end_point
                .sub(edge.start_point)
                .rot90()
                .normalized();

            let routes = this.cliques.routes_at(edge_idx, clique_idx);
            if(!this.draw_options.show_exceptional())
                routes = routes.filter( i => !this.cliques.exceptional_routes.includes(i));
            if(routes.length == 0)
                continue;

            let full_width = this.draw_options.hasse_mini_route_weight() * Math.pow(routes.length, 0.8);
            let width = full_width / routes.length * 1.01;
            for(let i = 0; i < routes.length; i++)
            {
                let r = routes[i];
                let color = this.draw_options.get_route_color(r);
                let offset = Vector2.zero();
                if(routes.length > 1)
                {
                    let percent = i / (routes.length - 1) - 0.5;
                    offset = orthog.scale(percent * (full_width - width)/this.draw_options.scale());
                }
                ctx.draw_bez(
                    edge.transform((v) => v.add(offset)),
                    color,
                    width,
                    false
                )
            }
        }

        for(let pos of data.verts)
        {
            ctx.draw_circ(
                pos.scale(scale).add(center),
                this.draw_options.vertex_color(),
                this.draw_options.hasse_mini_vert_rad()
            )
        }
    }

    get_hasse_positions(): Vector2[]
    {
        const PADDING: number = 100; //TODO: make parameter

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

        return hasse.layout_rows
            .map(v => v.scale(scale));
    }

    /*
    Util
    */

    get_route_at(pos: Vector2): Option<number>
    {
        let position = this.clique_canvas.local_trans_inv(pos);
        let closest_dist = Infinity;
        let closest: Option<number> = Option.none();
        let scale = this.draw_options.scale();
        for(let current of this.current_dag_bez)
        {
            let dist = current.bez.distance_to(position);
            if(dist < closest_dist && dist * scale < current.width / 2)
            {
                closest_dist = dist;
                closest = Option.some(current.route);
            }
        }

        return closest;
    }

    to_data_json_ob(): JSONCliqueData
    {
        return {
            dag: this.dag.to_json_ob(),
            polytope: this.polytope.to_json_ob(),
            cliques: this.cliques.to_json_ob()
        }
    }
}
export type JSONCliqueData =
{
    dag: JSONFramedDagEmbedding,
    polytope: JSONFlowPolytope,
    cliques: JSONDAGCliques
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

function lighten_css_str(str: string, amount: number): string
{   
    let rgb = css_str_to_rgb(str);
    let hsl = rgb_to_hsl(...rgb);
    hsl[2] = Math.min(hsl[2] + amount, 1);
    let rgb2 = hsl_to_rgb(...hsl);
    return `rgb(${rgb2[0]}, ${rgb2[1]}, ${rgb2[2]})`;
}