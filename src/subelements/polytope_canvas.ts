import { FlowPolytope } from "../routes/polytope";
import { DrawOptions } from "./dag_canvas";

const FRAG_SHADER: string = `
void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;
const VERT_SHADER: string = `
    attribute vec4 vertex_pos;
    uniform mat4 view_matrix;
    uniform mat4 proj_matrix;
    void main() {
      gl_Position = proj_matrix * view_matrix * vertex_pos;
    }
`;


export class PolytopeCanvas
{
    readonly canvas: HTMLCanvasElement;
    readonly draw_options: DrawOptions;

    readonly ctx: WebGLRenderingContext;
    readonly program: WebGLProgram;

    position_buffer: WebGLBuffer;

    static create(draw_options: DrawOptions): { canvas: PolytopeCanvas, element: HTMLCanvasElement }
    {
        let draw_zone = document.createElement("canvas")
        draw_zone.id = "poly-draw-zone";
        let canvas = new PolytopeCanvas(draw_zone, draw_options);
        return {
            canvas: canvas,
            element: draw_zone
        }
    }

    private constructor(canvas: HTMLCanvasElement, draw_options: DrawOptions)
    {
        this.canvas = canvas;
        this.draw_options = draw_options;

        this.ctx = this.canvas.getContext("webgl") as WebGLRenderingContext; //TODO: Handle fail.
        this.program = init_shader_prog(this.ctx);
        
        this.position_buffer = this.ctx.createBuffer();
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, this.position_buffer);
        this.ctx.bufferData(this.ctx.ARRAY_BUFFER, new Float32Array([]), this.ctx.STATIC_DRAW);

        this.resize_canvas();
        addEventListener("resize", (event) => {
            if(this)
            this.resize_canvas();
        });
    }

    resize_canvas()
	{
		let pheight = (this.canvas.parentElement?.clientHeight || 2);
		let pwidth  = (this.canvas.parentElement?.clientWidth || 2);

		this.canvas.style.height = pheight.toString() + "px";
		this.canvas.style.width = pwidth.toString() + "px";

		this.canvas.height = pheight - 2; //-2 to account for border
		this.canvas.width = pwidth - 2;
	}

    comp_polytope(poly: FlowPolytope)
    {
        if(poly.dim != 3) throw new Error("") //TODO: Handle
        let positions: number[] = [];
        for(let pos of poly.vertices)
        {
            positions = [...positions, ...pos.coordinates];
        }

        this.position_buffer = this.ctx.createBuffer();
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, this.position_buffer);
        this.ctx.bufferData(this.ctx.ARRAY_BUFFER, new Float32Array(positions), this.ctx.STATIC_DRAW);
    }

    draw()
    {
        
    }
}


function load_shader(ctx: WebGLRenderingContext, type: GLenum, src: string): WebGLShader
{
    const shader = ctx.createShader(type) as WebGLShader;
    ctx.shaderSource(shader, src);
    ctx.compileShader(shader);

    
    /*
    if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
        alert(
            `An error occurred compiling the shaders: ${ctx.getShaderInfoLog(shader)}`,
        );
        ctx.deleteShader(shader);
        return;
    }
    */

    return shader;
}

function init_shader_prog(ctx: WebGLRenderingContext): WebGLProgram
{
    const vert_shader = load_shader(ctx, ctx.VERTEX_SHADER, VERT_SHADER);
    const frag_shader = load_shader(ctx, ctx.FRAGMENT_SHADER, FRAG_SHADER);
    
    // Create the shader program
    
    const shader_program = ctx.createProgram();
    ctx.attachShader(shader_program, vert_shader);
    ctx.attachShader(shader_program, frag_shader);
    ctx.linkProgram(shader_program);
    
    /*
    if (!ctx.getProgramParameter(shader_program, ctx.LINK_STATUS)) {
        alert(
        `Unable to initialize the shader program: ${ctx.getProgramInfoLog(
            shader_program,
        )}`,
        );
    }
    */
    
    return shader_program;
}