import { DAGCanvas, DAGCanvasContext } from "../subelements/dag_canvas";
import { BakedDAGEmbedding, FramedDAGEmbedding, JSONFramedDagEmbedding } from "../draw/dag_layout";
import { RIGHT_AREA, SIDEBAR_CONTENTS, SIDEBAR_HEAD } from "../html_elems";
import { Bezier, BoundingBox, Vector2 } from "../util/num";
import { DrawOptionBox } from "../subelements/draw_option_box";
import { DAGCliques, JSONDAGCliques } from "../math/cliques";
import { SwapBox } from "../subelements/swap_box";
import { FlowPolytope, JSONFlowPolytope } from "../math/polytope";
import { PolytopeCanvas } from "../subelements/polytope_canvas";
import { DrawOptions } from "../draw/draw_options";
import { IMode, ModeName } from "./mode";
import { Option, Result } from "../util/result";
import { css_str_to_rgb, hsl_to_rgb, rgb_to_hsl } from "../draw/colors";

type HasseDrag = {
    dragging: boolean,
    elem: number,
    offset: Vector2
}

export class CliqueViewer implements IMode
{
    readonly draw_options: DrawOptions;

    readonly draw_options_box: DrawOptionBox; //Box containing scale slider
    readonly swap_box: SwapBox;               //Box containing route colors
    
    //Precomputed DAG/framing/polytope data
    readonly dag: FramedDAGEmbedding;
    readonly polytope: FlowPolytope;
    readonly cliques: DAGCliques;

    //Canvases
    readonly clique_canvas: DAGCanvas;
    readonly hasse_canvas: DAGCanvas;
    readonly poly_canvas: PolytopeCanvas;

    //This is stored so the event can be deleted with clear_global_events
    readonly resize_event: (ev: UIEvent) => void;

    current_clique: number = 0;
    moused_over_route: Option<number> = Option.none();

    //Represents click-and-drag state for hasse diagram nodes
    h_drag: HasseDrag = {dragging: false, elem: 0, offset: Vector2.zero()};

    //Overridden hasse node positions, for custom positioning
    hasse_overrides: {[key: number]: Vector2} = {};

    /*
    These values are computed once per draw-call, to avoid 
    recomputing them.
    */
    cur_draw_beziers: {bez: Bezier, route: number, width: number}[] = [];
    cur_draw_hasse_boxes: {[clique: number]: BoundingBox } = {};

    //IMode implementations
    name(): ModeName {
        return "clique-viewer"
    }
    current_embedding(): FramedDAGEmbedding {
        return this.dag;
    }
    clear_global_events(): void {
        removeEventListener("resize", this.resize_event);
    }

    /*
    This is 'destructive' in the send that calling this
    function completely clears out SIDEBAR_HEAD, SIDEBAR_CONTENTS,
    and RIGHT_AREA, which are the regions an IMode is supposed to
    put its elements into.
    */
    static destructive_new(
        dag: FramedDAGEmbedding,
        draw_options: DrawOptions,
    ): CliqueViewer
    {
        SIDEBAR_HEAD.innerHTML = "";
        SIDEBAR_CONTENTS.innerHTML = "";
        RIGHT_AREA.innerHTML = "";

        let cliques = new DAGCliques(dag.dag);
        let polytope = new FlowPolytope(cliques);

        return new CliqueViewer
        (
            dag, polytope, cliques, draw_options,
            SIDEBAR_HEAD, SIDEBAR_CONTENTS, RIGHT_AREA
        );
    }

