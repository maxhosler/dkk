import { FlowPolytope } from "../routes/polytope";
import { DrawOptions } from "./dag_canvas";
import { EXTERNAL_FRAG_SHADER, VERT_SHADER } from "./shaders";



type ProgramData =
{
    program: WebGLProgram,
    attribs: {
        vertex_pos: number,
        vertex_normal: number,
        simplex_pos: number
    },
    uniforms: {
        view_matrix: WebGLUniformLocation,
        position_matrix: WebGLUniformLocation,
        cull_dir: WebGLUniformLocation,
        color: WebGLUniformLocation,
        transparency: WebGLUniformLocation,
        simplex_colors: WebGLUniformLocation
    }
}

class FaceBuffers
{
    num_verts: number;

    pos_buffer: WebGLBuffer;
    index_buffer: WebGLBuffer;
    normal_buffer: WebGLBuffer;
    simplex_pos_buffer: WebGLBuffer;

    constructor(
        pos_buffer: WebGLBuffer,
        normal_buffer: WebGLBuffer,
        simplex_pos_buffer: WebGLBuffer,

        index_buffer: WebGLBuffer,

        num_verts: number,
    )
    {
        this.pos_buffer = pos_buffer;
        this.index_buffer = index_buffer;
        this.normal_buffer = normal_buffer;
        this.simplex_pos_buffer = simplex_pos_buffer;
        this.num_verts = num_verts;
    }
}

export class PolytopeCanvas
{
    readonly canvas: HTMLCanvasElement;
    readonly draw_options: DrawOptions;

    readonly ctx: WebGLRenderingContext;
    readonly program: ProgramData;

    num_vertices = 0;
    vertex_positions: number[][] = [];

    external_buffers: FaceBuffers;

    simpl_buffers: FaceBuffers;

    pos_transform: Mat4 = Mat4.id();

    drag: boolean = false;

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
        
        this.external_buffers = new FaceBuffers(
            this.new_float_buffer([]),
            this.new_float_buffer([]),
            this.new_float_buffer([]),
            this.new_index_buffer([]),
            0
        );
        
        this.simpl_buffers = new FaceBuffers(
            this.new_float_buffer([]),
            this.new_float_buffer([]),
            this.new_float_buffer([]),
            this.new_index_buffer([]),
            0
        );

        this.program = init_shader_prog(this.ctx);

        this.resize_canvas();
        addEventListener("resize", (event) => {
            if(this)
            this.resize_canvas();
        });

