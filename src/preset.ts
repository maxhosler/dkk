import { AngleOverride, FramedDAGEmbedding } from "./draw/dag_layout";
import { FramedDAG } from "./math/dag";
import { clamp } from "./util/num";
import { Option } from "./util/result";

type PresetOption = {name: string}; //This is a struct just in case I want to add additional data
export const PRESETS: PresetOption[] = [
	{name: "cube"},
	{name: "cube-twist"},
	{name: "square"},
	{name: "caracol-4"},
	{name: "caracol-5"},
	{name: "test-c-4"},
	{name: "psuedopants"},
	{name: "nu_caracol(4,[1,1])"},
	{name: "nu_caracol(4,[2,1])"},
	{name: "nu_caracol(5,[3,2,1])"},
	{name: "nu_caracol(5,[1,0,3])"},
	{name: "s_oruga(4,[1,1])"},
	{name: "s_oruga(4,[2,1])"},
	{name: "s_oruga(5,[3,2,1])"},
	{name: "s_oruga(5,[1,0,3])"},

];


function preset_dag(name: string): FramedDAG
{
    if(name == "cube")
    {
        let out = new FramedDAG(4);
        out.add_edge(0,1).unwrap();
        out.add_edge(0,1).unwrap();
        out.add_edge(1,2).unwrap();
        out.add_edge(1,2).unwrap();
        out.add_edge(2,3).unwrap();
        out.add_edge(2,3).unwrap();
        return out;
    }
    else if (name == "cube-twist")
    {
        let out = preset_dag("cube");
        if(!out.reorder_in_edges(2, [3,2]))
            throw Error("Something went wrong with test dag 2!")
        return out;
    }
    else if (name == "test-c-4")
    {
        let out = new FramedDAG(4);
        out.add_edge(0,2);
        out.add_edge(0,1);
        out.add_edge(0,1);
        out.add_edge(1,2);
        out.add_edge(2,3);
        out.add_edge(1,3);
        return out;
    }
    else if (name == "psuedopants")
    {
        let out = new FramedDAG(5);
        out.add_edge(0,1);
        out.add_edge(0,2);
        out.add_edge(1,3);
        out.add_edge(1,3);
        out.add_edge(2,3);
        out.add_edge(2,3);
        out.add_edge(3,4);
        out.add_edge(3,4);
        return out;
    }
    else if (name == "square")
    {
        let out = new FramedDAG(3);
        out.add_edge(0,1).unwrap();
        out.add_edge(0,1).unwrap();
        out.add_edge(1,2).unwrap();
        out.add_edge(1,2).unwrap();
        return out;
    }
    else if (name == "nu_caracol(4,[1,1])")
	    {
		    return nu_caracol(4,[1,1])
	    }
    else if (name == "nu_caracol(4,[2,1])")
	    {
		    return nu_caracol(4,[2,1])
	    }
    else if (name == "nu_caracol(5,[3,2,1])")
	    {
		    return nu_caracol(5,[3,2,1])
	    }
    else if (name == "nu_caracol(5,[1,0,3])")
	    {
		    return nu_caracol(5,[1,0,3])
	    }


    else if (name == "s_oruga(4,[1,1])")
	    {
		    return s_oruga(4,[1,1])
	    }
    else if (name == "s_oruga(4,[2,1])")
	    {
		    return s_oruga(4,[2,1])
	    }
    else if (name == "s_oruga(5,[3,2,1])")
	    {
		    return s_oruga(5,[3,2,1])
	    }
    else if (name == "s_oruga(5,[1,0,3])")
	    {
		    return s_oruga(5,[1,0,3])
	    }




    console.warn(`Invalid preset_dag name: ${name}, returning cube.`)
    return preset_dag("cube");
}

export function preset_dag_embedding(name: string): FramedDAGEmbedding
{
	let dag = preset_dag(name);
	let emb = new FramedDAGEmbedding(dag);

	if(name == "caracol-4")
	{
		emb = caracol_emb(4);
	}
	else if (name == "caracol-5")
	{
		emb = caracol_emb(5);
	}

	return emb;
}

export function caracol(num_verts: number): FramedDAG
{
    let dag = new FramedDAG(num_verts);
    
    for(let i = num_verts-2; i > 0; i--)
        dag.add_edge(0,i);
    for(let i = 0; i < num_verts-1; i++)
        dag.add_edge(i,i+1);
    for(let i = num_verts-2; i > 0; i--)
        dag.add_edge(i, num_verts-1);

    return dag;
}

