import { BakedDAGEmbedding } from "../draw/dag_layout";
import { Vector } from "../util/num";
import { Option } from "../util/result";
import { FramedDAGEmbedding } from "../draw/dag_layout";
import { SIDEBAR_HEAD, SIDEBAR_CONTENTS, RIGHT_AREA } from "../html_elems";
import { DAGCanvas, DAGCanvasContext } from "../subelements/dag_canvas";
import { DrawOptions } from "../draw/draw_options";
import { DrawOptionBox as DrawOptionsBox } from "../subelements/draw_option_box";
import { IMode } from "./mode";

type SelectionType = "none" | "vertex" | "edge";
class Selection
{
	readonly type: SelectionType;
	readonly inner: null | number  ;

	private constructor(type: SelectionType, inner: null|number)
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
}

export class EmbeddingEditor implements IMode
{
	readonly draw_options: DrawOptions;
	readonly draw_options_box: DrawOptionsBox;

	canvas: DAGCanvas;
	dag: FramedDAGEmbedding;

	selected: Selection = Selection.none();

	name(): string
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
				this.canvas_click(new Vector(ev.layerX, ev.layerY))
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

	canvas_click(position: Vector)
	{
		let clicked_vert = this.get_vertex_at(position);
		if (clicked_vert.is_some())
		{
			this.change_selection(
				Selection.vertex(clicked_vert.unwrap())
			);
		}
		else
		{
			let clicked_edge = this.get_edge_at(position);
			if(clicked_edge.is_some())
			{
				this.change_selection(
					Selection.edge(clicked_edge.unwrap())
				);
			}
			else
			{
				this.change_selection(
					Selection.none()
				);
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
		if(this.selected.type == "vertex")
		{
			let vert = this.selected.inner as number;
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
		if(this.selected.type == "edge")
		{
			let edge = this.selected.inner as number;
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