    /*
    Same as above, but takes precomputed data rather than computing
    from scratch.
    */
    static precomp_destructive_new(
        data: JSONCliqueData,
        draw_options: DrawOptions,
    ): Result<CliqueViewer>
    {

        let dag = FramedDAGEmbedding.from_json_ob(data.dag);
        if(dag.is_err())
            return dag.err_to_err();
        let polytope = FlowPolytope.from_json_ob(data.polytope);
        if(polytope.is_err())
            return polytope.err_to_err();
        let cliques = DAGCliques.from_json_ob(data.cliques);
        if(cliques.is_err())
            return cliques.err_to_err();
        let hasse_overrides: {[key: number]: Vector2} = {};
        for(let i in data.hasse_overrides)
        {
            let v = data.hasse_overrides[i];
            hasse_overrides[parseInt(i)] = new Vector2(v[0], v[1]);
        }

        SIDEBAR_HEAD.innerHTML = "";
        SIDEBAR_CONTENTS.innerHTML = "";
        RIGHT_AREA.innerHTML = "";

        let cv = new CliqueViewer
        (
            dag.unwrap(), polytope.unwrap(), cliques.unwrap(), draw_options,
            SIDEBAR_HEAD, SIDEBAR_CONTENTS, RIGHT_AREA
        );
        cv.set_hasse_overrides(hasse_overrides);

        return Result.ok(cv);
    }

