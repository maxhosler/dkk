import { FramedDAG, JSONFramedDag } from "./dag";
import { Option, Result } from "../util/result";
import { HasseDiagram, JSONHasseDiagram } from "./hasse";

//Just a wrapper around a list of numbers, each representing an edge
class Route
{
	readonly edges: number[];

	constructor(edges: number[])
	{
		this.edges = edges;
	}
}

/*
Similarly to above, a wrapper around a list of numbers, each representing a route.
The additional functions are just to properly sort the edges so that they can look
as nice as possible when rendered.
*/
export class Clique
{
	//Returns a comparison function between routes
	//which tries to order them 'at' the edge {edge_num}.
	static indexed_local_edge_order(
		edge_num: number,
		routes: number[],
		dag_context: DAGCliques
	): (a: number, b: number) => number
	{
		return (a: number, b: number) =>
		{
			let r1 = routes[a];
			let r2 = routes[b];
			let ssr = dag_context.shared_subroutes(r1,r2);
			for(let shared of ssr)
			{
				if(shared.edges.includes(edge_num))
				{
					if(shared.in_order == 0)
						return shared.out_order;
					return shared.in_order;
				}
			}
			return 1
		} 
	}

	//Sorts the routes of a clique the best it can.
	static build_with_order(routes: number[], dag_context: DAGCliques): Clique
	{
		let routes_per_edge: number[][] = [];
		for(let edge_num = 0; edge_num < dag_context.dag.num_edges(); edge_num++)
		{
			let routes_on_edge = [];
			for(let i = 0; i < routes.length; i++)
			{
				let r = routes[i];
				let route = dag_context.routes[r];
				if(route.edges.includes(edge_num))
					routes_on_edge.push(i);
			}
			let sort = Clique.indexed_local_edge_order(edge_num, routes, dag_context);
			routes_on_edge.sort(sort);
			routes_per_edge.push(routes_on_edge);
		}
		let source_edges = dag_context.dag.get_out_edges(dag_context.dag.source().unwrap()).unwrap();
		let new_routes: number[] = [];
		for(let edge of source_edges)
			for(let route_idx of routes_per_edge[edge])
				new_routes.push(routes[route_idx]);

		return new Clique(new_routes);
		
	}
	readonly routes: number[];
	constructor(routes: number[])
	{
		this.routes = routes;
	}
}

/*
Represents a shared subroute.
The in-vert and out-verts are the start and end vertices, while
in-edges and out-edges represents the edges directly before and after these vertices, repsectively,
one for each route. Edges is a list of edge indices, and in_order and out_order are the relative position
of the routes, -1 is below, 1 is above, and 0 is indeterminate, which occurs when the routes start at the
source or end at the sink.
*/
export type SharedSubroute = 
{
	in_vert: number,
	out_vert: number,

	in_edges: Option<[number, number]>,
	out_edges: Option<[number, number]>,

	edges: number[],

	in_order: 1 | 0 | -1,
	out_order: 1 | 0 | -1
};
type SharedSubrouteCollection = SharedSubroute[];


export class DAGCliques
{
	readonly dag: FramedDAG;
	readonly routes: Route[];
	readonly cliques: Clique[];
	readonly clique_size: number;

	readonly exceptional_routes: number[];
	readonly mutations: number[][]; //clique index, and route index in clique
	readonly clique_leq_matrix: boolean[][];
	readonly shared_subroutes_arr: SharedSubrouteCollection[][];
	readonly hasse: HasseDiagram;

