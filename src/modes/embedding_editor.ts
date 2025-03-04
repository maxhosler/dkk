import { BakedDAGEmbedding } from "../draw/dag_layout";
import { Vector } from "../util/num";
import { Option, ResultError } from "../util/result";
import { FramedDAGEmbedding } from "../draw/dag_layout";
import { SIDEBAR_HEAD, SIDEBAR_CONTENTS, RIGHT_AREA } from "../html_elems";
import { DAGCanvas, DAGCanvasContext } from "../subelements/dag_canvas";
import { DrawOptions } from "../draw/draw_options";
import { DrawOptionBox as DrawOptionsBox } from "../subelements/draw_option_box";
import { IMode, ModeName } from "./mode";
import { ActionBox } from "../subelements/action_box";

type SelectionType = "none" | "vertex" | "edge" | "pair_verts" | "pair_edges";
type SelectionInner = null|number|[number,number]
class Selection
{
	readonly type: SelectionType;
	readonly inner: SelectionInner  ;

	private constructor(type: SelectionType, inner: SelectionInner)
	{
		this.type = type;
		this.inner = inner;
	}

	static none(): Selection
	{
		return new Selection("none", null);
	}

	static vertex(num: number): Selection
	{
		return new Selection("vertex", num);
	}

	static edge(num: number): Selection
	{
		return new Selection("edge", num);
	}

	pair_of(
		single: "vertex" | "edge",
	){
		return (this.type == "pair_verts" && single == "vertex") ||
		       (this.type == "pair_edges" && single == "edge")
	}

	single()
	{
		return this.type == "vertex" || this.type == "edge";
	}

	pair()
	{
		return this.type == "pair_verts" || this.type == "pair_edges";
	}

	change(
		clicked: "vertex" | "edge",
		index: number,
		shift_held: boolean
	): Selection
	{

		if( this.type == "none" ||
			!shift_held ||
			(this.single() && this.type != clicked) ||
			(this.pair() && !this.pair_of(clicked))
		)
		{
			return new Selection(clicked, index);
		}

		//Some of these conditions are redundant,
		//but they make it more explicit what is going on

		//TODO: Factor out duplication

		if(shift_held && this.single() && this.type == clicked)
		{
			let pair: [number, number] = [this.inner as number, index];
			if(this.type == "vertex")
			{
				if(pair[0] != pair[1])
					return new Selection("pair_verts", pair);
				else
					return new Selection("vertex", pair[0])
			}
			else if(this.type == "edge")
			{
				if(pair[0] != pair[1])
					return new Selection("pair_edges", pair);
				else
					return new Selection("edge", pair[0])
			}
			else
			{
				throw new Error("This branch should be impossible.")
			}
		}

		if(shift_held && this.pair() && this.pair_of(clicked))
		{
			let pair: [number, number] = [(this.inner as [number, number])[1], index];
			if(this.type == "pair_verts")
			{
				if(pair[0] != pair[1])
					return new Selection("pair_verts", pair);
				else
					return new Selection("vertex", pair[0])
			}
			else if(this.type == "pair_edges")
			{
				if(pair[0] != pair[1])
					return new Selection("pair_edges", pair);
				else
					return new Selection("edge", pair[0])
			}
			else
			{
				throw new Error("This branch should be impossible.")
			}
		}

		throw new Error("This branch should be impossible.");
	}
}

type VertDragState =
{
	dragging: boolean,
	vert: number
}

export class EmbeddingEditor implements IMode
{
	readonly draw_options: DrawOptions;
	readonly draw_options_box: DrawOptionsBox;

	readonly error_box: HTMLDivElement;

	readonly add_edge_button: HTMLButtonElement;
	readonly remove_edge_button: HTMLButtonElement;
	readonly swap_edges_start: HTMLButtonElement;
	readonly swap_edges_end: HTMLButtonElement;

	canvas: DAGCanvas;
	dag: FramedDAGEmbedding;

	selected: Selection = Selection.none();
	v_drag: VertDragState = {
		dragging: false,
		vert: 0
	};
	mouse_pos: Vector = Vector.zero();

	name(): ModeName
	{
		return "embedding-editor";
	}
	current_dag(): FramedDAGEmbedding {
        return this.dag;
    }


