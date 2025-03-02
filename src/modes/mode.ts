export type ModeName = "embedding-editor" | "clique-viewer";
export interface IMode
{
	name(): ModeName
}