	constructor(dag: FramedDAG)
	{
		this.dag = dag;

		let sink   = dag.sink()  .expect("No unique sink!");
		let source = dag.source().expect("No unique source!");
		
		//Compute routes
		let routes: Route[] = []
		let incomplete_routes: number[][] = []
		for(let e of dag.get_out_edges(source).unwrap_or([]))
			incomplete_routes.push([e]);

		while(incomplete_routes.length != 0)
		{
			let new_paths: number[][] = [];
			for(let pth of incomplete_routes)
			{
				let edge = dag.get_edge(pth[pth.length-1]).unwrap();
				if(edge.end == sink)
				{
					routes.push(new Route(pth))
				}
				else
				{
					for(let next_edge of dag.get_out_edges(edge.end).unwrap_or([]))
					{
						new_paths.push([...pth, next_edge]);
					}
				}
			}
			incomplete_routes = new_paths;
		}
		this.routes = routes;

		//Compute shared subroutes
		let shared_subroutes_arr: SharedSubrouteCollection[][] = [];
		for(let i = 0; i < routes.length; i++)
		{
			shared_subroutes_arr.push([])
			for(let j = 0; j < routes.length; j++)
			{
				shared_subroutes_arr[i].push(
					this.inner_shared_subroutes(i, j)
				);
			}
		}
		this.shared_subroutes_arr = shared_subroutes_arr;
	
		//Compute cliques
		let extend: (arr: number[]) => number[][] = (arr: number[]) => {
			let start = Math.max.apply(null, arr)+1;
			let out: number[][] = [];

			for(let j = start; j < this.routes.length; j++)
			{
				let compat = true;

				for(let e of arr)
				{
					if(!this.inner_compatible(e,j))
					{
						compat = false;
						break;
					}
				}
				if(compat)
					out.push([...arr,j]) 
			}

			return out;
		};
		let cliques = [];
		let nonmaximal: number[][] = [];
		for(let i = 0; i < this.routes.length; i++)
		{
			nonmaximal.push([i]);
		}
		while(true)
		{
			let new_nm: number[][] = [];
			for(let base of nonmaximal)
			{
				new_nm.push(...extend(base));
			}
			if(new_nm.length == 0)
			{
				for(let arr of nonmaximal)
					cliques.push(Clique.build_with_order(arr, this))
				break;
			}
			else
			{
				nonmaximal = new_nm;
			}
		}
		this.cliques = cliques;
		this.clique_size = cliques[0].routes.length;

		//Computes the result of trying to 'swap' a given
		//route
		let clique_route_swaps: number[][] = [];
		for(let i = 0; i < this.cliques.length; i++)
		{
			clique_route_swaps.push([]);
			for(let j = 0; j < this.clique_size; j++)
			{
				clique_route_swaps[i].push(i);
			}
		}
		for(let clq1 = 0; clq1 < this.cliques.length; clq1++){
			for(let clq2 = clq1+1; clq2 < this.cliques.length; clq2++)
			{
				let c1 = this.cliques[clq1];
				let c2 = this.cliques[clq2];

				let intersection =  c1.routes.filter(value => c2.routes.includes(value));
				if(intersection.length != c1.routes.length-1) continue;
				
				let i_r1 = -1;
				for(let r1 of c1.routes)
					if(!c2.routes.includes(r1))
						i_r1 = c1.routes.indexOf(r1);
				let i_r2 = -1;
				for(let r2 of c2.routes)
					if(!c1.routes.includes(r2))
						i_r2 = c2.routes.indexOf(r2);
				
				clique_route_swaps[clq1][i_r1] = clq2;
				clique_route_swaps[clq2][i_r2] = clq1;

			}
		}
		this.mutations = clique_route_swaps;
		
		//Computes the poset relation
		let clique_leq_matrix: boolean[][] = [];
		for(let clq1 = 0; clq1 < this.cliques.length; clq1++){
			clique_leq_matrix.push([]);
			for(let clq2 = 0; clq2 < this.cliques.length; clq2++)
			{
				clique_leq_matrix[clq1].push(
					this.inner_clique_leq(clq1, clq2)
				);
			}
		}
		this.clique_leq_matrix = clique_leq_matrix;
		
		this.hasse = new HasseDiagram(clique_leq_matrix, this.cliques);

		let exceptional_routes: number[] = [];

		for(let i = 0; i < this.routes.length; i++)
		{
			let in_all = true;
			for(let clq of this.cliques)
			{
				if(!clq.routes.includes(i))
				{
					in_all = false;
					break;
				}
			}
			if(in_all)
				exceptional_routes.push(i);
		}

		this.exceptional_routes = exceptional_routes;
	}

	/*
	These 'inner' functions are used during the constructor to compute data
	that is then stored to be read later. There is no need to call them anywhere
	besides the constructor.
	Be careful when editing! These do should not assume the object is fully constructed.
	*/