        addEventListener("mouseup", (ev) => this.drag = false);
        canvas.addEventListener("mousedown", (ev) => this.drag = true);
        addEventListener("mousemove", (ev) => {
            if(this && this.drag)
                this.drag_rotate([ev.movementX, -ev.movementY]);
        })
    }

    drag_rotate(delta: [number, number])
    {
        let [x,y] = delta;
        let d = Math.sqrt(x*x + y*y);
        if(d < 0.01) return;

        let theta = Math.min(d/50, Math.PI/15);
        let ax: [number,number,number] = [-y/d,x/d,0];
        let matrix = Mat4.rot_around(ax, theta);
        this.pos_transform = this.pos_transform.mul(matrix);
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
        let ex_sp: number[] = [];
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
                ex_sp = [...ex_sp, -1, -1, -1, -1];
            }
                
        }

        this.external_buffers = new FaceBuffers(
            this.new_float_buffer(ex_positions),
            this.new_float_buffer(ex_normals),
            this.new_float_buffer(ex_sp),

            this.new_index_buffer(ex_indices),

            ex_indices.length
        )
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

        this.bind_transform_uniforms();
        this.bind_simplex_colors();
    
        this.ctx.enable(this.ctx.BLEND);
        this.ctx.blendFunc(this.ctx.SRC_ALPHA, this.ctx.ONE_MINUS_SRC_ALPHA);

        const draw_external = (dir: number) =>
        {

            this.bind_face_buffers(this.external_buffers);

            this.ctx.uniform1f(this.program.uniforms.cull_dir, dir);
            this.ctx.uniform1f(this.program.uniforms.transparency, 0.5);

            let color = [222./256., 94/256., 212/256]; //TODO: parametrize
            if(dir == -1)
            {
                color[0] *= 0.5;
                color[1] *= 0.5;
                color[2] *= 0.5;
            }
            this.ctx.uniform3fv(this.program.uniforms.color, color);

            const triangle_count = this.num_vertices;
            const type = this.ctx.UNSIGNED_SHORT;
            const offset = 0;
            this.ctx.drawElements(this.ctx.TRIANGLES, triangle_count, type, offset);
        }

        draw_external(-1);

        //TODO: Current simplex.

        draw_external(1);
    }

    

    bind_face_buffers(face_buffers: FaceBuffers)
    {
        //Position
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, face_buffers.pos_buffer);
        this.ctx.vertexAttribPointer(
            this.program.attribs.vertex_pos,
            3,
            this.ctx.FLOAT,
            false,
            0, 0
        );
        this.ctx.enableVertexAttribArray(this.program.attribs.vertex_pos);

        //normal
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, face_buffers.normal_buffer);
        this.ctx.vertexAttribPointer(
            this.program.attribs.vertex_normal,
            3,
            this.ctx.FLOAT,
            false,
            0,0
        );
        this.ctx.enableVertexAttribArray(this.program.attribs.vertex_normal);

        //Simplex pos
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, face_buffers.simplex_pos_buffer);
        this.ctx.vertexAttribPointer(
            this.program.attribs.simplex_pos,
            4,
            this.ctx.FLOAT,
            false,
            0, 0
        );
        this.ctx.enableVertexAttribArray(this.program.attribs.simplex_pos);

        //Index
        this.ctx.bindBuffer(this.ctx.ELEMENT_ARRAY_BUFFER, face_buffers.index_buffer);

    }

    bind_transform_uniforms()
    {
        let wid = this.canvas.width;
        let hei = this.canvas.height;

        let wmod = wid/hei;
        let hmod = 1;
        if(wid > hei)
        {
            hmod = hei/wid;
            wmod = 1;
        }

        this.ctx.uniformMatrix4fv(
            this.program.uniforms.view_matrix,
            false,
            [
                hmod,0,0,0,
                0,wmod,0,0,
                0,0,1,0,
                0,0,0,1
            ]
        );
        this.ctx.uniformMatrix4fv(
            this.program.uniforms.position_matrix,
            false,
            this.pos_transform.flat_arr()
        );
    }

    bind_simplex_colors()
    {
        let mat = [
            0,0,0,0,
            0,0,0,0,
            0,0,0,0,
            1,1,1,1
        ];

        for(let i = 0; i < 4; i++)
        {
            let col = this.draw_options.get_route_color(i);
            let col_arr = css_str_to_rgb(col);
            for(let j = 0; j < 3; j++)
            {
                mat[i+4*j] = col_arr[j]/255;
            }
        }

        this.ctx.uniformMatrix4fv(
            this.program.uniforms.simplex_colors,
            false,
            mat
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
    const frag_shader = load_shader(ctx, ctx.FRAGMENT_SHADER, EXTERNAL_FRAG_SHADER);
    
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
            vertex_normal: ctx.getAttribLocation(shader_program, "vertex_normal"),
            simplex_pos: ctx.getAttribLocation(shader_program, "simplex_pos")
        },
        uniforms: {
            view_matrix: ctx.getUniformLocation(shader_program, "view_matrix") as WebGLUniformLocation,
            position_matrix:  ctx.getUniformLocation(shader_program, "position_matrix") as WebGLUniformLocation,
            cull_dir: ctx.getUniformLocation(shader_program, "cull_dir") as WebGLUniformLocation,
            color: ctx.getUniformLocation(shader_program, "color") as WebGLUniformLocation,
            transparency: ctx.getUniformLocation(shader_program, "transparency") as WebGLUniformLocation,
            simplex_colors: ctx.getUniformLocation(shader_program, "simplex_colors") as WebGLUniformLocation,
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

type Row = [number,number,number,number];
class Mat4
{
    readonly inner: [Row,Row,Row,Row]; //row your boat...

    constructor( inner: [Row,Row,Row,Row])
    {
        this.inner = inner;
    }

    static id(): Mat4
    {
        return new Mat4([
            [1,0,0,0],
            [0,1,0,0],
            [0,0,1,0],
            [0,0,0,1]
        ]);
    }

    private static zero_arr(): [Row,Row,Row,Row]
    {
        return [
            [0,0,0,0],
            [0,0,0,0],
            [0,0,0,0],
            [0,0,0,0]
        ]
    }

    flat_arr(): number[]
    {
        let out: number[] = [];
        for(let row of this.inner)
            out = [...out, ...row];
        return out;
    }

    mul(other: Mat4): Mat4
    {
        let out = Mat4.zero_arr();
        for(let i = 0; i < 4; i++)
            for(let j = 0; j < 4; j++)
                for(let k=0; k<4; k++)
                    out[i][j] += this.inner[i][k] * other.inner[k][j];
        
        return new Mat4(out);
    }

    static rot_around(unit_ax: [number,number,number], theta: number)
    {
        let c = Math.cos(theta);
        let s = Math.sin(theta);
        let [ux,uy,uz] = unit_ax;
        return new Mat4([
            [c + ux*ux*(1-c), ux*uy*(1-c) - uz*s, ux*uz*(1-c)+uy*s, 0],
            [uy*ux*(1-c)+uz*s,  c + uy*uy*(1-c), uy*uz*(1-c) - ux*s,0],
            [uz*ux*(1-c)-uy*s,uz*uy*(1-c)+ux*s,c + uz*uz*(1-c),0],
            [0,0,0,1]
        ])
    }
}

function css_str_to_rgb(css_str: string): [number,number,number]
{
    let start = css_str.slice(0,1);
    if(start == "#")
    {
        let num = Number("0x"+css_str.slice(1));
        return [
            (num >> 16) & 255,
            (num >> 8) & 255,
            num & 255
        ];
    }
    else if (start = "r")
    {
        let comps = start.match(/\d+/g) as RegExpMatchArray;
        return [
            Number(comps[0]),
            Number(comps[1]),
            Number(comps[2]),
        ];
    }

    console.warn("Unknown color string format! ", css_str);
    return [255,255,255];
}