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
import { css_str_to_rgb, hsl_to_rgb, interp_colors, rgb_to_hsl } from "../draw/colors";
import { ActionBox } from "../subelements/action_box";

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
    readonly q_polytope: FlowPolytope;
    readonly cliques: DAGCliques;

    //Canvases
    readonly clique_canvas: DAGCanvas;
    readonly hasse_canvas: DAGCanvas;
    readonly poly_canvas: PolytopeCanvas;
    readonly q_poly_canvas: PolytopeCanvas;
    readonly brick_canvas: DAGCanvas;

    //This is stored so the event can be deleted with clear_global_events
    readonly resize_event: (ev: UIEvent) => void;

    current_clique: number = 0;
    moused_over_route: Option<number> = Option.none();
    moused_over_brick: Option<number> = Option.none();
    
    //Represents click-and-drag state for hasse diagram nodes
    h_drag: HasseDrag = {dragging: false, elem: 0, offset: Vector2.zero()};

    //Overridden hasse node positions, for custom positioning
    hasse_overrides: {[key: number]: Vector2} = {};

    /*
    These values are computed once per draw-call, to avoid 
    recomputing them.
    */
    drawn_beziers: {bez: Bezier, route: number, width: number}[] = [];
    drawn_hasse_boxes: {[clique: number]: BoundingBox } = {};
    drawn_brick_boxes: {[clique: number]: BoundingBox } = {};

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
        let {normal: polytope, quotient} = FlowPolytope.from_cliques(cliques);

        return new CliqueViewer
        (
            dag, polytope, quotient, cliques, draw_options,
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

        //FIXME: Stopgap
        let q_polytope = polytope;

        SIDEBAR_HEAD.innerHTML = "";
        SIDEBAR_CONTENTS.innerHTML = "";
        RIGHT_AREA.innerHTML = "";

        let cv = new CliqueViewer
        (
            dag.unwrap(), polytope.unwrap(), q_polytope.unwrap(), cliques.unwrap(), draw_options,
            SIDEBAR_HEAD, SIDEBAR_CONTENTS, RIGHT_AREA
        );
        cv.set_hasse_overrides(hasse_overrides);

        return Result.ok(cv);
    }

    private constructor(
        dag: FramedDAGEmbedding,
        polytope: FlowPolytope,
        q_polytope: FlowPolytope,
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
        this.q_polytope = q_polytope;
        this.draw_options.set_builtin_color_scheme(
            this.cliques.routes.length
        );

        draw_options.add_change_listener(() => {
            let nc = this.cliques.cliques[this.current_clique];
            this.poly_canvas.set_clique(nc);
            this.recomp_poset_scales();
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

        //left corner selector
        let possible: [string,string][] = [["brick", "Bricks"]];
        if([2,3].includes(polytope.dim))
            possible.push(["polytope", "Polytope"])
        if([2,3].includes(q_polytope.dim))
            possible.push(["qpolytope", "Quot. Polytope"])
        let ab = ActionBox.create();
        sidebar_contents.appendChild(ab.element);
        ab.box.add_selector(
            "Left corner view",
            possible,
            (val) => this.change_left_corner_view(val)
        )

        //Right area dividers
        let segments = build_right_area_zones();
        right_area.appendChild(segments.root);

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
                this.update_moused_over_route(new Vector2(ev.layerX, ev.layerY))
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
                this.recomp_poset_scales();
            }
        );
        h_canvas_element.addEventListener("mouseleave",
            (ev) => {
                //release drag
                this.h_drag.dragging = false;
                this.recomp_poset_scales();
            }
        );
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
        );
        this.hasse_canvas = hasse_canvas;

        //Polytope canvas
        let {canvas: poly_canvas, element: p_canvas_element} = PolytopeCanvas.create(draw_options);
        poly_canvas.set_polytope(this.polytope, this.cliques.cliques[this.current_clique]);
        segments.poly.appendChild(p_canvas_element);
        poly_canvas.resize_canvas();
        this.poly_canvas = poly_canvas;

        //Quotient Polytope canvas
        let {canvas: q_poly_canvas, element: qp_canvas_element} = PolytopeCanvas.create(draw_options);
        q_poly_canvas.set_polytope(this.q_polytope, this.cliques.cliques[this.current_clique]);
        segments.poly.appendChild(qp_canvas_element);
        q_poly_canvas.resize_canvas();
        this.q_poly_canvas = q_poly_canvas;

        //Brick Canvas
        let {canvas: brick_canvas, element: b_canvas_element} = DAGCanvas.create(draw_options);
        segments.poly.appendChild(b_canvas_element);
        brick_canvas.resize_canvas();
        b_canvas_element.addEventListener("click",
            (ev) => {
                this.brick_canvas_click(new Vector2(ev.layerX, ev.layerY))
            }
        )
        b_canvas_element.addEventListener("mousemove",
            (ev) => {
                this.update_moused_over_brick(new Vector2(ev.layerX, ev.layerY))
                this.draw();
            }
        );
        b_canvas_element.addEventListener("mouseleave",
            (ev) => {
                this.moused_over_brick.is_some()
                {
                    this.moused_over_brick = Option.none();
                    this.draw();
                }
            }
        )
        this.brick_canvas = brick_canvas;

        //Draw and setup redraw
        this.resize_event = (event) => {
            this.clique_canvas.resize_canvas();
            this.hasse_canvas.resize_canvas();
	        this.poly_canvas.resize_canvas();
		    this.brick_canvas.resize_canvas();
            this.recomp_poset_scales();

            this.draw()
        };
        this.draw();
        addEventListener("resize", this.resize_event);

        let cc = this.cliques.cliques[ this.current_clique ];
        for(let i = 0; i < cc.routes.length; i++)
        { this.swap_box.set_color(i, cc.routes[i]) }

        this.update_route_enabled();
        this.update_swap_box();
        this.change_left_corner_view("brick");
        
        window.dispatchEvent(new Event('resize'));
        this.recomp_poset_scales();
    }

    change_left_corner_view(view: string)
    {
        this.poly_canvas.root.style.display = "none";
        this.q_poly_canvas.root.style.display = "none";
        this.brick_canvas.canvas.style.display = "none";

        if(view == "polytope")
        {
            this.poly_canvas.root.style.display = "";
        }
        else if (view == "brick")
        {
            this.brick_canvas.canvas.style.display = "";
        }
        else if (view == "qpolytope")
        {
            this.q_poly_canvas.root.style.display = "";
        }
        else
        {
            this.brick_canvas.canvas.style.display = "";
            console.warn("Tried to change left corner to invalid name!")
        }
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
        this.update_moused_over_route(position);
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

        this.poly_canvas.set_clique(clq);
        this.q_poly_canvas.set_clique(clq);
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
        this.q_poly_canvas.set_clique(nc)

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

    brick_canvas_click(friend: Vector2)
    {
	    //If we are mousing over a brick we can add to our complex, then add it to our complex!
	    //If we are mousing over a brick already in our complex, remove it!
    
	    if (this.moused_over_brick.is_some())
	    {
		    //first let's check if we mousing over a brick in our current clique
		    for (let j=0; j < this.cliques.downbricks.length; j++)
		    {
			    if (this.moused_over_brick.unwrap()==this.cliques.downbricks[this.current_clique][j])
			    {
				    let new_downbricks: number[] = this.cliques.downbricks[this.current_clique].slice();
				    new_downbricks.splice(j,1);
				    this.current_clique=this.cliques.clique_from_bricks(new_downbricks);
			        this.refresh_swapbox();
				    this.draw();
				    return;
			    }
		    }

		    //now let's try to add it to our current collection of bricks
		    let new_clique = this.cliques.clique_from_bricks(this.cliques.downbricks[this.current_clique].concat([this.moused_over_brick.unwrap()]));
		    if (new_clique!=-1)
		    {
			    this.current_clique=new_clique;
			    this.refresh_swapbox();
			    this.draw();
			    return;
		    }
	    }
    }

    update_moused_over_brick(position: Vector2)
    {
        this.moused_over_brick = this.get_hasse_brick_at(position);
	    this.draw_bricks(); 
    }

    //Find route at (position) and record in (this.moused_over_route)
    //if it exists.
    update_moused_over_route(position: Vector2)
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
		this.draw_bricks();
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
        this.drawn_beziers = [];

        ctx.clear();

        //JRB
        //draw all downbricks of our chosen clique, in the color of the routes
        if (this.draw_options.draw_all_downbricks())
        {
            let size: number = this.draw_options.brick_width()+10;
            for (let route_index=0; route_index < this.cliques.clique_size; route_index++)
            {
                if (this.cliques.downbricks[this.current_clique][route_index]!=-1)
                {
                    size-=5
                    //draw downbrick
                    //color is darkening of route color with alpha added
                    let clq = this.cliques.cliques[this.current_clique];
                    let route = clq.routes[route_index];
                    let color = interp_colors(
                        this.draw_options.get_route_color(route),
                        this.draw_options.background_color(),
                        0.65
                    );


                    let brk=this.cliques.bricks[
                        this.cliques.downbricks[this.current_clique][route_index]];
                    let intpath = brk.edges;
                    for (let i = 0; i < intpath.length; i++)
                    {
                        let edge = data.edges[intpath[i]];
                        ctx.draw_bez(
                            edge, 
                            color,
                            size,
                            false
                        );
                    }
                    //now draw along the corners
                    let cornerarrows = [
                        brk.in_edges[0],
                        brk.in_edges[1],
                        brk.out_edges[0],
                        brk.out_edges[1]
                    ];
                    for (let j=0; j < 4; j++)
                    {
                        let halfbez = data.edges[cornerarrows[j]]
                            .half_bezier(j==2||j==3);

                        ctx.draw_bez(
                            halfbez, 
                            color,
                            size,
                            false
                        );
                    }
                }
            }
            this.cliques.cliques[this.current_clique]
        }

        //draw the brick of highlighted route, if we want to
        if (this.draw_options.draw_brick_of_highlighted_route())
        {
            if(this.moused_over_route.is_some())
                {
                    let route = this.moused_over_route.unwrap();
        
                //now let's find the index of route in our current_clique
                let route_index : number = -1;
                for (let j=0; j < this.cliques.clique_size; j++)
                {
                    if (this.cliques.cliques[this.current_clique].routes[j]==route)
                        route_index=j;
                }
        
                //draw downbrick
                let db = this.cliques.downbricks[this.current_clique][route_index];
                let brk=this.cliques.bricks[db];
                if (db != -1)
                {
                    let intpath = brk.edges;
                    for (let i = 0; i < intpath.length; i++)
                    {
                        let edge = data.edges[intpath[i]];
                        ctx.draw_bez(
                            edge, 
                            this.draw_options.down_brick_color(),
                            this.draw_options.brick_width(),
                            false
                        );
                    }
                    //now draw along the corners
                    let cornerarrows = [
                        brk.in_edges[0],
                        brk.in_edges[1],
                        brk.out_edges[0],
                        brk.out_edges[1]
                    ];
                    for (let j=0; j < 4; j++)
                    {
                        let halfbez = data.edges[cornerarrows[j]]
                            .half_bezier(j==2||j==3);

                        ctx.draw_bez(
                            halfbez, 
                            this.draw_options.down_brick_color(),
                            this.draw_options.brick_width(),
                            false
                        );
                    }
                }
                //draw upbrick
                let ub = this.cliques.upbricks[this.current_clique][route_index];
                let brk2=this.cliques.bricks[ub];
                if (ub != -1)
                {
                    let intpath = brk2.edges;
                    for (let i = 0; i < intpath.length; i++)
                    {
                        let edge = data.edges[intpath[i]];
                        ctx.draw_bez(
                            edge, 
                            this.draw_options.up_brick_color(),
                            this.draw_options.brick_width(),
                            false
                        );
                    }
                    //now draw along the corners
                    let cornerarrows = [
                        brk.in_edges[0],
                        brk.in_edges[1],
                        brk.out_edges[0],
                        brk.out_edges[1]
                    ];
                    for (let j=0; j < 4; j++)
                    {
                        let halfbez = data.edges[cornerarrows[j]]
                            .half_bezier(j==2||j==3);
                        ctx.draw_bez(
                            halfbez, 
                            this.draw_options.up_brick_color(),
                            this.draw_options.brick_width(),
                            false
                        );
                    }
                }
		}
        }
        //DRAW HIGHLIGHTED BRICK ON CLIQUE IF WE WANT TO
        if (this.draw_options.draw_brick_of_highlighted_brick())
        {
            if(this.moused_over_brick.is_some())
            {
                let brk=this.cliques.bricks[this.moused_over_brick.unwrap()];
                let intpath = brk.edges;
                for (let i = 0; i < intpath.length; i++)
                {
                    let edge = data.edges[intpath[i]];
                    ctx.draw_bez(
                        edge, 
                        this.draw_options.down_brick_color(),
                        this.draw_options.brick_width(),
                        false
                    );
                }
                //now draw along the corners
                let cornerarrows = [
                    brk.in_edges[0],
                    brk.in_edges[1],
                    brk.out_edges[0],
                    brk.out_edges[1]
                ];
                for (let j=0; j < 4; j++)
                {
                    let halfbez = data.edges[cornerarrows[j]]
                        .half_bezier(j==2||j==3);
                    ctx.draw_bez(
                        halfbez, 
                        this.draw_options.down_brick_color(),
                        this.draw_options.brick_width(),
                        false
                    );
                }
            }
        }
        //ENDJRB

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
                this.drawn_beziers.push({
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
            for(let cd of this.drawn_beziers)
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

    draw_bricks()
    {
	    let ctx=this.brick_canvas.get_ctx();
	    ctx.clear();

    	let hasse=this.cliques.brick_hasse;
        //positions is a list of vector2s
        let positions = this.get_brick_positions();
        //DRAW THE LINES OF THE HASSE DIAGRAM
        for(let i = 0; i < hasse.covering_relation.length; i++)
        for(let j = 0; j < hasse.covering_relation.length; j++)
        {
            if(hasse.covering_relation[i][j])
            {
                ctx.draw_line(
                    positions[i],
                    positions[j],
                    '#000000',
                    this.draw_options.hasse_edge_weight()
                );
            }
        }
        //OPTIONALLY DRAW THE LINES INDICATING COMPATIBILITY OF BRICKS
        if (this.draw_options.brick_draw_compat_edges())
        {
            for(let i = 0; i < this.cliques.bricks.length; i++)
            for(let j = i+1; j < this.cliques.bricks.length; j++)
            {
                if (this.cliques.bricks_compatible(i,j))
                    ctx.draw_line(
                        positions[i],
                        positions[j],
                        this.draw_options.brick_compat_edge_color(),
                        this.draw_options.hasse_edge_weight()-2
                    );
            }
        }

        //NOW DRAW THE BRICKS
        let data = this.dag.bake();
        for(let i = 0; i < positions.length; i++)
        {   
            let pos = positions[i];
            this.draw_mini_brick(
                pos,
                i,
                data,
                ctx
            );
        }
    }

    draw_mini_brick(
        center: Vector2,
	    brick_idx: number,
        data: BakedDAGEmbedding,
        ctx: DAGCanvasContext
    )
    {
        let baked = this.dag.bake();
        let box = clique_bounding_box(baked); 
        let scale = this.draw_options.hasse_mini_dag_size() / (box.radius() * this.hasse_canvas.width());
        box.scale(scale);
        box.shift(center);
        box.pad(this.draw_options.hasse_mini_vert_rad() / this.hasse_canvas.scale())
        this.drawn_brick_boxes[brick_idx] = box;

        ctx.draw_rounded_box(
            box.top_corner,
            box.bot_corner,
            10,
            this.draw_options.background_color()
        )

        //If the current clique has this down brick, then highlight!
        //If we are mousing over a clique NOT in our current clique which could be, then highlight blue!
        //Also if we are mousing over a brick which is in our current clique, highlight blue!
        //If we are mousing over a brick which cannot be in our current clique, then highlight red!
        for (let j=0; j < this.cliques.clique_size; j++)
        {
            if (brick_idx==this.cliques.downbricks[this.current_clique][j])
            {
                ctx.draw_rounded_box(
                    box.top_corner,
                    box.bot_corner,
                    10,
                    this.draw_options.hasse_current_color()
                );
            }
        }
        if (this.moused_over_brick.is_some() && this.moused_over_brick.unwrap()==brick_idx)
        {
            let expanded_array = this.cliques.downbricks[this.current_clique].concat([this.moused_over_brick.unwrap()]);
            let real_expanded_array = []
            for (let j=0; j < expanded_array.length; j++)
            {
                if (expanded_array[j]!=-1)
                    real_expanded_array.push(expanded_array[j]);
            }
            if (this.cliques.clique_from_bricks(real_expanded_array)!=-1)
            {
                ctx.draw_rounded_box(
                    box.top_corner,
                    box.bot_corner,
                    10,
                    this.draw_options.good_highlight_color()
                );
            }
            else
            {
                ctx.draw_rounded_box(
                    box.top_corner,
                    box.bot_corner,
                    10,
                    this.draw_options.bad_highlight_color()
                );
            }
	    }


        let brk=this.cliques.bricks[brick_idx];
        let intpath = brk.edges;
        for (let i = 0; i < intpath.length; i++)
        {
            let edge = data.edges[intpath[i]].transform(
                (v) => v.scale(scale).add(center)
            );
            ctx.draw_bez(
                edge, 
                this.draw_options.down_brick_color(),
                this.draw_options.hasse_mini_route_weight(),
                false
            );
        }
        //now draw along the corners
        let cornerarrows = [
            brk.in_edges[0],
            brk.in_edges[1],
            brk.out_edges[0],
            brk.out_edges[1]
        ];
        for (let j=0; j < 4; j++)
        {
            let halfbez = data.edges[cornerarrows[j]]
                .half_bezier(j==2||j==3)
                .transform((v) => v.scale(scale).add(center))

            ctx.draw_bez(
                halfbez, 
                this.draw_options.down_brick_color(),
                this.draw_options.hasse_mini_route_weight(),
                false
            );
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
        this.drawn_hasse_boxes = {};

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
        this.q_poly_canvas.draw();
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
        let baked = this.dag.bake();
        let box = clique_bounding_box(baked); 
        let scale = this.draw_options.hasse_mini_dag_size() / (box.radius() * this.hasse_canvas.width());
        box.scale(scale);
        box.shift(center);
        box.pad(this.draw_options.hasse_mini_vert_rad() / this.hasse_canvas.scale())
        this.drawn_hasse_boxes[clique_idx] = box;

        let edges: {bez: Bezier, color: string, width: number}[] = [];

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
                    offset = orthog.scale(percent * (full_width - width)/this.hasse_canvas.scale());
                }
                let edge_data = {
                    
                    bez: edge.transform((v) => v.add(offset)),
                    color, width
                };
                edges.push(edge_data);
            }
        }

        let halo_size: number = this.draw_options.hasse_select_halo();

        //COVER BACKGROUND
        let bk_bb=new BoundingBox([]);
        for(let pos of data.verts)
        {
            bk_bb.add_point(pos.scale(scale).add(center))
        }
        bk_bb.pad_y(box.height()/3);
        ctx.draw_rounded_box(
            bk_bb.top_corner,
            bk_bb.bot_corner,
            10,
            this.draw_options.background_color()
        );

        //DRAW HALO
        let halo_color = this.draw_options.background_color();
        if(clique_idx == this.current_clique)
        {
            halo_color = this.draw_options.hasse_current_color();
        }
        for(let edge of edges)
        {
            ctx.draw_bez(
                edge.bez,
                halo_color,
                halo_size + edge.width/2,
                false
            )
        }
        for(let pos of data.verts)
        {
            ctx.draw_circ(
                pos.scale(scale).add(center),
                halo_color,
                this.draw_options.hasse_mini_vert_rad() + halo_size/2
            )
        }

        //DRAW ACTUAL GRAPH
        for(let edge of edges)
        {
            ctx.draw_bez(
                edge.bez,
                edge.color,
                edge.width,
                false
            )
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

    get_brick_positions(): Vector2[]
    {
        let out = [];
        for (let j=0; j < this.cliques.bricks.length; j++)
        {
            let clq_idx = this.cliques.clique_from_bricks([j]);
            let pos = this.get_hasse_position(clq_idx);
            out.push(pos)
        }
        let center = Vector2.zero();
        for(let c of out)
            center = center.add(c.scale(1/this.cliques.bricks.length))
        for (let j=0; j < this.cliques.bricks.length; j++)
            out[j] = out[j].sub(center);
        return out;
    }

    recomp_poset_scales()
    {
        this.recomp_hasse_scale();
        this.recomp_brick_scale();
    }

    recomp_hasse_scale()
    {
        let padding = this.draw_options.hasse_padding();

        let v_width = Math.max(1,
            this.hasse_canvas.width() - 2*padding
        );
        let v_height = Math.max(1,
            this.hasse_canvas.height() - 2*padding
        );

        let hasse = this.cliques.hasse;
        let bb = hasse.bounding_box.clone();

        for(let override of Object.values(this.hasse_overrides))
            bb.add_point(override);

        if(this.draw_options.hasse_show_cliques())
        {
            let baked = this.dag.bake();
            let raw_bb = clique_bounding_box(baked); 
            let scalar = this.draw_options.hasse_mini_dag_size() / (raw_bb.radius() * this.hasse_canvas.width());  
            raw_bb.scale(scalar);         
            for(let i=0; i < this.cliques.cliques.length; i++)
            {
                let pos = this.get_hasse_position(i);
                let this_bb = raw_bb.clone();
                this_bb.shift(pos);
                bb.add_bounding_box(this_bb);
            }
        }
        let hasse_ext = bb.extent().scale(2);

        let w_scale = v_width / hasse_ext.x ;
        let h_scale = v_height / hasse_ext.y;
        
        this.hasse_canvas.set_scale(Math.min(w_scale, h_scale));
        this.draw_hasse();
    }

    recomp_brick_scale()
    {
        let padding = this.draw_options.brick_padding();
        let center = Vector2.zero();

        let v_width = Math.max(1,
            this.brick_canvas.width() - 2*padding
        );
        let v_height = Math.max(1,
            this.brick_canvas.height() - 2*padding
        );

        let bb = new BoundingBox([]);
        let baked = this.dag.bake();
        let raw_bb = clique_bounding_box(baked); 
        let scalar = this.draw_options.hasse_mini_dag_size() / (raw_bb.radius() * this.hasse_canvas.width());  
        raw_bb.scale(scalar);         

        for (let j=0; j < this.cliques.bricks.length; j++)
        {
            let clq_idx = this.cliques.clique_from_bricks([j]);
            let pos = this.get_hasse_position(clq_idx);

            let this_bb = raw_bb.clone();
            this_bb.shift(pos);
            bb.add_bounding_box(this_bb);
            
            center = center.add(
                pos.scale(1/this.cliques.bricks.length)
            )
        }
        
        bb.shift(center.scale(-1));
        let hasse_ext = bb.extent().scale(2);


        let w_scale = v_width / hasse_ext.x ;
        let h_scale = v_height / hasse_ext.y;
        
        this.brick_canvas.set_scale(Math.min(w_scale, h_scale));
        this.draw_bricks();
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
                let box = this.drawn_hasse_boxes[i];
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

    get_hasse_brick_at(click_pos: Vector2): Option<number>
    {
        //Finds the node closest to click_pos which is on top of a node

        let canvas_pos = this.brick_canvas.local_trans_inv(click_pos);
        let positions = this.get_brick_positions();
        let closest: Option<number> = Option.none();
        let min_dist = Infinity;
        for(let i = 0; i < positions.length; i++)
        {
            let node_pos = positions[i];
            let box = this.drawn_brick_boxes[i];
            if(!box || !box.contains(canvas_pos))
                continue;

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
        for(let current of this.drawn_beziers)
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

function clique_bounding_box(
    data: BakedDAGEmbedding,
): BoundingBox
{
    let rad = 1.0;
    for(let p of data.verts)
        rad = Math.max(p.norm(), rad);
    
    let box = new BoundingBox([]);
    for(let edge_idx = 0; edge_idx < data.edges.length; edge_idx++) {

        let edge = data.edges[edge_idx];
        box.add_point(edge.start_point);
        box.add_point(edge.cp1);
        box.add_point(edge.cp2);
        box.add_point(edge.end_point);
    }

    return box;
}