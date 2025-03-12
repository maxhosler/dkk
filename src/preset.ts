import { AngleOverride, FramedDAGEmbedding } from "./draw/dag_layout";
import { FramedDAG, JSONFramedDag } from "./math/dag";
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
    {name: "exceptional1"}
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
    else if (name == "exceptional1")
    {
        return exceptional1();
    }
    console.warn(`Invalid preset_dag name: ${name}, returning cube.`)
    return preset_dag("cube");
}

export function preset_dag_embedding(name: string): FramedDAGEmbedding
{
	let emb;

	if(name == "caracol-4")
	{
		emb = caracol_emb(4);
	}
	else if (name == "caracol-5")
	{
		emb = caracol_emb(5);
	}
    else
    {
        let dag = preset_dag(name);
        emb = new FramedDAGEmbedding(dag);
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

function exceptional1(): FramedDAG
{
    let ob: JSONFramedDag = {
        num_verts: 6,
        out_edges: [
            [4, 11, 5 ],
            [3, 10, 12],
            [9, 0, 7, 2],
            [6],
            [1, 8],
            []
        ],
        in_edges: [
            [],
            [11],
            [12, 10],
            [5, 2, 9, 7],
            [4, 0, 6],
            [1, 8, 3]
        ]
    }
    let dag = FramedDAG.from_json_ob(ob).unwrap();
    return dag;
}