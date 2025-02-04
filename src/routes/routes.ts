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
				let below = [];
				let above = [];
				for(let e of arr)
				{
					let relation = this.compatible(e,j);
					if(relation == "incompatible")
					{
						compat = false;
						break;
					}
					if(relation == "greater")
					{
						above.push(e);
					}
					else
					{
						below.push(e);
					}
				}
				if(compat)
					out.push([...below,j,...above])
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

	compatible(route_idx_1: number, route_idx_2: number): "incompatible" | "greater" | "less"
	{
		let r1 = this.routes[route_idx_1];
		let r2 = this.routes[route_idx_2];

		let ordering = 0;
		let v1 = this.get_verts(r1);
		let v2 = this.get_verts(r2);

		for(let i = 0; i < v1.length; i++)
		{
			let vertex = v1[i];
			if(!v2.includes(vertex))
				continue;
			let j = v2.indexOf(vertex);

			let in_ordering = 0;
			let out_ordering = 0;

			if(i > 0)
			{
				let edge_in_1 = r1.edges[i-1];
				let edge_in_2 = r2.edges[j-1];
				let order = this.dag.get_in_edges(vertex).unwrap();
				let e1_idx = order.indexOf(edge_in_1);
				let e2_idx = order.indexOf(edge_in_2);

				if(e1_idx > e2_idx)
					in_ordering = 1
				if(e2_idx > e1_idx)
					in_ordering = -1
			}

			if(i < v1.length-1)
			{
				let edge_out_1 = r1.edges[i];
				let edge_out_2 = r2.edges[j];
				let order = this.dag.get_out_edges(vertex).unwrap();
				let e1_idx = order.indexOf(edge_out_1);
				let e2_idx = order.indexOf(edge_out_2);

				if(e1_idx > e2_idx)
					out_ordering = 1
				if(e2_idx > e1_idx)
					out_ordering = -1
			}
			
			if(out_ordering * in_ordering < -0.1)
				return "incompatible";
			
			if(ordering == 0)
			{
				if(in_ordering != 0) ordering = in_ordering;
				if(out_ordering != 0) ordering = out_ordering;
			}
			else
			{
				if(in_ordering * ordering < -0.1) return "incompatible";
				if(out_ordering * ordering < -0.1) return "incompatible";
			}
		}

		if(ordering == 1)
		{
			return "greater"
		}
		else
		{
			return "less"
		}
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
