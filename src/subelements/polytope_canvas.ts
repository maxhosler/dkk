import { css_str_to_rgb } from "../draw/colors";
import { DrawOptions } from "../draw/draw_options";
import { FlowPolytope } from "../math/polytope";
import { Clique } from "../math/cliques";
import { EXTERNAL_FRAG_SHADER, VERT_SHADER } from "./shaders";

//TODO: Document

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
        simplex_colors: WebGLUniformLocation,
        do_simplex_color: WebGLUniformLocation,
        shade_amount: WebGLUniformLocation
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
    readonly root: HTMLDivElement;
    readonly canvas: HTMLCanvasElement;
    readonly draw_options: DrawOptions;

    readonly ctx: WebGLRenderingContext;
    readonly program: ProgramData;

    vertex_positions: number[][] = [];

    external_buffers: FaceBuffers;
    simpl_buffers: FaceBuffers;
    dot_buffers: FaceBuffers;

    pos_transform: Mat4 = Mat4.id();
    current_clique: Clique | null = null;

    drag: boolean = false;

    poly_dim: number = 0;

    static create(draw_options: DrawOptions): { canvas: PolytopeCanvas, element: HTMLDivElement }
    {
        let root = document.createElement("div")
        let canvas = new PolytopeCanvas(root, draw_options);
        return {
            canvas: canvas,
            element: root
        }
    }

    private constructor(root: HTMLDivElement, draw_options: DrawOptions)
    {
        this.root = root;
        this.root.className = "poly-root";
        this.draw_options = draw_options;

        this.canvas = document.createElement("canvas")
        this.root.appendChild(this.canvas);

        this.ctx = this.canvas.getContext("webgl") as WebGLRenderingContext;
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

        this.dot_buffers = new FaceBuffers(
            this.new_float_buffer([]),
            this.new_float_buffer([]),
            this.new_float_buffer([]),
            this.new_index_buffer([]),
            0
        );

        this.program = init_shader_prog(this.ctx);

        this.resize_canvas();
        this.canvas.addEventListener("resize", (event) => {
            this.resize_canvas();
        });

        this.canvas.addEventListener("mouseup", (ev) => this.drag = false);
        this.canvas.addEventListener("mouseleave", (ev) => this.drag = false);
        this.canvas.addEventListener("mousedown", (ev) => this.drag = true);
        this.canvas.addEventListener("mousemove", (ev) => {
            if(this.drag)
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
		let pheight = (this.root.parentElement?.clientHeight || 2);
		let pwidth  = (this.root.parentElement?.clientWidth || 2);

		this.root.style.height = pheight.toString() + "px";
		this.root.style.width = pwidth.toString() + "px";

		this.canvas.style.height = pheight.toString() + "px";
		this.canvas.style.width = pwidth.toString() + "px";

		this.canvas.height = pheight - 2; //-2 to account for border
		this.canvas.width = pwidth - 2;

        this.ctx.viewport(0, 0, this.canvas.width, this.canvas.height);
	}

    set_polytope(poly: FlowPolytope, current_clique: Clique)
    {
        this.poly_dim = poly.dim;
        if(!this.do_render()) {return;}


        let pad_zeroes = 3-poly.dim;
        
        this.vertex_positions = [];
        for(let pos of poly.vertices)
        {
            let pad: number[] = new Array(pad_zeroes).fill(0);
            this.vertex_positions.push(structuredClone(pos.coordinates).concat(pad));
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

            let get_ex_vert = (i: number) => {
                return structuredClone(this.vertex_positions[external_tri[i]]) as Triple;
            };

            //COMPUTE NORMALS
            let normal = get_normal(
                get_ex_vert(0),
                get_ex_vert(1),
                get_ex_vert(2),
                [0,0,0]
            )

            for(let i = 0; i < 3; i++) {
                let r = Math.floor(4*Math.random());
                let extend = [0,0,0,0];
                extend[r] = 1;

                ex_positions = [...ex_positions, ...this.vertex_positions[external_tri[i]]];
                ex_normals = [...ex_normals, ...normal];
                ex_sp = [...ex_sp, ...extend];
            }
                
        }

        this.external_buffers = new FaceBuffers(
            this.new_float_buffer(ex_positions),
            this.new_float_buffer(ex_normals),
            this.new_float_buffer(ex_sp),

            this.new_index_buffer(ex_indices),

            ex_indices.length
        );

        this.set_clique(current_clique);
        this.resize_canvas();
    }

    set_clique(current_clique: Clique)
    {
        this.current_clique = structuredClone(current_clique);

        if (!this.do_render()) { return; }

        //SIMPLICES

        let sim_indices: number[] = [];
        let sim_normals: number[] = [];
        let sim_positions: number[] = [];
        let sim_simpl_pos: number[] = [];

        let center: Triple = [0,0,0];
        for(let j = 0; j < this.poly_dim+1; j++)
        {
            
            let vert = this.vertex_positions[current_clique.routes[j]];
            for(let i = 0; i < 3; i++)
            {
                center[i] += vert[i]/(this.poly_dim+1);
            }
        }

        if(this.poly_dim == 3) {
            for(let excluded_idx = 0; excluded_idx < 4; excluded_idx++)
            {
                for(let i = 0; i < 3; i++){
                    sim_indices.push(sim_indices.length);
                }
    
                let verts: Triple[] = [];
    
                for(let j = 0; j < 4; j++)
                {
                    if(j==excluded_idx) continue;
                    let vert = this.vertex_positions[current_clique.routes[j]];
                    verts.push(vert as Triple);
    
                    let sp = [0,0,0,0];
                    sp[j] = 1;
    
                    const EPS_PLUS_ONE = 1.001;
                    sim_positions = [...sim_positions, EPS_PLUS_ONE*vert[0], EPS_PLUS_ONE*vert[1], EPS_PLUS_ONE*vert[2]];
                    sim_simpl_pos = [...sim_simpl_pos, ...sp];
                }
    
                let normal = get_normal(verts[0], verts[1], verts[2], center);
                for(let i = 0; i < 3; i++)
                    sim_normals = [...sim_normals, ...normal];
            }
        }
        else if (this.poly_dim == 2)
        {

            for(let i = 0; i < 6; i++){
                sim_indices.push(sim_indices.length);
            }

            let base_verts: Triple[] = [];

            for(let j = 0; j < 3; j++)
            {
                let vert = this.vertex_positions[current_clique.routes[j]];
                base_verts.push(vert as Triple);
            }
            const EPS_PLUS_ONE = 1.001;

            for(let orient = -1; orient < 2; orient += 2)
            {
                let transform = (v: Triple) => {
                    return [
                        v[0] * EPS_PLUS_ONE,
                        v[1] * EPS_PLUS_ONE,
                        (v[2] + 0.001 * orient) * EPS_PLUS_ONE
                    ] as Triple;
                }
                let verts: Triple[] = base_verts.map(transform);

                sim_positions = [...sim_positions, ...verts[0], ...verts[1], ...verts[2]];
                sim_simpl_pos = [...sim_simpl_pos, 1,0,0,0,0,1,0,0,0,0,1,0];
                
                let normal = get_normal(verts[0], verts[1], verts[2], center);
                for(let i = 0; i < 3; i++)
                    sim_normals = [...sim_normals, ...structuredClone(normal)];
            }

        }
        else
        {
            console.warn("set_clique reached state that should be unreachable.")
        }
        
        this.simpl_buffers = new FaceBuffers(
            this.new_float_buffer(sim_positions),
            this.new_float_buffer(sim_normals),
            this.new_float_buffer(sim_simpl_pos),

            this.new_index_buffer(sim_indices),

            sim_indices.length
        );

        //DOTS

        let dot_indices: number[] = [];
        let dot_normals: number[] = [];
        let dot_positions: number[] = [];
        let dot_simpl_pos: number[] = [];

        let sphere = gen_sphere(10, 10, this.draw_options.dot_radius() / 100);

        for(let j = 0; j < this.poly_dim+1; j++)
        {
            
            let center = this.vertex_positions[current_clique.routes[j]];

            let base = sphere.positions.length * j;
            for(let idx of sphere.idxs)
                dot_indices.push(base + idx);

            let simpl = [0,0,0,0];
            simpl[j] = 1;
            for(let pos of sphere.positions)
            {
                let offset_pos = [
                    center[0] + pos[0],
                    center[1] + pos[1],
                    center[2] + pos[2]
                ];
                dot_positions = [...dot_positions, ...offset_pos];
                dot_simpl_pos = [...dot_simpl_pos, ...simpl];
            }
            for(let norm of sphere.normals)
            {
                dot_normals = [...dot_normals, ...norm];
            }
        }

        this.dot_buffers = new FaceBuffers(
            this.new_float_buffer(dot_positions),
            this.new_float_buffer(dot_normals),
            this.new_float_buffer(dot_simpl_pos),

            this.new_index_buffer(dot_indices),

            dot_indices.length
        );
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
        this.ctx.clearDepth(1.0);
        this.ctx.clearColor(0,0,0,1);
        this.ctx.clear(this.ctx.DEPTH_BUFFER_BIT | this.ctx.COLOR_BUFFER_BIT);

        if (!this.do_render()) return;

        this.ctx.enable(this.ctx.DEPTH_TEST);
        this.ctx.depthFunc(this.ctx.LEQUAL);

        this.ctx.useProgram(this.program.program);

        this.bind_transform_uniforms();
        this.bind_simplex_colors();
    
        this.ctx.enable(this.ctx.BLEND);
        this.ctx.blendFunc(this.ctx.SRC_ALPHA, this.ctx.ONE_MINUS_SRC_ALPHA);

        const draw_dots = () => {
            if(this.draw_options.simplex_render_mode() == "dots")
            {
                if(this.draw_options.dot_on_top())
                {
                    this.ctx.clear(this.ctx.DEPTH_BUFFER_BIT);
                }
                    
    
                this.bind_face_buffers(this.dot_buffers);
    
                this.ctx.uniform1f(this.program.uniforms.cull_dir, 0);
                this.ctx.uniform1f(this.program.uniforms.transparency, 1.0);
                this.ctx.uniform1f(this.program.uniforms.do_simplex_color, 1);
                let shade_amount = 0;
                if(this.draw_options.dot_shade())
                    shade_amount = 1;
                this.ctx.uniform1f(this.program.uniforms.shade_amount, shade_amount);
    
                let color = [1, 0, 0]; //If this color shows, something is broken
                this.ctx.uniform3fv(this.program.uniforms.color, color);
    
                const triangle_count = this.dot_buffers.num_verts;
                const type = this.ctx.UNSIGNED_SHORT;
                const offset = 0;
                this.ctx.drawElements(this.ctx.TRIANGLES, triangle_count, type, offset);
            }
        }

        const draw_external = (dir: number) =>
        {

            this.bind_face_buffers(this.external_buffers);

            this.ctx.uniform1f(this.program.uniforms.cull_dir, dir);
            this.ctx.uniform1f(this.program.uniforms.transparency, 0.5);
            this.ctx.uniform1f(this.program.uniforms.do_simplex_color, -1);

            this.ctx.uniform1f(this.program.uniforms.shade_amount, 1);
            
            if (this.poly_dim == 2)
            {
                this.ctx.uniform1f(this.program.uniforms.shade_amount, 0);
            }

            let color_i = css_str_to_rgb(this.draw_options.polytope_color());
            let color = [
                color_i[0] / 255,
                color_i[1] / 255,
                color_i[2] / 255
            ];
            if(dir == -1)
            {
                color[0] *= 0.5;
                color[1] *= 0.5;
                color[2] *= 0.5;
            }
            this.ctx.uniform3fv(this.program.uniforms.color, color);

            const triangle_count = this.external_buffers.num_verts;
            const type = this.ctx.UNSIGNED_SHORT;
            const offset = 0;
            this.ctx.drawElements(this.ctx.TRIANGLES, triangle_count, type, offset);
        }

        draw_dots();

        draw_external(-1);

        {

            this.bind_face_buffers(this.simpl_buffers);

            this.ctx.uniform1f(this.program.uniforms.cull_dir, 1);
            this.ctx.uniform1f(this.program.uniforms.transparency, 1.0);
            this.ctx.uniform1f(this.program.uniforms.do_simplex_color, 1);

            let simpl_mode = this.draw_options.simplex_render_mode();
            if(simpl_mode == "blank" || simpl_mode == "dots")
                this.ctx.uniform1f(this.program.uniforms.do_simplex_color, 0);

            this.ctx.uniform1f(this.program.uniforms.shade_amount, 1);

            let color_i = css_str_to_rgb(this.draw_options.simplex_color());
            let color = [
                color_i[0] / 255,
                color_i[1] / 255,
                color_i[2] / 255
            ];
            this.ctx.uniform3fv(this.program.uniforms.color, color);

            const triangle_count = this.simpl_buffers.num_verts;
            const type = this.ctx.UNSIGNED_SHORT;
            const offset = 0;
            this.ctx.drawElements(this.ctx.TRIANGLES, triangle_count, type, offset);
        }

        draw_external(1);

        draw_dots();
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
            0.792, 0.913, 0.960, 1,
            0.792, 0.913, 0.960, 1,
            0.792, 0.913, 0.960, 1,
            0.792, 0.913, 0.960, 1
        ];


        let colors = [0,1,2,3];
        if (this.current_clique)
        {
            colors = this.current_clique.routes;
        }
        else
        {
            console.warn("No current clique; coloring will be arbitrary.");
        }

        for(let i = 0; i < colors.length; i++)
        {
            let c_idx = colors[i];
            let col = this.draw_options.get_route_color(c_idx);
            let col_arr = css_str_to_rgb(col);
            for(let j = 0; j < 3; j++)
            {
                mat[4*i+j] = col_arr[j]/255;
            }
        }
        
        

        this.ctx.uniformMatrix4fv(
            this.program.uniforms.simplex_colors,
            false,
            mat
        );
    }

    do_render(): boolean
    {
        return this.poly_dim == 2 || this.poly_dim == 3;
    }
}


