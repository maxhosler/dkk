import { FramedDAGEmbedding } from "../draw/dag_layout";

/*
Interface for the two modes, EmbeddingEditor and CliqueViewer.

Each of these modes is mostly self-contained; the use of this interface
is only to provide the minimal 'glue' needed for the DKKProgram object
to switch between them.
*/

export type ModeName = "embedding-editor" | "clique-viewer";
export interface IMode
{
	/*
	Used to differentiate whether a thing stored in an IMode
	variable is the editor or the viewer.
	*/
	name(): ModeName; 

	/*
	Gets the current FramedDAGEmbedding, usually so that it can
	be saved to a file or transfered to the other mode during a switch.
	*/
	current_embedding(): FramedDAGEmbedding;
	
	/*
	Must be implemented to clear out any global event listeners
	instantiated by the mode. If not done, a 'zombie mode' will
	continue to exist, causing very confusing bugs.
	*/
	clear_global_events(): void;
}