	//Computes shared subroutes between two routes
	//Only assumes this.dag and this.routes have been initialized.
	private inner_shared_subroutes(route_idx_1: number, route_idx_2: number): SharedSubroute[]
	{

		let r1_e = this.routes[route_idx_1].edges;
		let r2_e = this.routes[route_idx_2].edges;

		let r1_v = this.inner_route_vertices(route_idx_1);
		let r2_v = this.inner_route_vertices(route_idx_2);

		let shared_subsequences: SharedSubroute[] = [];
		for(let i = 0; i < r1_v.length; i++)
		{
			let vert = r1_v[i];
			if(!r2_v.includes(vert))
				continue;
			
			let j = r2_v.indexOf(vert);
			let start1 = i;
			let start2 = j;

			let edges = [];
			
			//Reuse of 'i' here is not a mistake
			while(
				i < r1_e.length &&
				j < r2_e.length &&
				r1_e[i] == r2_e[j]
			)
			{
				edges.push(r1_e[i]);
				i += 1;
				j += 1;
			}

			let end1 = i;
			let end2 = j;

			let in_edges: Option<[number,number]> = Option.none();
			let out_edges: Option<[number, number]> = Option.none();

			let in_order:  1 | 0 | -1 = 0;
			let out_order: 1 | 0 | -1 = 0;

			if(start1 != 0)
			{
				let edge1 = r1_e[start1-1];
				let edge2 = r2_e[start2-1];

				in_edges = Option.some([edge1, edge2])

				let in_edge_list = this.dag.get_in_edges(vert).unwrap();
				let pos1 = in_edge_list.indexOf(edge1);
				let pos2 = in_edge_list.indexOf(edge2);

				if (pos1 > pos2)
					in_order = 1;
				else
					in_order = -1;
			}
			if(end1 < r1_e.length)
			{

				let edge1 = r1_e[end1];
				let edge2 = r2_e[end2];

				out_edges = Option.some([edge1, edge2])

				let vert = r1_v[end1];

				let out_edge_list = this.dag.get_out_edges(vert).unwrap();
				let pos1 = out_edge_list.indexOf(edge1);
				let pos2 = out_edge_list.indexOf(edge2);

				if (pos1 > pos2)
					out_order = 1;
				else
					out_order = -1;
			}
			
			let shared: SharedSubroute = {
				in_vert: r1_v[start1],
				out_vert: r1_v[i-1] || r1_v[start1],
				in_edges,
				out_edges,
				in_order,
				out_order,
				edges
			}

			shared_subsequences.push(shared);
		}
		return shared_subsequences;
	}

	//Computes poset relation
	//Only assumes this.dag, this.routes, and this.cliques have been initialized.
	private inner_clique_leq(clq_idx_1: number, clq_idx_2: number): boolean
	{
		if(clq_idx_1 == clq_idx_2) return true;
		let c1 = this.cliques[clq_idx_1];
		let c2 = this.cliques[clq_idx_2];

		for(let r1 of c1.routes)
			for(let r2 of c2.routes)
				if(this.inner_up_incompatible(r1,r2))
					return false;

		return true;
	}

	//Computes compatibility between two routes.
	//Only assumes this.dag and this.routes have been initialized.
	private inner_compatible(route_idx_1: number, route_idx_2: number): boolean
	{
		let shared_subroutes = this.shared_subroutes(route_idx_1, route_idx_2);
		for(let sub of shared_subroutes)
		{
			if(sub.in_order * sub.out_order < -0.01) return false;
		}

		return true;
	}

	//Computes up-compatibility between two routes.
	//Only assumes this.dag and this.routes have been initialized.
	private inner_up_incompatible(route_idx_1: number, route_idx_2: number): boolean
	{
		let shared_subroutes = this.shared_subroutes(route_idx_1, route_idx_2);
		for(let sub of shared_subroutes)
		{
			if(sub.in_order > 0 && sub.out_order < 0)
			{
				return true;
			}
		}

		return false;
	}

	//Computes vertices of route
	//Only assumes this.dag and this.routes have been initialized.
	private inner_route_vertices(route_idx: number): number[]
	{
		let out: number[] = [this.dag.get_edge(this.routes[route_idx].edges[0]).unwrap().start];
		for(let edge_idx of this.routes[route_idx].edges)
			out.push(this.dag.get_edge(edge_idx).unwrap().end);
		return out;
	}