function load_shader(ctx: WebGLRenderingContext, type: GLenum, src: string): WebGLShader
{
    const shader = ctx.createShader(type) as WebGLShader;
    ctx.shaderSource(shader, src);
    ctx.compileShader(shader);

    if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
        alert(
            `An error occurred compiling the shaders: ${ctx.getShaderInfoLog(shader)}`,
        );
    }
    

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
    
    
    if (!ctx.getProgramParameter(shader_program, ctx.LINK_STATUS)) {
        alert(
        `Unable to initialize the shader program: ${ctx.getProgramInfoLog(
            shader_program,
        )}`,
        );
    }

    
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
            do_simplex_color: ctx.getUniformLocation(shader_program, "do_simplex_color") as WebGLUniformLocation,
            shade_amount: ctx.getUniformLocation(shader_program, "shade_amount") as WebGLUniformLocation,
        }
    };
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

type Triple = [number,number,number];
function get_normal(p1: Triple, p2: Triple, p3: Triple, center: Triple): Triple
{
    let root: Triple = p1;
    let arm1: Triple = [p2[0]-root[0], p2[1]-root[1], p2[2]-root[2]];
    let arm2: Triple = [p3[0]-root[0], p3[1]-root[1], p3[2]-root[2]];

    let normal = cross_product(arm1, arm2);

    let dot = 0;
    for(let i = 0; i < 3; i++)
        dot += normal[i] * (root[i] - center[i]);
    if(dot > 0)
        for(let i = 0; i < 3; i++)
            normal[i] *= -1;

    return normal;
}

