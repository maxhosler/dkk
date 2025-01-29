import { FramedDAG } from "./dag";

export class Vector
{
	public x: number;
	public y: number;

	constructor(x: number, y: number)
	{
		this.x=x;
		this.y=y;
	}

	static zero(): Vector
	{
		return new Vector(0,0);
	}

	scale(s: number): Vector
	{
		return new Vector(
			this.x * s,
			this.y * s
		);
	}

	add(v: Vector): Vector
	{
		return new Vector(
			this.x + v.x,
			this.y + v.y
		);
	}
}

export type EdgeData = {
	start_rel_angle: number,
	end_rel_angle:   number,
	middle_rel_coords: Vector
}

export class FramedDAGLayout
{
	readonly base_dag: FramedDAG;
	
	vert_positions: Array<Vector>;
	edge_data: Array<EdgeData>;

	constructor(dag: FramedDAG)
	{
		this.base_dag = structuredClone(dag);
		this.vert_positions = Array.from(
			{length:dag.num_verts()},
			() => (Vector.zero())
		);
		this.edge_data = Array.from(
			{length:dag.num_edges()},
			() => ({ start_rel_angle: 0, end_rel_angle: 0, middle_rel_coords: new Vector(0.5, 0.0) })
		);
	}

	default_layout()
	{
		//TODO: Layout
	}
}