	//Normal methods
	/*
	These mostly access data computed in the constructor, with names
	of function arguments that are a tad more suggestive than just
	blindly indexing into a list.
	*/

	clique_leq(clq_idx_1: number, clq_idx_2: number): boolean
	{
		return this.clique_leq_matrix[clq_idx_1][clq_idx_2];
	}

	shared_subroutes(route_idx_1: number, route_idx_2: number): SharedSubroute[]
	{
		return this.shared_subroutes_arr[route_idx_1][route_idx_2]
	}

	routes_at(edge_num: number, clique_num: number): number[]
	{
		let out: number[] = [];

		let clique = this.cliques[clique_num];
		for(let i = 0; i < clique.routes.length; i++)
		{
			let r = clique.routes[i];
			let route = this.routes[r];
			if(route.edges.includes(edge_num))
				out.push(r);
		}

		return out;
	}

	mutate_by_route_idx(clique_idx: number, route_idx: number): number
	{
		let clq = this.cliques[clique_idx];
		for(let i = 0; i < clq.routes.length; i++)
		{
			if (clq.routes[i] == route_idx)
			{
				return this.mutations[clique_idx][i];
			}
		}
		console.warn("Just tried to swap route not present in given clique.");
		return clique_idx;
	}

	mutate_by_idx_in_clq(clique_idx: number, idx_in_clique: number): number
	{
		return this.mutations[clique_idx][idx_in_clique];
	}

	to_json_ob(): JSONDAGCliques
	{
		let routes: number[][] = [];
		let cliques: number[][] = [];
		for(let r of this.routes)
		{
			routes.push(structuredClone(r.edges))
		}
		for(let c of this.cliques)
		{
			cliques.push(structuredClone(c.routes))
		}
		return {
			dag: this.dag.to_json_ob(),
			routes,
			cliques,
			clique_size: this.clique_size,

			exceptional_routes: structuredClone(this.exceptional_routes),
			mutations: structuredClone(this.mutations),
			clique_leq_matrix: structuredClone(this.clique_leq_matrix),
			shared_subroutes_arr: structuredClone(this.shared_subroutes_arr),
			hasse: this.hasse.to_json_ob()
		}
	}

	static from_json_ob(ob: JSONDAGCliques): Result<DAGCliques>
	{
		let fd = FramedDAG.from_json_ob(ob.dag);
		let hd = HasseDiagram.from_json_ob(ob.hasse);
		let ssr = verify_ssr(ob.shared_subroutes_arr);
		if(fd.is_err())
			return fd.err_to_err();
		if(hd.is_err())
			return hd.err_to_err();
		if(ssr.is_err())
			return ssr.err_to_err();

		if(!is_list_of_lists(ob.routes, "number"))
			return Result.err("InvalidField", `DAGCliques field 'routes' is not an array of arrays of numbers.`);
		if(!is_list_of_lists(ob.cliques, "number"))
			return Result.err("InvalidField", `DAGCliques field 'cliques' is not an array of arrays of numbers.`);
		if(typeof ob.clique_size != "number")
			return Result.err("InvalidField", `DAGCliques field 'clique_size' is not a number.`);
		if(!is_list_of_numbers(ob.exceptional_routes))
			return Result.err("InvalidField", `DAGCliques field 'exceptional_routes' is not an array of numbers.`);
		if(!is_list_of_lists(ob.mutations, "number"))
			return Result.err("InvalidField", `DAGCliques field 'mutations' is not an array of arrays of numbers.`);
		if(!is_list_of_lists(ob.clique_leq_matrix, "boolean"))
			return Result.err("InvalidField", `DAGCliques field 'route_swaps' is not an array of arrays of booleans.`);		

		let just_fields = {
			dag: fd.unwrap(),
			routes: ob.routes.map(x => new Route(x)),
			cliques: ob.cliques.map(x => new Clique(x)),
			clique_size: ob.clique_size,

			exceptional_routes: structuredClone(ob.exceptional_routes),
			mutations: structuredClone(ob.mutations),
			clique_leq_matrix: structuredClone(ob.clique_leq_matrix),
			shared_subroutes_arr: ssr.unwrap(),
			hasse: hd.unwrap()
		}

		//This is a bit of a janky hack to get the DAGCliques object to have its methods;
		//Create an object with a small, basically empty DAG, and then just copy in the 
		//actual values.
		let base = new DAGCliques(empty_fd());
		for(let field in just_fields)
		{
			// @ts-ignore
			base[field] = just_fields[field];
		}

		return Result.ok(base);
	}
}
export type JSONDAGCliques = {
	dag: JSONFramedDag,
	routes: number[][],
	cliques: number[][],
	clique_size: number,

	exceptional_routes: number[],
	mutations: number[][],
	clique_leq_matrix: boolean[][],
	shared_subroutes_arr: SharedSubrouteCollection[][],
	hasse: JSONHasseDiagram;
};

