import { FramedDAG } from "../dag";

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
	readonly routes: number[];
	constructor(routes: number[])
	{
		this.routes = routes;
	}
}

export type Rel = -1 | 0 | 1;
export class DAGRoutes
{
	readonly dag: FramedDAG;
	readonly routes: Route[];
	readonly cliques: Clique[];
	readonly clique_size: number;
	readonly clique_transforms: number[][]; //clique index, and route index in clique

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
					cliques.push(new Clique(arr))
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

				let disagree_at = -1;
				let disagree_count = 0;
				for(let i = 0; i < this.clique_size; i++)
					if(c1.routes[i] != c2.routes[i])
					{
						disagree_at = i;
						disagree_count += 1;
					}
				
				if(disagree_count == 1)
				{
					clique_transforms[clq1][disagree_at] = clq2;
					clique_transforms[clq2][disagree_at] = clq1;
				}
			}
		}
		
		this.clique_transforms = clique_transforms;
	}

	compatible(route_idx_1: number, route_idx_2: number): boolean
	{
		let r1 = this.routes[route_idx_1];
		let r2 = this.routes[route_idx_2];

		let shared_subroutes = this.shared_subroutes(route_idx_1, route_idx_2);
		for(let sub of shared_subroutes)
		{
			if(sub.start1 == 0) continue; //starts at beginning
			if(sub.start1 + sub.length == r1.edges.length) continue; //ends at end

			console.log(sub)

			let in_edge_1 = r1.edges[sub.start1-1];
			let in_edge_2 = r2.edges[sub.start2-1];
			let start_vert = this.dag.get_edge(in_edge_1).unwrap().end;
			let in_order = this.dag.get_in_edges(start_vert).unwrap();
			let in_sign = in_order.indexOf(in_edge_1) - in_order.indexOf(in_edge_2);

			let out_edge_1 = r1.edges[sub.start1+sub.length];
			let out_edge_2 = r2.edges[sub.start2+sub.length];
			let end_vert = this.dag.get_edge(out_edge_1).unwrap().start;
			let out_order = this.dag.get_out_edges(end_vert).unwrap();
			let out_sign = out_order.indexOf(out_edge_1) - out_order.indexOf(out_edge_2);

			if(in_sign * out_sign < -0.01) return false;
		}

		return true;
	}

	shared_subroutes(route_idx_1: number, route_idx_2: number): {start1: number, start2: number, length: number}[]
	{
		let r1 = this.routes[route_idx_1];
		let r2 = this.routes[route_idx_2];

		let shared_subsequences: {start1: number, start2: number, length: number}[] = [];
		for(let i = 0; i < r1.edges.length; i++)
		{
			let edge = r1.edges[i];
			if(!r2.edges.includes(edge))
				continue;
			let j = r2.edges.indexOf(edge);
			let start1 = i;
			let start2 = j;
			let length = 0;
			while(i < r1.edges.length && j < r2.edges.length && r1.edges[i] == r2.edges[j])
			{
				i += 1;
				j += 1;
				length += 1;
			}
			shared_subsequences.push(
				{start1:start1, start2:start2, length:length}
			)
		}
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