function cross_product(a: Triple, b: Triple): Triple
{
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function gen_sphere(rows: number, cols: number, radius: number): {positions: Triple[], idxs: number[], normals: Triple[]}
{
    let sphere: Triple[] = [];
    let idx: number[] = [];
    let normals: Triple[] = [];

    for(let row = 0; row < rows; row++){
    for(let col = 0; col < cols; col++){

        let vangle = row * Math.PI / (rows - 1);
        let hangle = col * 2 * Math.PI / cols;

        let sv = Math.sin(vangle);
        let cv = Math.cos(vangle);

        let sh = Math.sin(hangle);
        let ch = Math.cos(hangle);

        let vert: Triple = [ch*sv * radius, cv * radius, sh*sv * radius];
        let normal: Triple = [-ch*sv, -cv, -sh*sv];

        sphere.push(vert);
        normals.push(normal);
    }}

    let vert_idx = (row: number, col: number) => row * cols + (col % cols);

    for(let row = 0; row < rows-1; row++){
    for(let col = 0; col < cols; col++){

        let p1 = vert_idx(row, col);
        let p2 = vert_idx(row+1, col);
        let p3 = vert_idx(row, col+1);
        let p4 = vert_idx(row+1, col+1);

        idx = [...idx, p1, p2, p4, p1, p3, p4];

    }}

    return {positions: sphere, idxs: idx, normals};
}