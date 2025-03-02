import { BakedDAGEmbedding } from "../draw/dag_layout";
import { Vector } from "../util/num";
import { Option } from "../util/result";
import { FramedDAGEmbedding } from "../draw/dag_layout";
import { SIDEBAR_HEAD, SIDEBAR_CONTENTS, RIGHT_AREA } from "../html_elems";
import { DAGCanvas, DAGCanvasContext } from "../subelements/dag_canvas";
import { DrawOptions } from "../draw/draw_options";
import { DrawOptionBox as DrawOptionsBox } from "../subelements/draw_option_box";
import { IMode, ModeName } from "./mode";

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

export class EmbeddingEditor implements IMode
{
	readonly draw_options: DrawOptions;
	readonly draw_options_box: DrawOptionsBox;

	canvas: DAGCanvas;
	dag: FramedDAGEmbedding;

	selected: Selection = Selection.none();

	name(): ModeName
	{
		return "embedding-editor";
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
		draw_options.add_change_listener(() => {if(this) this.draw()})

		sidebar_head.innerText = "Embedding Editor";
		
		let {box, element: box_element} = DrawOptionsBox.create(draw_options);
		sidebar_contents.appendChild(box_element);
		this.draw_options_box = box;

		//TODO: Node editor

		//TODO: Edge editor

		let {canvas, element} = DAGCanvas.create(draw_options);
		right_area.appendChild(element);
		element.addEventListener("click",
			(ev) => {
				this.canvas_click(new Vector(ev.layerX, ev.layerY), ev.shiftKey)
			}
		)
		canvas.resize_canvas();
		this.canvas = canvas;

		this.draw();
		addEventListener("resize", (event) => {
			if(this)
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
}