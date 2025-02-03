import { FramedDAG } from "../dag";

class Route
{
	edges: number[];

	constructor(edges: number[])
	{
		this.edges = edges;
	}
}

export class DAGRoutes
{
	
	readonly routes: Route[] = [];

	constructor(dag: FramedDAG)
	{
		let sink = dag.sink().expect("No unique sink!")
		let source = dag.source().expect("No unique source!")
	
		//TODO:
	}
}