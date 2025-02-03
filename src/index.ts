import { DrawOptions } from "./dag_canvas";
import { prebuilt_dag_embedding } from "./dag_layout";
import { EmbeddingEditorManager } from "./modes/embedding_editor";

const draw_options = new DrawOptions();
const layout = prebuilt_dag_embedding(2);
const pm = new EmbeddingEditorManager(layout, draw_options);
