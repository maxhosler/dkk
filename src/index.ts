import { prebuilt_dag_embedding } from "./dag_layout";
import { EmbeddingEditorManager } from "./embedding_editor";

const layout = prebuilt_dag_embedding(2);
const pm = new EmbeddingEditorManager(layout);