	static destructive_new(
		dag: FramedDAGEmbedding,
		draw_options: DrawOptions,
	): EmbeddingEditor
	{
		SIDEBAR_HEAD.innerHTML     = "";
		SIDEBAR_CONTENTS.innerHTML = "";
		RIGHT_AREA.innerHTML       = "";
		return new EmbeddingEditor
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
        return new EmbeddingEditor
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
		draw_options.add_change_listener(this.draw)

		sidebar_head.innerText = "Embedding Editor";
		
		let {box: do_box, element: do_box_element} = DrawOptionsBox.create(draw_options);
		sidebar_contents.appendChild(do_box_element);
		this.draw_options_box = do_box;		

		this.error_box = document.createElement("div");
		this.error_box.id = "ee-error-zone";
		sidebar_contents.appendChild(this.error_box);

		let {box: dag_box, element: dag_element} = ActionBox.create();
		sidebar_contents.appendChild(dag_element);
		dag_box.add_title("DAG Edit");
		dag_box.add_tip("Warning: Using any of these options will reset any changes made to layout.");
		this.add_edge_button = dag_box.add_button(
			"Add edge",
			() => {
				if(this.selected.type == "pair_verts")
				{
					let [start, end] = this.selected.inner as [number, number];
					this.add_edge(start, end);
				}
			}
		);
		this.remove_edge_button = dag_box.add_button(
			"Remove edge",
			() => {
				if(this.selected.type == "edge")
				{
					let start = this.selected.inner as number;
					this.remove_edge(start);
				}
			}
		);
		this.swap_edges_start = dag_box.add_button(
			"Swap framing at start",
			() => {
				//TODO:
			}
		)
		this.swap_edges_end = dag_box.add_button(
			"Swap framing at end",
			() => {
				//TODO:
			}
		)
		dag_box.add_shortcut_popup(document.getElementsByTagName("body")[0] as HTMLBodyElement);

		let {canvas, element: can_element} = DAGCanvas.create(draw_options);
		right_area.appendChild(can_element);
		can_element.addEventListener("click",
			(ev) => {
				this.canvas_click(new Vector(ev.layerX, ev.layerY), ev.shiftKey)
			}
		)
		can_element.addEventListener("mousedown",
			(ev) => {
				this.try_drag_start(new Vector(ev.layerX, ev.layerY));
			}
		)
		can_element.addEventListener("mouseup",
			(ev) => {
				this.drag_end(new Vector(ev.layerX, ev.layerY));
			}
		)
		can_element.addEventListener("mouseleave",
			(ev) => {
				this.drag_end(new Vector(ev.layerX, ev.layerY));
			}
		)
		can_element.addEventListener("mousemove",
			(ev) => {
				this.mouse_pos = new Vector(ev.layerX, ev.layerY);
				if(this.v_drag.dragging) this.draw()
			}
		)
		//TODO: delete when goes away!
		addEventListener("keydown",
			(ev) => this.handle_keypress(ev.key)
		)
		canvas.resize_canvas();
		this.canvas = canvas;

		this.draw();
		can_element.addEventListener("resize", (event) => {
			this.draw();
		});
	}

	change_selection(sel: Selection)
	{
		this.selected = sel;
		this.draw();
	}

	canvas_click(position: Vector, shift_held: boolean)
	{
		let clicked_vert = this.get_vertex_at(position);
		let clicked_edge = this.get_edge_at(position);
		if (clicked_vert.is_some())
		{
			this.change_selection(
				this.selected.change(
					"vertex",
					clicked_vert.unwrap(),
					shift_held
				)
			);
		}
		else if (clicked_edge.is_some())
		{
			this.change_selection(
				this.selected.change(
					"edge",
					clicked_edge.unwrap(),
					shift_held
				)
			);
		}
		else
		{
			this.change_selection(
				Selection.none()
			);
		}
			
	}

	try_drag_start(position: Vector)
	{
		let v = this.get_vertex_at(position);
		if(v.is_some())
		{
			let vert = v.unwrap();
			this.v_drag = {
				dragging: true,
				vert
			};
		}
	}

	drag_end(position: Vector)
	{
		let v = this.get_vertex_at(position);

		if(v.is_some())
		{
			let vert = v.unwrap();
			
			this.add_edge(
				this.v_drag.vert,
				vert
			);
		}

		this.v_drag.dragging = false;
	}