    private constructor(
        dag: FramedDAGEmbedding,
        polytope: FlowPolytope,
        cliques: DAGCliques,

        draw_options: DrawOptions,

        sidebar_head: HTMLDivElement,
        sidebar_contents: HTMLDivElement,
        right_area: HTMLDivElement
    )
    {
        this.dag = dag;
        this.draw_options = draw_options;
        this.cliques = cliques;
        this.polytope = polytope;
        this.draw_options.set_builtin_color_scheme(
            this.cliques.routes.length
        );

        draw_options.add_change_listener(() => {
            let nc = this.cliques.cliques[this.current_clique];
            this.poly_canvas.set_clique(nc);
            this.recomp_hasse_scale();
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

        //These events handle clicking and dragging
        //in the hasse diagram.
        h_canvas_element.addEventListener("mousedown",
            (ev) => {
                /*
                On mousedown, check to see if over hasse node.
                If so, make it the current target of dragging.
                */
                if(ev.ctrlKey){
                    this.h_drag.dragging = true
                    let mp = new Vector2(ev.layerX, ev.layerY);
                    let hp = this.get_hasse_node_at(mp);
                    if (hp.is_some())
                    {
                        let idx = hp.unwrap();
                        let pos = this.get_hasse_position(idx);
                        let descaled_mp = this.hasse_canvas.local_trans_inv(mp);
                        let offset = pos.sub(descaled_mp);

                        this.h_drag.dragging = true;
                        this.h_drag.elem = idx;
                        this.h_drag.offset = offset;
                    }
                    else
                    {
                        this.h_drag.dragging = false;
                    }
                }
            }
        );
        h_canvas_element.addEventListener("mouseup",
            (ev) => {
                //If not dragging, treat as click
                if(!this.h_drag.dragging)
                {
                    this.hasse_canvas_click(new Vector2(ev.layerX, ev.layerY));
                }

                //release drag
                this.h_drag.dragging = false;
                this.recomp_hasse_scale();
            }
        )
        h_canvas_element.addEventListener("mouseleave",
            (ev) => {
                //release drag
                this.h_drag.dragging = false;
                this.recomp_hasse_scale();
            }
        )
        h_canvas_element.addEventListener("mousemove",
            (ev) => {
                if (this.h_drag.dragging)
                {
                    //Mouse the dragged vertex around if we're dragging
                    let mp = new Vector2(ev.layerX, ev.layerY);
                    let descaled_mp = this.hasse_canvas.local_trans_inv(mp);
                    this.hasse_overrides[this.h_drag.elem] = descaled_mp.add(this.h_drag.offset);
                    this.draw();
                }
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
            this.recomp_hasse_scale();

            this.draw()
        };
        this.draw();
        addEventListener("resize", this.resize_event);

        let cc = this.cliques.cliques[ this.current_clique ];
        for(let i = 0; i < cc.routes.length; i++)
        { this.swap_box.set_color(i, cc.routes[i]) }

        this.update_route_enabled();
        this.update_swap_box();
        
        window.dispatchEvent(new Event('resize'));
        this.recomp_hasse_scale();
    }

    //Handle canvas clicks, currently just handles clicking
    //on routes to mutate.
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

    //Handle hasse clicks, currently just
    //swaps to clicked node
    hasse_canvas_click(position: Vector2)
    {
        let clicked = this.get_hasse_node_at(position);

        if(clicked.is_some()) {
            this.current_clique = clicked.unwrap();
            this.refresh_swapbox()
        }

        this.draw()
    }

    //Since the swap-box only changes the color of the mutated
    //it needs to be entirely refreshed when changing directly 
    //to another clique
    refresh_swapbox()
    {
        let clq = this.cliques.cliques[this.current_clique];
        this.swap_box.refresh(clq);
        for(let r of clq.routes)
        {
            let enabled = this.cliques.mutate_by_route_idx
            (
                this.current_clique, r
            ) != this.current_clique;
            this.swap_box.show_enabled(r, enabled)
        };
        this.swap_box.show_all_boxes();
        for(let route of this.cliques.exceptional_routes)
        {
            this.swap_box.hide_box(route);
        }

        this.poly_canvas.set_clique(clq)
    }

    //Mutate across the (idx)th route in the current clique.
    route_swap(idx: number)
    {
        let old_clq = this.current_clique;
        let new_clq = this.cliques.mutate_by_route_idx(
            this.current_clique,
            idx
        );

        this.current_clique = new_clq;

        let oc = this.cliques.cliques[old_clq];
        let nc = this.cliques.cliques[new_clq];
        this.poly_canvas.set_clique(nc);

        //If cliques are different, update swap box.
        if(old_clq != new_clq) {
            //Find the route unqiue to each of the cliques,
            //the two that are one but not the other.

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

            //Swap if found, otherwise warn something has gone awry
            if(old_route !== -1 && new_route !== -1)
                this.swap_box.swap_color(old_route, new_route);
            else
                console.warn("Old route and new clique do not differ as expected.")

            //Update moused over route
            if(this.moused_over_route.is_some() && old_route == this.moused_over_route.unwrap())
                this.moused_over_route = Option.some(new_route);

            this.update_route_enabled();
        }

        this.draw();
    }

    //Mark routes in swap box based on whether you can mutate accross them.
    update_route_enabled()
    {
        let nc = this.cliques.cliques[this.current_clique];
        for(let r of nc.routes)
        {
            let en = this.cliques.mutate_by_route_idx(
                this.current_clique,
                r
            ) != this.current_clique;
            this.swap_box.show_enabled(r, en);
        }
    }

    //Handles showing/hiding boxes based on 
    //whether exceptional routes are shown
    update_swap_box()
    {
        this.swap_box.update_color();
        if(this.draw_options.show_exceptional())
            this.swap_box.show_all_boxes()
        else
            for(let r of this.cliques.exceptional_routes)
                this.swap_box.hide_box(r);
    }

    //Find route at (position) and record in (this.moused_over_route)
    //if it exists.
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

    /*
    Draw cliques in the clique_canvas, and store Bezier curves
    associated to routes for mouseover checking.
    */
    draw_clique()
    {		
        let ctx = this.clique_canvas.get_ctx();
        let data = this.dag.bake();
        this.cur_draw_beziers = [];

        ctx.clear();

        //Draw edges
        for(let edge_idx = 0; edge_idx < data.edges.length; edge_idx++)
        {
            let edge = data.edges[edge_idx];
            let orthog = edge.end_point
                .sub(edge.start_point)
                .rot90()
                .normalized();

            //Draw 'ghost edge.' Should not be visible unless exceptional
            //routes are hidden.
            ctx.draw_bez(
                edge, 
                this.draw_options.edge_color() + "22",
                this.draw_options.edge_weight(),
                false
            );

            //Here we draw the routes at a given edge.
            let routes = this.cliques.routes_at(edge_idx, this.current_clique);

            //Filter out exceptional if that option is set.
            if(!this.draw_options.show_exceptional())
                routes = routes.filter( i => !this.cliques.exceptional_routes.includes(i));

            //If there are no routes, you're done (otherwise, the following would divide by 0)
            if(routes.length == 0)
                continue;
            
            //Total width of the 'bundle' of routes is sub-linear in the number of routes
            //This means it will get thicker, but doesn't get out of control. Capped at width
            //of node, so it doesn't spill over.
            let full_width = Math.min(
                this.draw_options.route_weight() * Math.pow(routes.length, 0.8),
                this.draw_options.vert_radius() * 2
            );

            let width = full_width / routes.length * 1.01;
            //Draw bezier for each route, offset in the direction orthogonal
            //to the line between the endpoints.
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
                this.cur_draw_beziers.push({
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

        //Draw moused over route as lighter and thicker (and on top)
        if(this.moused_over_route.is_some())
        {
            let route = this.moused_over_route.unwrap();
            let color = lighten_css_str(
                this.draw_options.get_route_color(route),
                0.15
            );
            for(let cd of this.cur_draw_beziers)
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

        //Decorate with framing numbers
        if(this.draw_options.label_framing())
			ctx.decorate_edges_num(
				this.dag.dag,
				data
			);
        
        //Draw nodes
        for(let vert of data.verts)
        { ctx.draw_node(vert); }

    }

    /*
    Function for drawing the Hasse diagram to this.hasse_canvas
    A relatively simple procedure, first drawing the edges, then
    drawing the cliques as either dots or mini-cliques, depending
    on settings.

    One oddity is that it saves the bounding boxes of the
    mini-cliques to the current_hasse_boxes object as it draws them.
    This is the mose efficient way to make sure the program knows where
    it is clicking, for the purposes of Ctrl-click and drag.
    */
    draw_hasse()
    {
        let ctx = this.hasse_canvas.get_ctx();
        ctx.clear();

        let hasse = this.cliques.hasse;
        let positions = this.get_hasse_positions();
        this.cur_draw_hasse_boxes = {};

        //Draw the edges.
        for(let i = 0; i < hasse.covering_relation.length; i++)
        for(let j = 0; j < hasse.covering_relation.length; j++)
        {
            if(hasse.covering_relation[i][j])
            {
                let pos_i = positions[i];
                let pos_j = positions[j];

                let midpoint = pos_i.add(pos_j).scale(0.5);
                let routes = hasse.cover_routes[i][j];

                //Color each half of the edge by its associate route-color.
                let color1 = this.draw_options.get_route_color(routes[0]);
                let color2 = this.draw_options.get_route_color(routes[1]);
                
                //the clique (i) should be less than clique (j). So, if
                //the node for (i) is somehow above (j), that makes the
                //hasse diagram misleading. As such, we check for this,
                //and color the edge red and mark it with exclamation
                //points if it is bad.
                let bad = pos_i.y >= pos_j.y

                //Color red if bad.
                if(bad)
                {
                    color1 = this.draw_options.hasse_bad_edge_color();
                    color2 = this.draw_options.hasse_bad_edge_color();
                }

                //Draw the two halves of the segment
                ctx.draw_line(
                    pos_i,
                    midpoint,
                    color1,
                    this.draw_options.hasse_edge_weight()
                );
                ctx.draw_line(
                    midpoint,
                    pos_j,
                    color2,
                    this.draw_options.hasse_edge_weight()
                );

                //Draw warning "!!!"
                if(bad)
                {
                    //TODO: Parametrize
                    ctx.draw_text(
                        "!!!",
                        midpoint,
                        "#ffffff",
                        "#000000",
                        20
                    );
                }
            }
        }

        //Draw the nodes
        if(!this.draw_options.hasse_show_cliques())
        {
            //Either: draw the nodes as dots
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
            //Or draw them as mini-cliques!
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

    //The poly_canvas handles its own drawing routine.
    draw_polytope()
    {
        this.poly_canvas.draw();
    }

    /*
    Draws mini-clique in hasse diagram.
    A lot of this is duplicated code from draw_clique. Should be refactored into a single function.
    */
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
        this.cur_draw_hasse_boxes[clique_idx] = box;
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

    recomp_hasse_scale()
    {
        let padding = this.draw_options.hasse_padding();
        let padding_x = padding + this.draw_options.hasse_node_size();
        let padding_y = padding + this.draw_options.hasse_node_size();

        if(this.draw_options.hasse_show_cliques())
        {
            let box = this.cur_draw_hasse_boxes[0];
            if(box)
            {
                padding_x = padding + box.width();
                padding_y = padding + box.height();
            }
        }

        let v_width = Math.max(1,
            this.hasse_canvas.width() - 2*padding_x
        );
        let v_height = Math.max(1,
            this.hasse_canvas.height() - 2*padding_y
        );

        let hasse = this.cliques.hasse;
        let bb = hasse.bounding_box.clone();
        for(let override of Object.values(this.hasse_overrides))
            bb.add_point(override);
        let hasse_ext = bb.extent().scale(2);

        let w_scale = v_width / hasse_ext.x ;
        let h_scale = v_height / hasse_ext.y;
        
        this.hasse_canvas.set_scale(Math.min(w_scale, h_scale));
        this.draw_hasse();
    }

    //Get positions of hasse nodes
    get_hasse_positions(): Vector2[]
    {
        let out = [];
        for(let i = 0; i < this.cliques.hasse.layout_rows.length; i++)
            out.push(this.get_hasse_position(i));
        return out;
    }

    //get position of hasse node for clique (i)
    //If hasse diagram has been given an override, use that
    //otherwise, use default computed value.
    get_hasse_position(i: number): Vector2
    {
        if(i in this.hasse_overrides)
            return this.hasse_overrides[i];
        return this.cliques.hasse.layout_rows[i];
    }

    //Check if these is a hasse node to click as position (click_pos)
    //Behavior adapts to whether nodes are drawn as mini_cliques or dots
    get_hasse_node_at(click_pos: Vector2): Option<number>
    {
        //Finds the node closest to click_pos which is on top of a node

        let canvas_pos = this.hasse_canvas.local_trans_inv(click_pos);
        let positions = this.get_hasse_positions();
        let closest: Option<number> = Option.none();
        let min_dist = Infinity;
        for(let i = 0; i < positions.length; i++)
        {
            let node_pos = positions[i];
            let screen_node_pos = this.hasse_canvas.local_trans(node_pos);

            if(this.draw_options.hasse_show_cliques())
            {
                //If drawn as mini cliques, only valid of in bounding box
                let box = this.cur_draw_hasse_boxes[i];
                if(!box || !box.contains(canvas_pos))
                    continue;
            }
            else
            {
                //If drawn as nodes, only valid if in node-circle.
                let screen_dist = screen_node_pos.sub(click_pos).norm();
                if(screen_dist > this.draw_options.hasse_node_size())
                    continue;
            }

            let dist = node_pos.sub(canvas_pos).norm();
            if(dist <= min_dist)
            {
                closest = Option.some(i);
                min_dist = dist;
            }
        }

        return closest;
    }

    //Used to find if pos is overlapping some route in dag_canvas.
    get_route_at(pos: Vector2): Option<number>
    {
        let position = this.clique_canvas.local_trans_inv(pos);
        let closest_dist = Infinity;
        let closest: Option<number> = Option.none();
        let scale = this.draw_options.scale();
        for(let current of this.cur_draw_beziers)
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

    private set_hasse_overrides(hasse_overrides: {[key: number]: Vector2} )
    {
        this.hasse_overrides = hasse_overrides;
        this.draw();
    }

    to_data_json_ob(): JSONCliqueData
    {
        let hasse_overrides: {[key: number]: [number, number]} = {};
        for(let i in this.hasse_overrides)
        {
            let v = this.hasse_overrides[i];
            hasse_overrides[i] = [v.x, v.y];
        }

        return {
            dag: this.dag.to_json_ob(),
            polytope: this.polytope.to_json_ob(),
            cliques: this.cliques.to_json_ob(),
            hasse_overrides
        }
    }

}
export type JSONCliqueData =
{
    dag: JSONFramedDagEmbedding,
    polytope: JSONFlowPolytope,
    cliques: JSONDAGCliques,
    hasse_overrides: {[key: number]: [number, number]}
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