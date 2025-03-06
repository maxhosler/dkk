import { FramedDAGEmbedding } from "../draw/dag_layout";

export type ModeName = "embedding-editor" | "clique-viewer";
export interface IMode
{
	name(): ModeName;
	current_embedding(): FramedDAGEmbedding;
	clear_global_events(): void;
}