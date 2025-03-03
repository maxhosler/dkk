import { BakedDAGEmbedding } from "../draw/dag_layout";
import { Vector2 } from "../util/num";
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

	readonly resize_event: (ev: UIEvent) => void;
	readonly keydown_event: (ev: KeyboardEvent) => void;

	canvas: DAGCanvas;
	dag: FramedDAGEmbedding;

	selected: Selection = Selection.none();
	v_drag: VertDragState = {
		dragging: false,
		vert: 0
	};
	mouse_pos: Vector2 = Vector2.zero();

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
		draw_options.add_change_listener(() => this.draw())

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
			() => this.add_edge_selected()
		);
		this.remove_edge_button = dag_box.add_button(
			"Remove edge",
			() => this.remove_edge_selected()
		);
		this.swap_edges_start = dag_box.add_button(
			"Swap framing at start",
			() => this.swap_at_start_selected()
		)
		this.swap_edges_end = dag_box.add_button(
			"Swap framing at end",
			() => this.swap_at_end_selected()
		)
		dag_box.add_shortcut_popup(
			[
				["Add edge", "E"],
				["Remove edge", "Backspace"],
				["Swap framing at start","S"],
				["Swap framing at end","Shift+S"]
			]
		);

		let {box: emb_box, element: emb_element} = ActionBox.create();
		sidebar_contents.appendChild(emb_element);
		emb_box.add_title("Embedding Edit");
		emb_box.add_tip("Coming soon")
		emb_box.add_shortcut_popup([
			["Coming", "Soon :)"]
		]);

		let {canvas, element: can_element} = DAGCanvas.create(draw_options);
		right_area.appendChild(can_element);
		can_element.addEventListener("click",
			(ev) => {
				this.canvas_click(new Vector2(ev.layerX, ev.layerY), ev.shiftKey)
			}
		)
		can_element.addEventListener("mousedown",
			(ev) => {
				this.try_drag_start(new Vector2(ev.layerX, ev.layerY));
			}
		)
		can_element.addEventListener("mouseup",
			(ev) => {
				this.drag_end(new Vector2(ev.layerX, ev.layerY));
			}
		)
		can_element.addEventListener("mouseleave",
			(ev) => {
				this.drag_end(new Vector2(ev.layerX, ev.layerY));
			}
		)
		can_element.addEventListener("mousemove",
			(ev) => {
				this.mouse_pos = new Vector2(ev.layerX, ev.layerY);
				if(this.v_drag.dragging) this.draw()
			}
		)

		canvas.resize_canvas();
		this.canvas = canvas;
		this.draw();
		
		this.resize_event = (event) => {
			this.canvas.resize_canvas();
			this.draw();
		}
		this.keydown_event = (ev) => this.handle_keypress(ev);
		addEventListener("resize", this.resize_event);
		addEventListener("keydown", this.keydown_event);
	}

	clear_global_events(): void {
		removeEventListener("resize", this.resize_event);
        removeEventListener("keydown", this.keydown_event);
	}

	change_selection(sel: Selection)
	{
		this.selected = sel;
		this.draw();
	}

	canvas_click(position: Vector2, shift_held: boolean)
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

	try_drag_start(position: Vector2)
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

	drag_end(position: Vector2)
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

	add_edge_selected()
	{
		if(this.selected.type == "pair_verts")
		{
			let [start, end] = this.selected.inner as [number, number];
			this.add_edge(start, end);
		}
	}

	remove_edge_selected()
	{
		if(this.selected.type == "edge")
		{
			let start = this.selected.inner as number;
			this.remove_edge(start);
		}
	}

	swap_at_start_selected()
	{
		if(this.selected.type == "pair_edges")
		{
			let [i,j] = this.selected.inner as [number, number];
			this.swap_at_start(i,j);
		}
	}

	swap_at_end_selected()
	{
		if(this.selected.type == "pair_edges")
		{
			let [i,j] = this.selected.inner as [number, number];
			this.swap_at_end(i,j);
		}
	}

	handle_keypress(ev: KeyboardEvent)
	{
		if(ev.key == "Backspace")
		{
			this.remove_edge_selected()
		}

		if(ev.key.toLowerCase() == "e")
		{
			this.add_edge_selected()
		}

		if(ev.key.toLowerCase() == "s" && !ev.shiftKey)
		{
			this.swap_at_start_selected()
		}

		if(ev.key.toLowerCase() == "s" && ev.shiftKey)
		{
			this.swap_at_end_selected()	
		}
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

	swap_at_start(e1: number, e2: number)
	{
		let start_opt = this.edges_share_start(e1, e2);
		if(start_opt.is_none()) return;

		let start = start_opt.unwrap();
		
		let dag = this.dag.base_dag;

		let frame = this.dag.base_dag.get_out_edges(start).unwrap();
		for(let i = 0; i < frame.length; i++)
		{
			if(frame[i] == e1) frame[i] = e2;
			else if(frame[i] == e2) frame[i] = e1;
		}
		let success = dag.reorder_out_edges(start, frame);

		if(success)
		{
			let new_framed = new FramedDAGEmbedding(dag);
			this.dag = new_framed;
			this.draw();
			this.clear_err();
		}
	}

	swap_at_end(e1: number, e2: number)
	{
		let end_opt = this.edges_share_end(e1, e2);
		if(end_opt.is_none()) return;

		let end = end_opt.unwrap();

		let dag = this.dag.base_dag;

		let frame = this.dag.base_dag.get_in_edges(end).unwrap();
		for(let i = 0; i < frame.length; i++)
		{
			if(frame[i] == e1) frame[i] = e2;
			else if(frame[i] == e2) frame[i] = e1;
		}
		let success = dag.reorder_in_edges(end, frame);

		if(success)
		{
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

		if(this.draw_options.label_framing())
			ctx.decorate_edges(
				this.dag.base_dag,
				data
			);

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

	/*
	Utility functions
	*/

	
	get_vertex_at(position: Vector2): Option<number>
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

	get_edge_at(position: Vector2): Option<number>
	{
		let dag = this.dag.bake();
		
		for(let i = dag.edges.length - 1; i >= 0; i--)
		{
			let bez = dag.edges[i].transform
				((v: Vector2) => this.canvas.local_trans(v));

			if(bez.distance_to(position) <= this.draw_options.edge_weight())
				return Option.some(i);
		}
			
		return Option.none();
	}

	edges_share_start(e1: number, e2: number): Option<number>
	{
		let edge1 = this.dag.base_dag.get_edge(e1);
		let edge2 = this.dag.base_dag.get_edge(e2);

		if(edge1.is_none() || edge2.is_none())
			return Option.none();

		let start1 = edge1.unwrap().start;
		let start2 = edge2.unwrap().start;
	
		if(start1 == start2)
			return Option.some(start1)
		else
			return Option.none();
	}

	edges_share_end(e1: number, e2: number): Option<number>
	{
		let edge1 = this.dag.base_dag.get_edge(e1);
		let edge2 = this.dag.base_dag.get_edge(e2);

		if(edge1.is_none() || edge2.is_none())
			return Option.none();

		let end1 = edge1.unwrap().end;
		let end2 = edge2.unwrap().end;
	
		if(end1 == end2)
			return Option.some(end1)
		else
			return Option.none();
	}
}