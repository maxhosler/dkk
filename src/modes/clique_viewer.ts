import { DAGCanvas, DAGCanvasContext } from "../subelements/dag_canvas";
import { BakedDAGEmbedding, FramedDAGEmbedding } from "../draw/dag_layout";
import { RIGHT_AREA, SIDEBAR_CONTENTS, SIDEBAR_HEAD } from "../html_elems";
import { Bezier, BoundingBox, Vector2 } from "../util/num";
import { DrawOptionBox } from "../subelements/draw_option_box";
import { DAGCliques } from "../math/routes";
import { SwapBox } from "../subelements/swap_box";
import { FlowPolytope } from "../math/polytope";
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
    readonly brick_canvas: DAGCanvas;

    readonly resize_event: (ev: UIEvent) => void;

    current_clique: number = 0;
    
    current_dag_bez: {bez: Bezier, route: number, width: number}[] = [];
    moused_over_route: Option<number> = Option.none();
    moused_over_brick: Option<number> = Option.none(); //JRB

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
        poly_canvas.set_polytope(this.polytope, this.cliques.cliques[this.current_clique]);
        segments.poly.appendChild(p_canvas_element);
        poly_canvas.resize_canvas();
        this.poly_canvas = poly_canvas;

        //JRB
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
	    //ENDJRB

        //Draw and setup redraw
        this.resize_event = (event) => {
            this.clique_canvas.resize_canvas();
            this.hasse_canvas.resize_canvas();
	        this.poly_canvas.resize_canvas();
		    this.brick_canvas.resize_canvas();

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

    //JRB
    brick_canvas_click(friend: Vector2)
    {
	    //If we are mousing over a brick we can add to our complex, then add it to our complex!
	    //
	    //If we are mousing over a brick already in our complex, remove it!
    

	    if (this.moused_over_brick.is_some())
	    {
		    //first let's check if we mousing over a brick in our current clique
		    for (let j=0; j < this.cliques.downbricks.length; j++)
		    {
			    if (this.moused_over_brick.unwrap()==this.cliques.downbricks[this.current_clique][j])
			    {
				    //XXX
				    let new_downbricks: number[] = this.cliques.downbricks[this.current_clique].slice();
				    console.log("DOWNBRICKS (old then new):");
				    console.log(new_downbricks);
				    new_downbricks.splice(j,1);
				    console.log(new_downbricks);
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
        let canvas_pos = this.brick_canvas.local_trans_inv(position);
        let positions = this.get_brick_positions();
        let closest: Option<number> = Option.none();
        let min_dist = Infinity;
        for(let i = 0; i < positions.length; i++)
        {
            let dist = positions[i].sub(canvas_pos).norm();
            if(dist <= min_dist)
            {
                closest = Option.some(i);
                min_dist = dist;
            }
        }
	if (min_dist <= 0.5)
	{
		this.moused_over_brick=closest;
	}
	else
		this.moused_over_brick=Option.none();

	this.draw_bricks(); //TODO: Maybe want to only draw when we have changed probably
    }
    //ENDJRB

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
		this.draw_bricks();
        this.swap_box.update_color();
    }

    draw_clique()
    {		
        let ctx = this.clique_canvas.get_ctx();
        let data = this.dag.bake();
        this.current_dag_bez = [];

        ctx.clear();

        //JRB
        //draw all downbricks of our chosen clique, in the color of the routes
        if (this.draw_options.draw_all_downbricks())
        {
            //this.current_clique
            //XXX
            let size: number = this.draw_options.brick_width()+10;
            for (let route_index=0; route_index < this.cliques.clique_size; route_index++)
            {
                if (this.cliques.downbricks[this.current_clique][route_index]!=-1)
                {
                    size-=5
                    //draw downbrick
                    //color is darkening of route color with alpha added
                        let color = lighten_css_str(
                        this.draw_options.get_route_color(this.cliques.cliques[this.current_clique].routes[route_index]),
                                -0.15
                    ).replace(')',', 0.5').replace('rgb','rgba');


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
                    let cornerarrows = [];
                    cornerarrows.push(brk.in_edges[0])
                    cornerarrows.push(brk.in_edges[1])
                    cornerarrows.push(brk.out_edges[0])
                    cornerarrows.push(brk.out_edges[1])
                    for (let j=0; j < 4; j++)
                    {
                        let in1 = data.edges[cornerarrows[j]];
                        let P0 = in1.start_point;
                        let P1 = in1.cp1;
                        let P2 = in1.cp2;
                        let P3 = in1.end_point;
                        let Q0= P0.scale(0.5).add(P1.scale(0.5));
                        let Q1=P1.scale(0.5).add(P2.scale(0.5));
                        let Q2=P2.scale(0.5).add(P3.scale(0.5));
                        let R0=Q0.scale(0.5).add(Q1.scale(0.5));
                        let R1=Q1.scale(0.5).add(Q2.scale(0.5));
                        let S0=R0.scale(0.5).add(R1.scale(0.5));
                        let halfbez: Bezier = in1;
                        if (j==2 || j==3)
                        {
                            halfbez = new Bezier(
                                P0,
                                Q0,
                                R0,
                                S0
                            );
                        }
                        else
                        {
                            halfbez = new Bezier(
                                S0,
                                R1,
                                Q2,
                                P3
                            );
                        }
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
                let brk=this.cliques.bricks[
                    this.cliques.downbricks[this.current_clique][route_index]];
                if (this.cliques.downbricks[this.current_clique][route_index] != -1)
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
                let cornerarrows = [];
                cornerarrows.push(brk.in_edges[0])
                cornerarrows.push(brk.in_edges[1])
                cornerarrows.push(brk.out_edges[0])
                cornerarrows.push(brk.out_edges[1])
                for (let j=0; j < 4; j++)
                {
                    let in1 = data.edges[cornerarrows[j]];
                    let P0 = in1.start_point;
                    let P1 = in1.cp1;
                    let P2 = in1.cp2;
                    let P3 = in1.end_point;
                    let Q0= P0.scale(0.5).add(P1.scale(0.5));
                    let Q1=P1.scale(0.5).add(P2.scale(0.5));
                    let Q2=P2.scale(0.5).add(P3.scale(0.5));
                    let R0=Q0.scale(0.5).add(Q1.scale(0.5));
                    let R1=Q1.scale(0.5).add(Q2.scale(0.5));
                    let S0=R0.scale(0.5).add(R1.scale(0.5));
                    let halfbez: Bezier = in1;
                    if (j==2 || j==3)
                    {
                        halfbez = new Bezier(
                            P0,
                            Q0,
                            R0,
                            S0
                        );
                    }
                    else
                    {
                        halfbez = new Bezier(
                            S0,
                            R1,
                            Q2,
                            P3
                        );
                    }
                    ctx.draw_bez(
                            halfbez, 
                            this.draw_options.down_brick_color(),
                            this.draw_options.brick_width(),
                            false
                        );
                }
                }
                //draw upbrick
                let brk2=this.cliques.bricks[
                    this.cliques.upbricks[this.current_clique][route_index]];
                if (this.cliques.upbricks[this.current_clique][route_index] != -1)
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
                let cornerarrows = [];
                cornerarrows.push(brk2.in_edges[0])
                cornerarrows.push(brk2.in_edges[1])
                cornerarrows.push(brk2.out_edges[0])
                cornerarrows.push(brk2.out_edges[1])
                for (let j=0; j < 4; j++)
                {
                    let in1 = data.edges[cornerarrows[j]];
                    let P0 = in1.start_point;
                    let P1 = in1.cp1;
                    let P2 = in1.cp2;
                    let P3 = in1.end_point;
                    let Q0= P0.scale(0.5).add(P1.scale(0.5));
                    let Q1=P1.scale(0.5).add(P2.scale(0.5));
                    let Q2=P2.scale(0.5).add(P3.scale(0.5));
                    let R0=Q0.scale(0.5).add(Q1.scale(0.5));
                    let R1=Q1.scale(0.5).add(Q2.scale(0.5));
                    let S0=R0.scale(0.5).add(R1.scale(0.5));
                    let halfbez: Bezier = in1;
                    if (j==2 || j==3)
                    {
                        halfbez = new Bezier(
                            P0,
                            Q0,
                            R0,
                            S0
                        );
                    }
                    else
                    {
                        halfbez = new Bezier(
                            S0,
                            R1,
                            Q2,
                            P3
                        );
                    }
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
                let cornerarrows = [];
                cornerarrows.push(brk.in_edges[0])
                cornerarrows.push(brk.in_edges[1])
                cornerarrows.push(brk.out_edges[0])
                cornerarrows.push(brk.out_edges[1])
                for (let j=0; j < 4; j++)
                {
                    let in1 = data.edges[cornerarrows[j]];
                    let P0 = in1.start_point;
                    let P1 = in1.cp1;
                    let P2 = in1.cp2;
                    let P3 = in1.end_point;
                    let Q0= P0.scale(0.5).add(P1.scale(0.5));
                    let Q1=P1.scale(0.5).add(P2.scale(0.5));
                    let Q2=P2.scale(0.5).add(P3.scale(0.5));
                    let R0=Q0.scale(0.5).add(Q1.scale(0.5));
                    let R1=Q1.scale(0.5).add(Q2.scale(0.5));
                    let S0=R0.scale(0.5).add(R1.scale(0.5));
                    let halfbez: Bezier = in1;
                    if (j==2 || j==3)
                    {
                        halfbez = new Bezier(
                            P0,
                            Q0,
                            R0,
                            S0
                        );
                    }
                    else
                    {
                        halfbez = new Bezier(
                            S0,
                            R1,
                            Q2,
                            P3
                        );
                    }
                    ctx.draw_bez(
                            halfbez, 
                            this.draw_options.down_brick_color(),
                            this.draw_options.brick_width(),
                            false
                        );
                }
                }
            }
        }
        //ENDJRB

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


    //JRB
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
        let cornerarrows = [];
        cornerarrows.push(brk.in_edges[0]);
        cornerarrows.push(brk.in_edges[1]);
        cornerarrows.push(brk.out_edges[0]);
        cornerarrows.push(brk.out_edges[1]);
        for (let j=0; j < 4; j++)
        {
            let in1 = data.edges[cornerarrows[j]];
            let P0 = in1.start_point;
            let P1 = in1.cp1;
            let P2 = in1.cp2;
            let P3 = in1.end_point;
            let Q0=P0.scale(0.5).add(P1.scale(0.5));
            let Q1=P1.scale(0.5).add(P2.scale(0.5));
            let Q2=P2.scale(0.5).add(P3.scale(0.5));
            let R0=Q0.scale(0.5).add(Q1.scale(0.5));
            let R1=Q1.scale(0.5).add(Q2.scale(0.5));
            let S0=R0.scale(0.5).add(R1.scale(0.5));
            let halfbez: Bezier = in1;
            if (j==2 || j==3)
            {
                halfbez = new Bezier( P0, Q0, R0, S0 )
                    .transform((v) => v.scale(scale).add(center));
            }
            else
            {
                halfbez = new Bezier( S0, R1, Q2, P3 )
                    .transform((v) => v.scale(scale).add(center));
            }
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
    //ENDJRB



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

    //JRB
    //CURSED I DONT UNDERSTAND ANY OF THIS
    get_brick_positions(): Vector2[]
    {
        const PADDING: number = 50; //TODO: make parameter

        let v_width = Math.max(1,
            this.brick_canvas.width() - 2*PADDING
        );
        let v_height = Math.max(1,
            this.brick_canvas.height() - 2*PADDING
        );

        //JRB: Let's make a bounding box for our lattice
        //IDK how Max did his in the HasseDiagram class, but we are doing ours here?
        //Strategy: make brick_layout_rows by stealing entries of hasse.layout_rows from join-irreducibles
        //Then make a bounding box from it
        let brick_layout_rows: Vector2[] = []
        for (let j=0; j < this.cliques.bricks.length; j++)
        {
            brick_layout_rows.push(this.cliques.hasse.layout_rows[this.cliques.clique_from_bricks([j])]);
        }

        let bb = new BoundingBox(brick_layout_rows);
        //this.cliques.hasse.layout_rows is centered at 0, but brick_layout_rows may not be!
        //so let's center brick_layout_rows
        let brick_mid = bb.top_corner.add(bb.bot_corner).scale(0.5);
        for (let j=0; j < this.cliques.bricks.length; j++)
        {
            brick_layout_rows[j]=brick_layout_rows[j].add((brick_mid.scale(-1)));
        }

        let hasse_ext= new BoundingBox(brick_layout_rows).extent().scale(2);

        let w_scale = v_width / hasse_ext.x ;
        let h_scale = v_height / hasse_ext.y;
        return brick_layout_rows.map(v => v.transform([[w_scale / this.draw_options.scale(),0],[0,h_scale / this.draw_options.scale()]]));
    }
    //ENDJRB

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