function empty_fd(): FramedDAG
{
	let dag = new FramedDAG(2);
	dag.add_edge(0,1);
	return dag;
}

function is_list_of_lists(x: any, type: string): boolean
{
	if(typeof x.length != "number")
		return false;
	let y = (x as any[]);
	for(let i of y)
	{
		if(typeof i.length != "number")
			return false;
		let z = (i as any[])
		for(let j of z)
			if(typeof j != type)
				return false;
	}
	return true;
}

function is_list_of_numbers(x: any): boolean
{
	if(typeof x.length != "number")
		return false;
	for(let y of (x as any[]))
		if(typeof y != "number")
			return false;
	return true;
}

/*
This verifies x is a SharedSubrouteCollection[][]. The reason this returns a Result,
rather than just returning true or false, is that the Option<[number,number]>s in 
the SharedSubroute struct need to be actually converted into Options, since JSON 
objects don't remember their methods.
*/
function verify_ssr(x: any): Result<SharedSubrouteCollection[][]>
{
	let out: SharedSubrouteCollection[][] = [];

	if(!x.length)
		return Result.err("MissingField", "SharedSubroutes not array.");
	let y = x as any[];
	for(let y of x)
	{
		if(!y.length)
			return Result.err("MissingField", "SharedSubroutes not array of arrays.");
		let z = y as any[];
		out.push([])
		for(let w of z)
		{
			if(!w.length)
				return Result.err("MissingField", "SharedSubroutes not array of arrays of arrays.");
			let s = w as any[];
			out[out.length-1].push([]);
			for(let ssr of s)
			{
				if(typeof ssr.in_vert != "number")
					return Result.err("InvalidField", "SharedSubroute.in_vert not a number.");
				if(typeof ssr.out_vert != "number")
				{
					console.log(ssr);
					return Result.err("InvalidField", "SharedSubroute.out_vert not a number.");

				}
				for(let field of ["in_edges", "out_edges"])
				{
					let data = ssr[field];
					if( typeof data.valid != "boolean" )
						return Result.err("InvalidField", `SharedSubroute.${field} not an Option.`);
					if( typeof data.value != "undefined" && !is_list_of_numbers(data.value) )
						return Result.err("InvalidField", `SharedSubroute.${field} not an Option.`);
				}
				if(!is_list_of_numbers(ssr.edges))
					return Result.err("InvalidField", "SharedSubroute.edges not a list of numbers. " + ssr.edges.toString());
				if(!([-1,0,1].includes(ssr.in_order)))
					return Result.err("InvalidField", "SharedSubroute.in_order not an orientation.");
				if(!([-1,0,1].includes(ssr.out_order)))
					return Result.err("InvalidField", "SharedSubroute.out_order not an orientation.");

				let in_edges: Option<[number, number]> = Option.none();
				let out_edges: Option<[number, number]> = Option.none();
				(in_edges as any).valid = ssr.in_edges.valid;
				(in_edges as any).value = ssr.in_edges.value;
				(out_edges as any).valid = ssr.out_edges.valid;
				(out_edges as any).value = ssr.out_edges.value;

				let true_ssr: SharedSubroute = {
					in_vert: ssr.in_vert,
					out_vert: ssr.out_vert,

					edges: ssr.edges,
					in_order: ssr.in_order,
					out_order: ssr.out_order,
					in_edges,
					out_edges
				};

				out[out.length-1][out[out.length-1].length-1].push(true_ssr);


			}
		}

	}

	return Result.ok(out);
}