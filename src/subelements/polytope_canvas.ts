import { FlowPolytope } from "../routes/polytope";
import { DrawOptions } from "./dag_canvas";

const FRAG_SHADER: string = `
precision mediump float;

varying highp vec3 v_normal;
varying highp vec3 v_pos;

const highp vec3 LIGHT_DIR = normalize(vec3(-1,1,-1));

void main() {
    vec3 color = vec3(1,1,1);
    float light_direct = 0.7 * clamp(-dot(LIGHT_DIR, v_normal), 0.0, 1.0);
    float light_ambient = 0.3;

    vec3 light = (light_direct + light_ambient) * color;

    gl_FragColor = vec4(light, 1.0);
}
`;
const VERT_SHADER: string = `
attribute vec4 vertex_pos;
attribute vec3 vertex_normal;

varying highp vec3 v_normal;
varying highp vec3 v_pos;

uniform mat4 position_matrix;
uniform mat4 view_matrix;


void main() {
    gl_Position = view_matrix * position_matrix * vertex_pos;
    v_normal = (position_matrix * vec4(vertex_normal,1)).xyz;
    v_pos = vertex_pos.xyz;
}
`;

type ProgramData =
{
    program: WebGLProgram,
    attribs: {
        vertex_pos: number,
        vertex_normal: number
    },
    uniforms: {
        view_matrix: WebGLUniformLocation,
        position_matrix: WebGLUniformLocation
    }
}

export class PolytopeCanvas
{
    readonly canvas: HTMLCanvasElement;
    readonly draw_options: DrawOptions;

    readonly ctx: WebGLRenderingContext;
    readonly program: ProgramData;

    vertex_positions: number[][] = [];

    ex_pos_buffer: WebGLBuffer;
    ex_index_buffer: WebGLBuffer;
    ex_normal_buffer: WebGLBuffer;

    num_vertices = 0;

    current_angle = 0;

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
        
        this.ex_pos_buffer = this.new_float_buffer([]);
        this.ex_index_buffer = this.new_index_buffer([]);
        this.ex_normal_buffer = this.new_float_buffer([]);

        this.program = init_shader_prog(this.ctx);

        this.resize_canvas();
        addEventListener("resize", (event) => {
            if(this)
            this.resize_canvas();
        });
        canvas.onclick =  (ev) => {
            if(this)
                this.on_click();
        };
    }

    on_click()
    {
        this.current_angle += Math.PI / 20;
        this.draw();
    }

    resize_canvas()
	{
		let pheight = (this.canvas.parentElement?.clientHeight || 2);
		let pwidth  = (this.canvas.parentElement?.clientWidth || 2);

		this.canvas.style.height = pheight.toString() + "px";
		this.canvas.style.width = pwidth.toString() + "px";

		this.canvas.height = pheight - 2; //-2 to account for border
		this.canvas.width = pwidth - 2;

        this.ctx.viewport(0, 0, this.canvas.width, this.canvas.height);
	}

    set_polytope(poly: FlowPolytope)
    {
        if(poly.dim != 3) return; //TODO: Handle
        
        this.vertex_positions = [];
        for(let pos of poly.vertices)
        {
            this.vertex_positions.push(structuredClone(pos.coordinates));
        }
        
        let ex_indices: number[] = [];
        let ex_normals: number[] = [];
        let ex_positions: number[] = [];
        for(let external_tri of poly.external_simplices)
        {
            //Somewhat
            for(let i = 0; i < 3; i++){
                ex_indices.push(ex_indices.length);
            }

            //COMPUTE NORMALS
            let root = poly.vertices[external_tri[0]];
            let arm1 = poly.vertices[external_tri[1]].sub(root);
            let arm2 = poly.vertices[external_tri[2]].sub(root);

            let normal = cross_product(
                arm1.coordinates as [number,number,number],
                arm2.coordinates as [number,number,number]
            );

            let dot = 0;
            for(let i = 0; i < 3; i++)
                dot += normal[i] * root.coordinates[i];
            if(dot > 0)
            {
                for(let i = 0; i < 3; i++)
                    normal[i] *= -1;
            }
            for(let i = 0; i < 3; i++) {
                ex_positions = [...ex_positions, ...this.vertex_positions[external_tri[i]]];
                ex_normals = [...ex_normals, ...normal];
            }
                
        }

        this.ex_pos_buffer = this.new_float_buffer(ex_positions)
        this.ex_index_buffer = this.new_index_buffer(ex_indices);
        this.ex_normal_buffer = this.new_float_buffer(ex_normals);
        this.num_vertices = ex_indices.length;

    }

    new_float_buffer(arr: number[]): WebGLBuffer
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
        this.bind_normal_buffer();

        this.ctx.bindBuffer(this.ctx.ELEMENT_ARRAY_BUFFER, this.ex_index_buffer);


        {
            const triangle_count = this.num_vertices;
            const type = this.ctx.UNSIGNED_SHORT;
            const offset = 0;
            this.ctx.drawElements(this.ctx.TRIANGLES, triangle_count, type, offset);
        }
    }

    bind_pos_buffer()
    {
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, this.ex_pos_buffer);
        this.ctx.vertexAttribPointer(
            this.program.attribs.vertex_pos,
            3,
            this.ctx.FLOAT,
            false,
            0, 0
        );
        this.ctx.enableVertexAttribArray(this.program.attribs.vertex_pos);
    }

    bind_normal_buffer()
    {
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, this.ex_normal_buffer);
        this.ctx.vertexAttribPointer(
            this.program.attribs.vertex_normal,
            3,
            this.ctx.FLOAT,
            false,
            0,0
        );
        this.ctx.enableVertexAttribArray(this.program.attribs.vertex_normal);
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
        this.ctx.uniformMatrix4fv(
            this.program.uniforms.position_matrix,
            false,
            [
                Math.cos(this.current_angle),0,-Math.sin(this.current_angle),0,
                0,1,0,0,
                Math.sin(this.current_angle),0,Math.cos(this.current_angle),0,
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
            vertex_normal: ctx.getAttribLocation(shader_program, "vertex_normal")
        },
        uniforms: {
            view_matrix: ctx.getUniformLocation(shader_program, "view_matrix") as WebGLUniformLocation,
            position_matrix:  ctx.getUniformLocation(shader_program, "position_matrix") as WebGLUniformLocation,
        }
    };
}

function cross_product(a: [number,number,number], b: [number, number, number]): [number,number,number]
{
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}