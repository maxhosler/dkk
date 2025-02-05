import { DrawOptions } from "./subelements/dag_canvas";
import { prebuilt_dag_embedding } from "./dag_layout";
import { CliqueViewer } from "./modes/clique_viewer";
import { EmbeddingEditor } from "./modes/embedding_editor";
import { DAGCliques } from "./routes/routes";

const draw_options = new DrawOptions();
const layout = prebuilt_dag_embedding(2);
const pm = CliqueViewer.destructive_new(layout, draw_options);