import { FramedDAG, JSONFramedDag } from "./dag";
import { Option, Result } from "../util/result";
import { BrickHasseDiagram, HasseDiagram, JSONBrickHasseDiagram, JSONHasseDiagram } from "./hasse";
import { z, ZodType } from "zod";
import { zod_err_to_string } from "../util/zod";

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


//The Brick type is similar to SharedSubroute
//but differs in that in_edges and out_edges are always sorted lower below upper
//so we don't need to keep track of in_order and out_order
export type Brick =
{
	//indices of the start and end vertices in the FramedDAG
	in_vert: number,
	out_vert: number,

	edges: number[],

	//the order of the lower edge of the left corner in inc(in_vert)
	in_edge_order: number,
	//the order of the lower edge of the right corner in outg(out_vert)
	out_edge_order: number,

	//the indices of the edges of the left corner, ordered by inc(in_vert)
	in_edges: [number,number],
	//the indices of the edges of the right corner, ordered by inc(in_vert)
	out_edges: [number,number]
};

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

	readonly bricks: Brick[];

	//downbricks[j] is a list with clique_size elements
	//downbricks[j][i] is the downbrick of route i of clique j (if exists) and -1 otherwise
	readonly downbricks: number[][];
	readonly upbricks: number[][];

	//brick_leq_matrix[i][j] is true if brick j is leq brick i, and false otherwise
	readonly brick_leq_matrix: boolean[][];
	readonly brick_hasse: BrickHasseDiagram;

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

		//JRB
		//Let's enumerate the bricks!
		//ISSUE / TODO: We need to EXCLUDE a brick if there is only one edge outgoing from out_vert or only one edge incoming from in_vert!
		//ISSUE / TODO: It might be better to make in_edge be the actual label of the edge in the dag, and have a separate value in_order which is what we use in_edge for now. This would be useful I think?
		let bricks: Brick[] = [];
		let incomplete_bricks: number[][] = [];
		//incomplete_bricks is a list of ``partial bricks.''
		//Each ``incomplete brick'' aspires to be a list of numbers. The 0th entry is the leftmost (inner) vertex, the 1st is the lower incoming arrow on the left corner, the 2nd and on until the (length-2)rd are just the indices of the outgoing edges of the internal subpath, then we have the lower outgoing arrow of the right corner.
		//To start enumerating the partial bricks, we iterate over the inner vertices.
		for (let j = 0; j < dag.num_verts(); j++)
		{
			//Bricks can't start at the source/sink, so make sure we aren't the source/sink
			if (j != source && j != sink) 
			{
				//iterate c over all possible LOWER edges of our corner (can't be highest)
				for (let c = 0; c < dag.get_in_edges(j).unwrap_or([]).length-1; c++)
				{
					let arar: number[] = [j,c];
					incomplete_bricks.push(arar);
				}
			}
		}
		//Now incomplete_bricks consists of all possible starting vertices and their left corners
		//Each loop of the following we will take the ``incomplete brick with left corner'' and add all possible right corner versions of it to our bricks list
		//and then it will add all possible edges to the list of incomplete_bricks
		while (incomplete_bricks.length != 0)
		{
			let new_bricks: number[][] = [];
			for (let brk of incomplete_bricks)
			{
				//Calculate where the brick would end
				let finalvertex: number;
				if (brk.length==2)
				{
					finalvertex=brk[0];
				}
				else
				{
					finalvertex=dag.get_edge(brk[brk.length-1]).unwrap().end;
				}
				//if the incomplete brick ends at the sink, we will skip over this one
				if (finalvertex != sink)
				{
					let final_out = dag.get_out_edges(finalvertex).unwrap_or([]);

					//go through all possible right corners and add to bricks
					for (let j=0; j < final_out.length-1; j++)
					{
						let newbrick: Brick = {
							in_vert: brk[0],
							out_vert: finalvertex,
							edges: brk.slice(2), //just the internal path without the 0th entry being the starting vertex
							in_edge_order: brk[1],
							out_edge_order: j,
							in_edges: [dag.get_in_edges(brk[0]).unwrap_or([0])[brk[1]],
							dag.get_in_edges(brk[0]).unwrap_or([0])[brk[1]+1]],
							out_edges: [final_out[j], final_out[j+1]]

						}
						bricks.push(newbrick);
					}
					//add to incomplete_bricks all ways of continuing on with another arrow
					for(let next_edge of final_out)
					{
						new_bricks.push([...brk, next_edge]);
					}
				}
			}
			incomplete_bricks=new_bricks;
		}
		this.bricks = bricks;
		//ENDJRB

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
		let mutations: number[][] = [];
		for(let i = 0; i < this.cliques.length; i++)
		{
			mutations.push([]);
			for(let j = 0; j < this.clique_size; j++)
				mutations[i].push(i);
		}

		//Look for their shared subroutes and find the sign
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
				
				mutations[clq1][i_r1] = clq2;
				mutations[clq2][i_r2] = clq1;
			}

		}
		this.mutations = mutations;

		/*******************
		 * BRICKS          *
		********************/
		let downbricks: number[][] = []; 
		let upbricks: number[][] = [];
		for(let i = 0; i < this.cliques.length; i++)
		{
			downbricks.push([]); 
			upbricks.push([]); 

			for(let j = 0; j < this.clique_size; j++)
			{
				downbricks[i].push(-1); 
				upbricks[i].push(-1); 
			}
		}

		for(let clq1 = 0; clq1 < this.cliques.length; clq1++)
		{
			for(let clq2 = clq1+1; clq2 < this.cliques.length; clq2++)
			{
				let c1 = this.cliques[clq1];
				let c2 = this.cliques[clq2];

				let intersection =  c1.routes.filter(value => c2.routes.includes(value));
				if(intersection.length != c1.routes.length-1) continue;
				
				let root1 = -1;
				let root2 = -1;
				let i_r1 = -1;
				let i_r2 = -1;
				for(let r1 of c1.routes)
					if(!c2.routes.includes(r1))
					{
						i_r1 = c1.routes.indexOf(r1);
						root1=r1;
					}
				for(let r2 of c2.routes)
					if(!c1.routes.includes(r2))
					{
						i_r2 = c2.routes.indexOf(r2);
						root2=r2;
					}				

				//Compute bricks
				//We have root1 in clique1 and root2 in clique2
				
				let shared_subr = this.inner_shared_subroutes(root1, root2);
				for(let sub of shared_subr)
				{
					let in_idx: number;
					let out_idx: number;

					let brick_list1: number[][];
					let brick_list2: number[][];

					if (sub.in_order==-1 && sub.out_order==1)
					{
						in_idx = 0;
						out_idx = 1;
						brick_list1 = downbricks;
						brick_list2 = upbricks;
					}
					else if (sub.in_order==1 && sub.out_order==-1)
					{
						in_idx = 1;
						out_idx = 0;
						brick_list1 = upbricks;
						brick_list2 = downbricks;
					}
					else
					{
						continue;
					}

					for (let j=0; j < this.bricks.length; j++)
					{
						let brk = this.bricks[j]
						if (
							brk.edges[0]==sub.edges[0] &&
							brk.edges[1]==sub.edges[1] &&
							brk.in_edges[0]==sub.in_edges.unwrap_or([-1,-1])[in_idx] &&
							brk.out_edges[0]==sub.out_edges.unwrap_or([-1,-1])[out_idx]
						)
						{
							brick_list1[clq1][i_r1]=j;
							brick_list2[clq2][i_r2]=j;
						}
					}
				}
			}
		}
		this.downbricks=downbricks;
		this.upbricks=upbricks;
		
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

		//Compute the poset relation on bricks
		//Rather than do this directly, I will cheat by using the poset relation on cliques
		//Strategy: Given brk1 and brk2, find the cliques clk1 and clk2 whose downbricks are brk1 and brk2 and return clique_leq_array[clk1][clk2]
		let brick_leq_matrix: boolean[][] = [];
		for (let brk1 = 0; brk1 < this.bricks.length; brk1++)
		{
			brick_leq_matrix.push([]);
			for (let brk2 = 0; brk2 < this.bricks.length; brk2++)
			{
				let clq1=this.clique_from_bricks([brk1]);
				let clq2=this.clique_from_bricks([brk2]);
				brick_leq_matrix[brk1].push(this.clique_leq_matrix[clq1][clq2]);
			}
		}
		this.brick_leq_matrix = brick_leq_matrix;
		this.brick_hasse = BrickHasseDiagram.from_poset(brick_leq_matrix);
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
	
	brick_leq(clq_idx_1: number, clq_idx_2: number): boolean
	{
		return this.brick_leq_matrix[clq_idx_1][clq_idx_2];
	}

	//takes in a list of bricks
	//if these bricks are pairwise compatible, returns the index of the clique with those downbricks
	//if not, returns -1
	//subtleties: ignores duplicate elements, and ignores presence of -1
	clique_from_bricks(brick_indices: number[]): number
	{
		for (let ind=0; ind < this.cliques.length; ind++)
		{
			//downbrick_real is the set of actual downbricks of clique ind
			let downbricks_real = this.downbricks[ind];
			let set1 = new Set(downbricks_real);
			let set2 = new Set(brick_indices.concat([-1]));
			if (downbricks_real.every(item => set2.has(item)) &&
			        brick_indices.every(item => set1.has(item)))
			{
				return ind;
			}
		}
		return -1;
	}

	bricks_compatible(brk_idx_1: number, brk_idx_2: number): boolean
	{
		return this.clique_from_bricks([brk_idx_1,brk_idx_2])!=-1
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

	static json_schema(): ZodType<JSONDAGCliques>
	{
		return z.object({
			dag: FramedDAG.json_schema(),
			routes: z.number().array().array(),
			cliques: z.number().array().array(),
			clique_size: z.number(),

			exceptional_routes: z.number().array(),
			mutations: z.number().array().array(),
			clique_leq_matrix: z.boolean().array().array(),

			shared_subroutes_arr: shared_subroute_schema().array().array().array(),
			hasse: HasseDiagram.json_schema(),
			
			bricks: brick_schema().array(),
			downbricks: z.number().array().array(),
			upbricks: z.number().array().array(),

			brick_leq_matrix: z.boolean().array().array(),
			brick_hasse: BrickHasseDiagram.json_schema()
		})
	}
	to_json_object(): JSONDAGCliques
	{
		let dag = this.dag.to_json_object();
		let routes = this.routes.map(
			(route) => structuredClone(route.edges)
		);
		let cliques = this.cliques.map(
			(route) => structuredClone(route.routes)
		);
		let clique_size = this.clique_size;
		let exceptional_routes = structuredClone(this.exceptional_routes);
		let mutations = structuredClone(this.mutations);
		let clique_leq_matrix = structuredClone(this.clique_leq_matrix);

		let shared_subroutes_arr = this.shared_subroutes_arr.map(
			(r1) => r1.map(
				(r2) => r2.map(
					(subroute) => {
						let in_edges = undefined;
						let out_edges = undefined;
						if(subroute.in_edges.is_some())
							in_edges = subroute.in_edges.unwrap();
						if(subroute.out_edges.is_some())
							out_edges = subroute.out_edges.unwrap();
						let x: JSONSharedSubroute = {
							in_vert: subroute.in_vert,
							out_vert: subroute.out_vert,
							in_edges,
							out_edges,
							edges: structuredClone(subroute.edges),
							in_order: subroute.in_order,
							out_order: subroute.out_order
						}
						return x;
					}
				)
			)
		);

		let hasse = this.hasse.to_json_object();

		let bricks = structuredClone(this.bricks);
		let downbricks = structuredClone(this.downbricks)
		let upbricks = structuredClone(this.upbricks);

		let brick_leq_matrix = structuredClone(this.brick_leq_matrix);
		let brick_hasse = this.brick_hasse.to_json_object();

		return {
			dag, routes, cliques, clique_size, exceptional_routes,
			mutations, clique_leq_matrix, shared_subroutes_arr,
			hasse,
			bricks, downbricks, upbricks, brick_leq_matrix, brick_hasse
		}
	}

	static parse_json(raw_ob: Object): Result<DAGCliques>
	{
		let res = DAGCliques.json_schema().safeParse(raw_ob);
        if(!res.success)
            return Result.err("MalformedData", zod_err_to_string(res.error))

		let data = res.data;
		let tiny_dag = new FramedDAG(2);
		tiny_dag.add_edge(0,1);
		let out = new DAGCliques(tiny_dag) as any;

		for(let f in data)
		{
			if(f == "dag")
			{
				out.dag = FramedDAG.parse_json(data.dag).unwrap()
			}
			else if(f == "hasse")
			{
				out.hasse = HasseDiagram.parse_json(data.hasse).unwrap()
			}
			else if(f == "brick_hasse")
			{
				out.brick_hasse = BrickHasseDiagram.parse_json(data.brick_hasse).unwrap()
			}
			else if(f == "routes")
			{
				out.routes = [];
				for(let r of data.routes)
				{
					out.routes.push(new Route(r))
				}
			}
			else if(f == "cliques")
			{
				out.cliques = [];
				for(let r of data.cliques)
				{
					out.cliques.push(new Clique(r))
				}
			}
			else
			{
				out[f] = (data as any)[f]
			}
		}

		return Result.ok(out as DAGCliques)
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
	shared_subroutes_arr: JSONSharedSubroute[][][],
	hasse: JSONHasseDiagram,

	bricks: Brick[],
	downbricks: number[][];
	upbricks: number[][];

	brick_leq_matrix: boolean[][];
	brick_hasse: JSONBrickHasseDiagram;
};
export type JSONSharedSubroute = {
	in_vert: number,
	out_vert: number,

	in_edges?: [number, number],
	out_edges?: [number, number],

	edges: number[],

	in_order: 1 | 0 | -1,
	out_order: 1 | 0 | -1
}
function shared_subroute_schema(): ZodType<JSONSharedSubroute>
{
	return z.object({
		in_vert: z.number(),
		out_vert: z.number(),

		in_edges: z.tuple([z.number(), z.number()]).or(z.undefined()),
		out_edges: z.tuple([z.number(), z.number()]).or(z.undefined()),

		edges: z.number().array(),

		in_order: z.literal(1).or(z.literal(0)).or(z.literal(-1)),
		out_order: z.literal(1).or(z.literal(0)).or(z.literal(-1))
	})
}
function brick_schema(): ZodType<Brick>
{
	return z.object({
		in_vert: z.number(),
		out_vert: z.number(),
		edges: z.number().array(),
		in_edge_order: z.number(),
		out_edge_order: z.number(),
		in_edges: z.tuple([z.number(), z.number()]),
		out_edges: z.tuple([z.number(), z.number()])
	})
}