export function caracol_emb(num_verts: number): FramedDAGEmbedding
{
    let dag = caracol(num_verts);
    let emb = new FramedDAGEmbedding(dag);

	let excess = clamp(num_verts-4, 0, 4);
	let ang_max = Math.PI/4 + excess * Math.PI/16;

	for(let i = 0; i < num_verts-2; i++)
	{
		let ang = -ang_max * ( 1 - i/(num_verts-2) );
		emb.edge_data[i].start_ang_override = AngleOverride.relative(ang);
	}

	//spine: [num_verts-2..2*num_verts-3]
	for(let i = num_verts-2; i < 2 * num_verts-3; i++)
	{
		emb.edge_data[i].start_ang_override = AngleOverride.relative(0);
		emb.edge_data[i].end_ang_override = AngleOverride.relative(0);
	}

	for(let i = 0; i < num_verts-2; i++)
	{
		let j = i + 2 * num_verts-3;
		let ang = -ang_max * ( (i+1)/(num_verts-2) );
		emb.edge_data[j].end_ang_override = AngleOverride.relative(ang);
	}

    return emb;
}

//num_verts is the number of total vertices
//extra_inc is a list of size num_verts-2 (disregards source and sink), where extra_inc[j-1] for 0\leq j\leq n-2 is the number of arrows from the source into the (internal) vertex j-1 (weighted above)
//In the future may want to edit the embedding so that the edges from each internal vertex to num_verts-1 run below the rest of the DAG
//Also: I think it may be a good idea to increase the out-spread of vertex 0 when there are more than, say, four outgoing arrows to reduce the chances of getting cluttered
export function nu_caracol(num_verts: number, num_inc: Array<number>): FramedDAG
{
	let dag = new FramedDAG(num_verts);
	for (let i = 0; i < num_verts-1; i++)
		dag.add_edge(i,i+1);
	for(let i = 1; i < num_verts-1; i++)
	{
		for (let j=0; j < num_inc[i-1]; j++)
		{
			dag.add_edge(0,i);
		}
	}
	for (let i=num_verts-2; i>0; i--)
		dag.add_edge(i,num_verts-1);
	return dag;
}


//num_verts is the number of total vertices
//extra_inc is a list of size num_verts-2 (disregards source and sink), where extra_inc[j-1] for 0\leq j\leq n-2 is the number of arrows from the source into the (internal) vertex j-1 (weighted above)
//As with nu_caracol dags: I think it may be a good idea to increase the out-spread of vertex 0 when there are more than, say, four outgoing arrows to reduce the chances of getting cluttered. Increasing in-spreads (and out-spreads for symmetry) of all internal vertices may be prudent as well.
export function s_oruga(num_verts: number, num_inc: Array<number>): FramedDAG
{
	let dag = new FramedDAG(num_verts);
	for (let i=0; i < num_verts-1; i++)
		dag.add_edge(i,i+1)
	for (let i=1; i < num_verts-1; i++)
	{
		for (let j=0; j < num_inc[i-1]; j++)
		{
			dag.add_edge(0,i);
		}
	}
	for (let i=0; i < num_verts-1; i++)
		dag.add_edge(i,i+1)
	return dag;
}

//not good
//locally antiblocking DAGs
//num_ints is the number of ``spines''
//lengths is an array of the lengths of each spine
//export function lab_path(num_ints: number, lengths: Array<number>): FramedDAGEmbedding
//{
//	dag=FramedDAGEmbedding
//	num_verts=0
//	for (let j=0; j < num_ints; j++)
//		num_verts+=lengths[j];
//
//
//
//
//	dag.add_vertex()
//	dag.add_vertex()
//	//these vertices are the source and sink. we will change their positions later.
//	//THEN ADD num_verts VERTICES ALL AT 0,0 AND WE WILL CHANGE THEIR POSITIONS LATER
//
//	x=0
//	y=0
//	numv=1
//	for (let j=num_ints-1; j >= 0; j--)
//	{
//		for (let k=lengths[j]-1; k >= 0; k--)
//		{
//			numv+=1
//			MAKE VERTEX numv POSITION (x,y)
//			//HERE WE WILL ADD ALL OUTGOING EDGES OF ALL VERTICES, AND ALL INCOMING FROM SINK
//			if (j%2==0) //if we are ``going left and up''
//			{
//				if (k == lengths[j]-1)
//				{
//					dag.add_edge(numv,SINK);
//					dag.add_edge(numv,SINK);
//					if (j==num_ints-1) 
//					{
//						//if this is the lowest internal vertex
//						//then we want to add an edge from the source
//						dag.add_edge(SOURCE,numv);
//					}
//					else
//					{
//						//dag.add_edge(numv-1,numv);
//					}
//				}
//				else if (k>0)
//				{
//					dag.add_edge(numv,numv-1)
//					dag.add_edge(numv,SINK)
//				}
//				if (k==0)
//				{
//					//separate into j=0 or j not equal to 0
//					if (j==0)
//					{
//						dag.add_edge(numv,numv-1)
//						dag.add_edge(numv,SINK)
//					}
//					else
//					{
//						dag.add_edge(numv,numv-1)
//						dag.add_edge(numv,numv+1)
//					}
//				}
//			}
//				
//		}
//	}
//
//	//now we have added all vertices
//	//now set top to be the min y value (0) and bot to be max y value
//	//and set left to be min x value and right to be max x value
//	//set avgy to be average of top and bottom
//	//set source to be (left-1,avgy) and sink to be at (right+1,avgx)
//}