	handle_keypress(key: string)
	{
		if(key == "Backspace")
		{
			if(this.selected.type == "edge")
			{
				let sel = this.selected.inner as number;
				this.remove_edge(sel);
			}
		}
	}

	//TODO: provide baked optional
	get_vertex_at(position: Vector): Option<number>
	{
		let dag = this.dag.bake();
		
		for(let i = 0; i < dag.verts.length; i++)
		{
			let vert_pos = this.canvas.local_trans(dag.verts[i]);
			if(position.sub(vert_pos).norm() <= this.draw_options.vert_radius())
				return Option.some(i);
		}
			
		return Option.none();
	}

	//TODO: provide baked optional
	get_edge_at(position: Vector): Option<number>
	{
		let dag = this.dag.bake();
		
		for(let i = dag.edges.length - 1; i >= 0; i--)
		{
			let bez = dag.edges[i].transform
				((v: Vector) => this.canvas.local_trans(v));

			if(bez.distance_to(position) <= this.draw_options.edge_weight())
				return Option.some(i);
		}
			
		return Option.none();
	}

	show_err(err: ResultError)
	{
		this.error_box.innerText = err.err_message;
	}

	clear_err()
	{
		this.error_box.innerText = "";
	}

	/*
	Operations
	*/

	add_edge(start: number, end: number)
	{
		if(start == end) return;

		let dag = this.dag.base_dag;
		let try_add_res = dag.add_edge(start,end);

		if(try_add_res.is_ok())
		{
			this.selected = Selection.none();
			let new_framed = new FramedDAGEmbedding(dag);
			this.dag = new_framed;
			this.draw();
			this.clear_err();
		}
		else
		{
			this.show_err(try_add_res.error())
		}
	}

	remove_edge(idx: number)
	{
		let dag = this.dag.base_dag;
		let try_add_res = dag.remove_edge(idx);

		if(try_add_res)
		{
			this.selected = Selection.none();
			let new_framed = new FramedDAGEmbedding(dag);
			this.dag = new_framed;
			this.draw();
			this.clear_err();
		}
	}

	/*
	Code for drawing
	*/


	draw()
	{	
		let ctx = this.canvas.get_ctx();
		let data = this.dag.bake();

		ctx.clear();

		for(let edge of data.edges)
		{ ctx.draw_bez(
			edge, 
			this.draw_options.edge_color(), 
			this.draw_options.edge_weight(), 
			true
		); }

		this.draw_selection_edge(data, ctx);

		this.draw_drag_edge(data, ctx)

		for(let vert of data.verts)
		{ ctx.draw_node(vert); }

		this.draw_selection_vert(data, ctx);

	}

	draw_selection_vert(data: BakedDAGEmbedding, ctx: DAGCanvasContext)
	{
		let verts: number[] = [];
		if(this.selected.type == "vertex")
		{
			verts = [this.selected.inner as number];
		}
		else if(this.selected.type == "pair_verts")
		{
			verts = this.selected.inner as [number, number];
		}

		for(let vert of verts)
		{
			if(0 > vert || vert >= data.verts.length)
			{
				this.change_selection(Selection.none());
				return;
			}
			let vpos = data.verts[vert];
			ctx.draw_circ(vpos,
				this.draw_options.selection_color(),
				this.draw_options.vert_radius() + 4
			)
		}
	}

	draw_selection_edge(data: BakedDAGEmbedding, ctx: DAGCanvasContext)
	{
		let edges: number[] = [];

		if(this.selected.type == "edge")
		{
			edges = [this.selected.inner as number];
		}
		else if(this.selected.type == "pair_edges")
		{
			edges = this.selected.inner as [number, number];
		}

		for(let edge of edges)
		{
			if(0 > edge || edge >= data.edges.length)
			{
				this.change_selection(Selection.none());
				return;
			}
			let bez = data.edges[edge]

			ctx.draw_bez(
				bez,
				this.draw_options.selection_color(),
				this.draw_options.edge_weight() + 5,
				false
			)
		}
	}

	draw_drag_edge(data: BakedDAGEmbedding, ctx: DAGCanvasContext)
	{
		if(!this.v_drag.dragging) return;

		let start = data.verts[this.v_drag.vert];
		let end = this.canvas.local_trans_inv(this.mouse_pos);

		ctx.draw_line(
			start,
			end,
			this.draw_options.edge_color(),
			this.draw_options.edge_weight()
		)
	}
}