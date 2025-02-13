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
    void main() {
      gl_Position = view_matrix * vertex_pos;
    }
`;

type ProgramData =
{
    program: WebGLProgram,
    attribs: {
        vertex_pos: number
    },
    uniforms: {
        view_matrix: WebGLUniformLocation 
    }
}

export class PolytopeCanvas
{
    readonly canvas: HTMLCanvasElement;
    readonly draw_options: DrawOptions;

    readonly ctx: WebGLRenderingContext;
    readonly program: ProgramData;

    position_buffer: WebGLBuffer;
    ex_tri_index_buffer: WebGLBuffer;
    num_vertices = 0;

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
        
        this.position_buffer = this.new_position_buffer([]);
        this.ex_tri_index_buffer = this.new_index_buffer([]);

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

    set_polytope(poly: FlowPolytope)
    {
        if(poly.dim != 3) return; //TODO: Handle
        
        let positions: number[] = [];
        for(let pos of poly.vertices)
        {
            positions = [...positions, ...pos.coordinates];
        }

        this.position_buffer = this.new_position_buffer(positions)
        
        let ex_indices: number[] = [];
        for(let external_tri of poly.external_simplices)
        {
            ex_indices = [...ex_indices, ...external_tri];
        }

        this.ex_tri_index_buffer = this.new_index_buffer(ex_indices);
        this.num_vertices = ex_indices.length;

    }

    new_position_buffer(arr: number[]): WebGLBuffer
    {
        let buf = this.ctx.createBuffer();
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, buf);
        this.ctx.bufferData(this.ctx.ARRAY_BUFFER, new Float32Array(arr), this.ctx.STATIC_DRAW);
        return buf;
    }

    new_index_buffer(arr: number[])
    {
        let buf = this.ctx.createBuffer();
        this.ctx.bindBuffer(this.ctx.ELEMENT_ARRAY_BUFFER, buf);
        this.ctx.bufferData(this.ctx.ELEMENT_ARRAY_BUFFER, new Uint16Array(arr), this.ctx.STATIC_DRAW);
        return buf;
    }

    draw()
    {
        this.ctx.clearColor(0,0,0,1);
        this.ctx.clearDepth(1.0);
        this.ctx.enable(this.ctx.DEPTH_TEST);
        this.ctx.depthFunc(this.ctx.LEQUAL);

        this.ctx.useProgram(this.program.program);

        this.bind_pos_buffer();
        this.bind_uniforms();

        this.ctx.bindBuffer(this.ctx.ELEMENT_ARRAY_BUFFER, this.ex_tri_index_buffer);


        {
            const triangle_count = this.num_vertices;
            const type = this.ctx.UNSIGNED_SHORT;
            const offset = 0;
            this.ctx.drawElements(this.ctx.TRIANGLES, triangle_count, type, offset);
        }
    }

    bind_pos_buffer()
    {
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, this.position_buffer);
        this.ctx.vertexAttribPointer(
            this.program.attribs.vertex_pos,
            3,
            this.ctx.FLOAT,
            false,
            0, 0
        );
        this.ctx.enableVertexAttribArray(this.program.attribs.vertex_pos);
    }

    bind_uniforms()
    {
        this.ctx.uniformMatrix4fv(
            this.program.uniforms.view_matrix,
            false,
            [
                1,0,0,0,
                0,1,0,0,
                0,0,1,0,
                0,0,0,1
            ]
        );
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

function init_shader_prog(ctx: WebGLRenderingContext): ProgramData
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
    
    return {
        program: shader_program,
        attribs: {
            vertex_pos: ctx.getAttribLocation(shader_program, "vertex_pos"),
        },
        uniforms: {
            view_matrix: ctx.getUniformLocation(shader_program, "view_matrix") as WebGLUniformLocation,
        }
    };
}