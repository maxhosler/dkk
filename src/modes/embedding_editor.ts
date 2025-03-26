import { AngleOverride, BakedDAGEmbedding } from "../draw/dag_layout";
import { clamp, Vector2 } from "../util/num";
import { Option, ResultError } from "../util/result";
import { FramedDAGEmbedding } from "../draw/dag_layout";
import { SIDEBAR_HEAD, SIDEBAR_CONTENTS, RIGHT_AREA } from "../html_elems";
import { DAGCanvas, DAGCanvasContext } from "../subelements/dag_canvas";
import { DrawOptions } from "../draw/draw_options";
import { DrawOptionBox as DrawOptionsBox } from "../subelements/draw_option_box";
import { IMode, ModeName } from "./mode";
import { ActionBox } from "../subelements/action_box";
import { AngleOverrideController } from "../subelements/angle_override";
import { EditorOptions } from "../editor_options";
import { VecSpinner } from "../subelements/vec_spinner";

/*
Represents current selection, with possibilities of nothing, one vertex/edge
or two vertices/edges.

*/
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

	/*
	Takes in what and what type of thing has been clicked,
	and returns the next type of selection.
	*/
	change(
		clicked: "vertex" | "edge",
		index: number,
		shift_held: boolean
	): Selection
	{
		/*
		If any of the following is true:
		(1) nothing is selected
		(2) shift isn't held
		(3) the clicked thing is of a different type from the selected ones
		Just select the current thing alone.
		*/
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

		//If you're clicking a new thing of the same type,
		//select both.
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

		//If a pair is selected:
		//If you clicked on one of the things in the pair, deselect it.
		//Otherwise, swap the first of the selected things with the new thing
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

//Represent dragging various things
type EdgeDragState =
{
	dragging: boolean,
	vert: number
}
type VertMoveDragState = 
{
	dragging: boolean,
	vert: number
}
type HandleDragState = 
{
	dragging: boolean,
	edge: number,
	side: "start" | "end"
}
export class EmbeddingEditor implements IMode
{
	readonly draw_options: DrawOptions;
	readonly draw_options_box: DrawOptionsBox;

	//Place to display errors
	readonly error_box: HTMLDivElement;

	//Many, manny elements and editor buttons
	readonly add_edge_button: HTMLButtonElement;
	readonly remove_edge_button: HTMLButtonElement;
	readonly swap_start_button: HTMLButtonElement;
	readonly swap_end_button: HTMLButtonElement;
	readonly add_reembed_cb: HTMLInputElement;
	readonly remove_reembed_cb: HTMLInputElement;
	readonly swap_reembed_cb: HTMLInputElement;

	readonly inout: HTMLElement;
	readonly in_spread_spinner: HTMLInputElement;
	readonly out_spread_spinner: HTMLInputElement;

	readonly vert_pos_spinner: VecSpinner;
	readonly vps_row: HTMLElement;

	readonly start_angle_override: AngleOverrideController;
	readonly end_angle_override: AngleOverrideController;

	readonly editor_options: EditorOptions = new EditorOptions();

	readonly resize_event: (ev: UIEvent) => void;
	readonly keydown_event: (ev: KeyboardEvent) => void;

	canvas: DAGCanvas;
	embedding: FramedDAGEmbedding;

	selected: Selection = Selection.none();
	//Click and drag for adding edges
	e_drag: EdgeDragState = {
		dragging: false,
		vert: 0
	};
	//click and drag for mocing vertices
	v_drag: VertMoveDragState = {
		dragging: false, 
		vert: 0
	};
	//click and drag for moving vec-abs handles
	h_drag: HandleDragState = {
		dragging: false, 
		edge: 0,
		side: "start"
	};
	
	//current mouse position
	mouse_pos: Vector2 = Vector2.zero();

	//IMode implementations
	name(): ModeName
	{
		return "embedding-editor";
	}
	current_embedding(): FramedDAGEmbedding {
        return this.embedding;
    }
	clear_global_events(): void {
		removeEventListener("resize", this.resize_event);
        removeEventListener("keydown", this.keydown_event);
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

	private constructor(
		dag: FramedDAGEmbedding,
		draw_options: DrawOptions,

		sidebar_head: HTMLDivElement,
		sidebar_contents: HTMLDivElement,
		right_area: HTMLDivElement
	)
	{
		this.embedding = dag;
		this.draw_options = draw_options;
		draw_options.add_change_listener(() => this.draw())

		sidebar_head.innerText = "Embedding Editor";
		
		let {box: do_box, element: do_box_element} = DrawOptionsBox.create(draw_options);
		sidebar_contents.appendChild(do_box_element);
		this.draw_options_box = do_box;		

		this.error_box = document.createElement("div");
		this.error_box.id = "ee-error-zone";
		sidebar_contents.appendChild(this.error_box);

		//Building up options for editing DAG
		let {box: dag_box, element: dag_element} = ActionBox.create();
		sidebar_contents.appendChild(dag_element);
		dag_box.add_title("DAG Edit");
		this.add_edge_button = dag_box.add_button(
			"Add edge",
			() => this.add_edge_selected()
		);
		this.remove_edge_button = dag_box.add_button(
			"Remove edge",
			() => this.remove_edge_selected()
		);
		this.swap_start_button = dag_box.add_button(
			"Swap framing at start",
			() => this.swap_at_start_selected()
		)
		this.swap_end_button = dag_box.add_button(
			"Swap framing at end",
			() => this.swap_at_end_selected()
		)
		this.add_reembed_cb = dag_box.add_checkbox(
			"Re-embed on add",
			(v) => this.editor_options.set_reembed_add(v)
		)
		this.add_reembed_cb.checked = this.editor_options.reembed_add();

		this.remove_reembed_cb = dag_box.add_checkbox(
			"Re-embed on remove",
			(v) => this.editor_options.set_reembed_remove(v)
		)
		this.remove_reembed_cb.checked = this.editor_options.reembed_remove();

		this.swap_reembed_cb = dag_box.add_checkbox(
			"Re-embed on swap",
			(v) => this.editor_options.set_reembed_swap(v)
		)
		this.swap_reembed_cb.checked = this.editor_options.reembed_swap();


		dag_box.add_shortcut_popup(
			[
				["Add edge", "E"],
				["Remove edge", "Backspace"],
				["Swap framing at start","D"],
				["Swap framing at end","Shift+D"]
			]
		);

		//Building up options for editing embedding
		let {box: emb_box, element: emb_element} = ActionBox.create();
		sidebar_contents.appendChild(emb_element);
		emb_box.add_title("Embedding Edit");
		emb_box.add_tip("Ctrl+Drag to move vertices.")

		emb_box.add_space(12);

		let {row: inout_row, spinner1: in_spinner, spinner2: out_spinner} = emb_box.add_dual_spinner(
			"In-spread",
			"emb-in-spread",
			[15, 180],
			5,
			(val) => this.set_in_angle_selected(val * (Math.PI / 180)),
			"Out-spread",
			"emb-out-spread",
			[15, 180],
			5,
			(val) => this.set_out_angle_selected(val * (Math.PI / 180)),
		);
		this.inout = inout_row;
		this.in_spread_spinner = in_spinner;
		this.out_spread_spinner = out_spinner;

		this.vert_pos_spinner = new VecSpinner();
		this.vps_row = emb_box.add_labelled_row(this.vert_pos_spinner.base, "Position");
		this.vert_pos_spinner.add_change_listeners(
			(v) => {
				if(this.selected.type == "vertex")
				{
					let vert = this.selected.inner as number;
					this.embedding.vert_data[vert].position = v;
					this.draw();
				}
			}
		)
		

		this.start_angle_override = new AngleOverrideController("Start");
		this.start_angle_override.add_change_listeners(
			(ov) => this.change_start_override_selected(ov)
		);
		emb_box.add_row(this.start_angle_override.base);

		this.end_angle_override = new AngleOverrideController("End");
		this.end_angle_override.add_change_listeners(
			(ov) => this.change_end_override_selected(ov)
		);
		emb_box.add_row(this.end_angle_override.base);

		emb_box.add_space(12);

		emb_box.add_button(
			"Reset to default",
			() => {
				this.embedding.default_layout();
				this.draw();
			}
		)
		emb_box.add_shortcut_popup([
			["Move vertex", "Ctrl+Drag"],
			["Select two", "Shift+Left Click"],
			["Increase in-spread", "W"],
			["Decrease in-spread", "S"],
			["Increase out-spread", "Shift+W"],
			["Decrease out-spread", "Shift+S"],

		]);

		//Setting up the canvas and events
		let {canvas, element: can_element} = DAGCanvas.create(draw_options);
		right_area.appendChild(can_element);

		//Events for handling clicking and dragging
		can_element.addEventListener("mousedown",
			(ev) => {
				let pos = new Vector2(ev.layerX, ev.layerY)
				if(ev.button == 0 && !ev.ctrlKey && !ev.shiftKey) {
					this.try_handle_drag_start(pos);
					if(!this.h_drag.dragging)
						this.try_edge_drag_start(pos);
				}
				if(ev.button == 0 && ev.ctrlKey && !ev.shiftKey)
					this.try_vert_drag_start(pos);
			}
		)
		can_element.addEventListener("mouseup",
			(ev) => {
				if(ev.button == 0) {
					this.edge_drag_end(new Vector2(ev.layerX, ev.layerY));
					this.vert_drag_end();
					let skip_click = this.handle_drag_end();

					if(!skip_click)
						this.canvas_click(new Vector2(ev.layerX, ev.layerY), ev.shiftKey)

					this.draw();
				}
			}
		)
		can_element.addEventListener("mouseleave",
			(ev) => {
				this.edge_drag_end(new Vector2(ev.layerX, ev.layerY));
				this.vert_drag_end();
				this.handle_drag_end();
				this.draw();
			}
		)
		can_element.addEventListener("mousemove",
			(ev) => {
				this.mouse_pos = new Vector2(ev.layerX, ev.layerY);
				this.move_dragged_vert();
				this.move_dragged_handle();
				if(this.e_drag.dragging || this.v_drag.dragging || this.h_drag.dragging) this.draw()
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

		this.update_sidebar();
	}

	//Set selection and update
	change_selection(sel: Selection)
	{
		this.selected = sel;
		this.draw();
		this.update_sidebar();
	}

	//handle clicks
	canvas_click(position: Vector2, shift_held: boolean)
	{

		let clicked_vert = this.get_vertex_at(position);
		let clicked_edge = this.get_edge_at(position);

		//Change selection; verts have priority over edges
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

	//See if its valid to start dragging a vec-abs handle at (position)
	//and initiate if so
	try_handle_drag_start(position: Vector2)
	{
		let clicked_handle = this.get_handle_at(position);
		if(clicked_handle.is_some())
		{
			let handle = clicked_handle.unwrap();
			this.h_drag = {
				dragging: true,
				edge: handle.edge,
				side: handle.side
			}
		}
	}

	//See if its valid to start creating an edge at (position)
	//and initiate if so
	try_edge_drag_start(position: Vector2)
	{
		let v = this.get_vertex_at(position);
		if(v.is_some())
		{
			let vert = v.unwrap();
			this.e_drag = {
				dragging: true,
				vert
			};
		}
	}

	//See if its valid to start dragging a vertex at (position)
	//and initiate if so
	try_vert_drag_start(position: Vector2)
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

	//When we finish dragging an edge,
	//add the edge if the endpoint is valid
	edge_drag_end(position: Vector2)
	{
		if(!this.e_drag.dragging) return;

		let v = this.get_vertex_at(position);

		if(v.is_some())
		{
			let vert = v.unwrap();
			
			this.add_edge(
				this.e_drag.vert,
				vert
			);
		}

		this.e_drag.dragging = false;
	}

	//When we finish dragging a vertex, cleanup
	vert_drag_end()
	{
		if(!this.v_drag.dragging) return;

		this.v_drag.dragging = false;
		this.selected = Selection.vertex(this.v_drag.vert);
	}

	//When we finish dragging a vec-abs handle, cleanup
	handle_drag_end(): boolean
	{
		if(!this.h_drag.dragging) return false;

		this.h_drag.dragging = false;
		this.selected = Selection.edge(this.h_drag.edge);
		return true;
	}

	//Move vert to mouse_pos
	move_dragged_vert()
	{
		if(!this.v_drag.dragging) return;
		this.embedding.vert_data[this.v_drag.vert].position = 
			this.canvas.local_trans_inv(this.mouse_pos);
		this.update_sidebar();
	}

	//Move handle to mouse_pos
	move_dragged_handle()
	{
		if(!this.h_drag.dragging) return;
		
		let dagspace_mp = this.canvas.local_trans_inv(this.mouse_pos);
		let edge_idx = this.h_drag.edge;
		let edge = this.embedding.dag.get_edge(edge_idx).unwrap();
		if(this.h_drag.side == "start")
		{
			let base_position = this.embedding.vert_data[edge.start].position;
			let tangent = dagspace_mp.sub(base_position);
			this.embedding.edge_data[edge_idx].start_ang_override = AngleOverride.vec_abs(tangent);
		}
		if(this.h_drag.side == "end")
		{
			let base_position = this.embedding.vert_data[edge.end].position;
			let tangent = base_position.sub(dagspace_mp);
			this.embedding.edge_data[edge_idx].end_ang_override = AngleOverride.vec_abs(tangent);
		}
		this.update_sidebar();
	}

	//Add edge if valid
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
			this.change_selection(Selection.none());
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

	change_out_angle_selected(delta: number)
	{
		if(this.selected.type != "vertex") return;

		let v = this.selected.inner as number;
		this.embedding.vert_data[v].spread_out =
			clamp(this.embedding.vert_data[v].spread_out + delta, 0, Math.PI);
		this.draw();
	}

	change_in_angle_selected(delta: number)
	{
		if(this.selected.type != "vertex") return;

		let v = this.selected.inner as number;
		this.embedding.vert_data[v].spread_in =
			clamp(this.embedding.vert_data[v].spread_in + delta, 0, Math.PI);
		this.draw();
	}

	change_start_override_selected(val: AngleOverride)
	{
		if(this.selected.type != "edge") return;
		let edge_idx = this.selected.inner as number;
		this.embedding.edge_data[edge_idx].start_ang_override = val;
		this.draw();
	}

	change_end_override_selected(val: AngleOverride)
	{
		if(this.selected.type != "edge") return;
		let edge_idx = this.selected.inner as number;
		this.embedding.edge_data[edge_idx].end_ang_override = val;
		this.draw();
	}

	set_out_angle_selected(angle: number)
	{
		if(this.selected.type != "vertex") return;

		let v = this.selected.inner as number;
		this.embedding.vert_data[v].spread_out = angle;
		this.draw();
	}

	set_in_angle_selected(angle: number)
	{
		if(this.selected.type != "vertex") return;

		let v = this.selected.inner as number;
		this.embedding.vert_data[v].spread_in = angle;
		this.draw();
	}

	//This updates the sidebar to hide/show and disable/enable
	//options that are irrelevant or unusable
	update_sidebar()
	{
		this.add_edge_button.disabled = this.selected.type != "pair_verts";
		this.remove_edge_button.disabled = this.selected.type != "edge";
		
		if(this.selected.type == "pair_edges")
		{
			let [i,j] = this.selected.inner as [number,number];
			this.swap_end_button.disabled =
				this.edges_shared_end(i,j).is_none();
			this.swap_start_button.disabled =
				this.edges_shared_start(i,j).is_none();
		}
		else
		{
			this.swap_end_button.disabled = true;
			this.swap_start_button.disabled = true;	
		}

		if(this.selected.type == "vertex")
		{
			this.inout.style.display = "block";
			let i = this.selected.inner as number;
			let vd = this.embedding.vert_data[i];
			this.in_spread_spinner.value = Math.round(vd.spread_in * (180 / Math.PI) ).toString();
			this.out_spread_spinner.value = Math.round(vd.spread_out * (180 / Math.PI) ).toString();

			this.vps_row.style.display = "";
			this.vert_pos_spinner.set_value(vd.position);
		}
		else
		{
			this.inout.style.display = "none";
			this.vps_row.style.display = "none";
		}

		if(this.selected.type == "edge")
		{
			this.start_angle_override.set_visible(true);
			this.end_angle_override.set_visible(true);

			let i = this.selected.inner as number;
			let vd = this.embedding.edge_data[i];

			this.start_angle_override.set_value(vd.start_ang_override);
			this.end_angle_override.set_value(vd.end_ang_override);
		}
		else
		{
			this.start_angle_override.set_visible(false);
			this.end_angle_override.set_visible(false);
		}
	}

	//Handle keyboard shortcuts
	handle_keypress(ev: KeyboardEvent)
	{
		if(in_typable_box()) return;

		if(ev.key == "Backspace")
		{
			this.remove_edge_selected()
		}

		if(ev.key.toLowerCase() == "e")
		{
			this.add_edge_selected()
		}

		if(ev.key.toLowerCase() == "d" && !ev.shiftKey)
		{
			this.swap_at_start_selected()
		}

		if(ev.key.toLowerCase() == "d" && ev.shiftKey)
		{
			this.swap_at_end_selected()	
		}

		if(ev.key.toLowerCase() == "w" && ev.shiftKey)
			this.change_out_angle_selected(Math.PI/16);
		if(ev.key.toLowerCase() == "s" && ev.shiftKey)
			this.change_out_angle_selected(-Math.PI/16);

		if(ev.key.toLowerCase() == "w" && !ev.shiftKey)
			this.change_in_angle_selected(Math.PI/16);
		if(ev.key.toLowerCase() == "s" && !ev.shiftKey)
			this.change_in_angle_selected(-Math.PI/16);
	
		this.update_sidebar();
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

		let try_add_res = this.embedding.add_edge(start,end);

		if(try_add_res.is_ok())
		{
			if(this.editor_options.reembed_add())
				this.embedding.default_edges();
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
		let try_add_res = this.embedding.remove_edge(idx);

		if(try_add_res)
		{
			if(this.editor_options.reembed_remove())
				this.embedding.default_edges();
			this.draw();
			this.clear_err();
		}
	}

	swap_at_start(e1: number, e2: number)
	{
		let start_opt = this.edges_shared_start(e1, e2);
		if(start_opt.is_none()) return;

		let start = start_opt.unwrap();
		
		let dag = this.embedding.dag;

		let frame = this.embedding.dag.get_out_edges(start).unwrap();
		for(let i = 0; i < frame.length; i++)
		{
			if(frame[i] == e1) frame[i] = e2;
			else if(frame[i] == e2) frame[i] = e1;
		}
		let success = dag.reorder_out_edges(start, frame);

		if(success)
		{
			if(this.editor_options.reembed_swap())
				this.embedding.default_edges();
			this.draw();
			this.clear_err();
		}
	}

	swap_at_end(e1: number, e2: number)
	{
		let end_opt = this.edges_shared_end(e1, e2);
		if(end_opt.is_none()) return;

		let end = end_opt.unwrap();

		let dag = this.embedding.dag;

		let frame = this.embedding.dag.get_in_edges(end).unwrap();
		for(let i = 0; i < frame.length; i++)
		{
			if(frame[i] == e1) frame[i] = e2;
			else if(frame[i] == e2) frame[i] = e1;
		}
		let success = dag.reorder_in_edges(end, frame);

		if(success)
		{
			if(this.swap_reembed_cb.checked)
				this.embedding.default_edges();
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
		let data = this.embedding.bake();

		ctx.clear();

		for(let edge of data.edges)
			ctx.draw_bez(
				edge, 
				this.draw_options.edge_color(), 
				this.draw_options.edge_weight(), 
				true
			); 

		if(this.draw_options.arrows())
			ctx.decorate_edges_arrow(data);

		this.draw_selection_edge(data, ctx);

		this.draw_drag_edge(data, ctx)

		for(let vert of data.verts)
			ctx.draw_node(vert);

		if(this.draw_options.label_framing())
			ctx.decorate_edges_num(
				this.embedding.dag,
				data
			);
		
		this.draw_selection_vert(data, ctx);
		this.draw_tangent_handles(data, ctx);
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
		if(!this.e_drag.dragging) return;

		let start = data.verts[this.e_drag.vert];
		let end = this.canvas.local_trans_inv(this.mouse_pos);

		ctx.draw_line(
			start,
			end,
			this.draw_options.edge_color(),
			this.draw_options.edge_weight()
		)
	}

	draw_tangent_handles(data: BakedDAGEmbedding, ctx: DAGCanvasContext)
	{
		if(this.selected.type != "edge") return;

		let edge = this.selected.inner as number;
		let edge_data = this.embedding.edge_data[edge];
		let bez = data.edges[edge];
		if(edge_data.start_ang_override.type == "vec-abs")
		{
			ctx.draw_line(
				bez.start_point,
				bez.cp1,
				this.draw_options.handle_color() + "88",
				this.draw_options.tangent_arm_weight()
			);
			ctx.draw_circ(
				bez.cp1,
				this.draw_options.handle_color(),
				this.draw_options.tangent_handle_size()
			);
		}

		if(edge_data.end_ang_override.type == "vec-abs")
		{
			ctx.draw_line(
				bez.end_point,
				bez.cp2,
				this.draw_options.handle_color() + "88",
				this.draw_options.tangent_arm_weight()
			);
			ctx.draw_circ(
				bez.cp2,
				this.draw_options.handle_color(),
				this.draw_options.tangent_handle_size()
			);
		}
	}

	/*
	Utility functions
	*/

	
	get_vertex_at(position: Vector2): Option<number>
	{
		let dag = this.embedding.bake();
		
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
		let dag = this.embedding.bake();
		
		for(let i = dag.edges.length - 1; i >= 0; i--)
		{
			let bez = dag.edges[i].transform
				((v: Vector2) => this.canvas.local_trans(v));

			if(bez.distance_to(position) <= this.draw_options.edge_weight())
				return Option.some(i);
		}
			
		return Option.none();
	}

	edges_shared_start(e1: number, e2: number): Option<number>
	{
		let edge1 = this.embedding.dag.get_edge(e1);
		let edge2 = this.embedding.dag.get_edge(e2);

		if(edge1.is_none() || edge2.is_none())
			return Option.none();

		let start1 = edge1.unwrap().start;
		let start2 = edge2.unwrap().start;
	
		if(start1 == start2)
			return Option.some(start1)
		else
			return Option.none();
	}

	edges_shared_end(e1: number, e2: number): Option<number>
	{
		let edge1 = this.embedding.dag.get_edge(e1);
		let edge2 = this.embedding.dag.get_edge(e2);

		if(edge1.is_none() || edge2.is_none())
			return Option.none();

		let end1 = edge1.unwrap().end;
		let end2 = edge2.unwrap().end;
	
		if(end1 == end2)
			return Option.some(end1)
		else
			return Option.none();
	}

	get_handle_at(position: Vector2): Option<{edge: number, side: "start" | "end"}>
	{
		if(this.selected.type != "edge") return Option.none();
		let idx = this.selected.inner as number;
		let ed = this.embedding.edge_data[idx];
		if(ed.end_ang_override.type != "vec-abs" && ed.start_ang_override.type != "vec-abs")
			return Option.none();
		
		let dag = this.embedding.bake();
		if(ed.start_ang_override.type == "vec-abs")
		{
			let point = this.canvas.local_trans(dag.edges[idx].cp1);
			if(position.sub(point).norm() <= this.draw_options.tangent_handle_size())
				return Option.some({edge: idx, side: "start"});
		}
		if(ed.end_ang_override.type == "vec-abs")
		{
			let point = this.canvas.local_trans(dag.edges[idx].cp2);
			if(position.sub(point).norm() <= this.draw_options.tangent_handle_size())
				return Option.some({edge: idx, side: "end"});
		}

		return Option.none();
	}
}

const TYPABLE: string[] = [
	"number", "email", "password", "text"
]
function in_typable_box(): boolean
{
	let active = document.activeElement;
	if(!active) return false;
	if(active.nodeName != "INPUT") return false;
	let a_input = active as HTMLInputElement;

	return TYPABLE.includes(
		a_input.type.toLowerCase()
	)
	
}