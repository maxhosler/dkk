import { FramedDAG } from "../dag";
import { Option } from "../result";
class Route
{
	readonly edges: number[];

	constructor(edges: number[])
	{
		this.edges = edges;
	}
}

class Clique
{
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
			let sort = (a: number, b: number) =>
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
			routes_on_edge.sort(sort);
			routes_per_edge.push(routes_on_edge);
		}
		let source_edges = dag_context.dag.get_out_edges(dag_context.dag.source().unwrap()).unwrap();
		let new_routes: number[] = [];
		for(let edge of source_edges)
			for(let route_idx of routes_per_edge[edge])
				new_routes.push(routes[route_idx]);

		return new Clique(new_routes, routes_per_edge);
		
	}
	readonly routes: number[];
	readonly routes_per_edge: number[][];
	constructor(routes: number[], routes_per_edge: number[][])
	{
		this.routes = routes;
		this.routes_per_edge = routes_per_edge;
	}
}

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
export class DAGCliques
{
	readonly dag: FramedDAG;
	readonly routes: Route[];
	readonly cliques: Clique[];
	readonly clique_size: number;
	readonly clique_transforms: number[][]; //clique index, and route index in clique

	private cached_subroutes: (SharedSubroute[] | undefined)[][];

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
		this.cached_subroutes = [];
		for(let i = 0; i < routes.length; i++)
		{
			this.cached_subroutes.push([])
			for(let j = 0; j < routes.length; j++)
			{
				this.cached_subroutes[i].push(undefined);
			}
		}
	
		//Compute cliques
		let extend: (arr: number[]) => number[][] = (arr: number[]) => {
			let start = Math.max.apply(null, arr)+1;
			let out: number[][] = [];

			for(let j = start; j < this.routes.length; j++)
			{
				let compat = true;

				for(let e of arr)
				{
					if(!this.compatible(e,j))
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

		let clique_transforms: number[][] = [];
		for(let i = 0; i < this.cliques.length; i++)
		{
			clique_transforms.push([]);
			for(let j = 0; j < this.clique_size; j++)
			{
				clique_transforms[i].push(i);
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
				
				clique_transforms[clq1][i_r1] = clq2;
				clique_transforms[clq2][i_r2] = clq1;

			}
		}
		
		this.clique_transforms = clique_transforms;
	}

	compatible(route_idx_1: number, route_idx_2: number): boolean
	{
		let shared_subroutes = this.shared_subroutes(route_idx_1, route_idx_2);
		for(let sub of shared_subroutes)
		{
			if(sub.in_order * sub.out_order <= -0.01) return false;
		}

		return true;
	}

	shared_subroutes(route_idx_1: number, route_idx_2: number): SharedSubroute[]
	{
		if(typeof this.cached_subroutes[route_idx_1][route_idx_2] != "undefined")
		{
			return this.cached_subroutes[route_idx_1][route_idx_2];
		}

		let r1_e = this.routes[route_idx_1].edges;
		let r2_e = this.routes[route_idx_2].edges;

		let r1_v = this.route_vertices(route_idx_1);
		let r2_v = this.route_vertices(route_idx_2);

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
				out_vert: r1_v[i-1],
				in_edges,
				out_edges,
				in_order,
				out_order,
				edges
			}

			shared_subsequences.push(shared);
		}
		this.cached_subroutes[route_idx_1][route_idx_2] = shared_subsequences;
		return shared_subsequences;
	}

	route_vertices(route_idx: number): number[]
	{
		let out: number[] = [this.dag.get_edge(this.routes[route_idx].edges[0]).unwrap().start];
		for(let edge_idx of this.routes[route_idx].edges)
			out.push(this.dag.get_edge(edge_idx).unwrap().end);
		return out;
	}

	routes_at(edge_num: number, clique_num: number): number[]
	{
		let out: number[] = [];

		let clique = this.cliques[clique_num];
		for(let r of clique.routes)
		{
			let route = this.routes[r];
			if(route.edges.includes(edge_num))
				out.push(r);
		}

		return out;
	}

	routes_at_by_clique_idx(edge_num: number, clique_num: number): number[]
	{
		let out: number[] = [];

		let clique = this.cliques[clique_num];
		for(let i = 0; i < clique.routes.length; i++)
		{
			let r = clique.routes[i];
			let route = this.routes[r];
			if(route.edges.includes(edge_num))
				out.push(i);
		}

		let sort = (a: number, b: number) =>
		{
			let r1 = clique.routes[a];
			let r2 = clique.routes[b];
			let ssr = this.shared_subroutes(r1,r2);
			for(let shared of ssr)
			{
				if(shared.edges.includes(edge_num))
				{
					if(shared.in_order == 0)
						return shared.out_order;
					return shared.in_order;
				}
			}
			for(let shared of ssr)
			{
				let in_edges = shared.in_edges.unwrap_or([-1,-1])
			}
			return 1
		} 
		out.sort(sort);

		return out;
	}

	route_swap(clique_idx: number, route_idx: number): number
	{
		return this.clique_transforms[clique_idx][route_idx];
	}

	private get_verts(route: Route): number[]
	{
		let verts: number[] = [this.dag.get_edge(route.edges[0]).unwrap().start];

		for(let e of route.edges)
		{
			verts.push(this.dag.get_edge(e).unwrap().end)
		}

		return verts;
	}
}
