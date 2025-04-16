import { preset_dag_embedding } from "../preset";
import { Vector2 } from "../util/num";
import { Result } from "../util/result";
import { DAGCliques } from "./cliques";

/*
This class contains the geometric data about the polytope, 
precomputed when it is passed a copy of the DAGCliques object.
*/

export class FlowPolytope
{
    
    readonly dim: number;
    readonly vertices: NVector[]
    
    /*
    This is a list of all 'external' simplices of the polytope, i.e. those
    that make up the facets. Usually.

    This shouldn't be used for math-y purposes! It is entirely for rendering,
    so for 2-dimensional polytopes, *all* full-dimensional simplices are 
    considered "external", since that's what's needed to properly render them.
    */
    readonly external_simplices: number[][];

    constructor(dag_cliques: DAGCliques)
    {
        let unreduced_dim = dag_cliques.dag.num_edges();
        this.dim = dag_cliques.dag.num_edges() - dag_cliques.dag.num_verts() + 1;

        //Convert routes to vertices
        let unred_vertices: NVector[] = [];
        for(let route of dag_cliques.routes)
        {
            let vertex = NVector.zero(unreduced_dim);
            for(let edge of route.edges)
                vertex.coordinates[edge] = 1;
            unred_vertices.push(vertex);
        }

        //Maximal clique, guaranteeing that the basis is chosen consistently.
        let max_clique = dag_cliques.cliques[
            dag_cliques.hasse.maximal_elt
        ];
        let center = unred_vertices[max_clique.routes[0]];
        let basis  = max_clique.routes.slice(1)
            .map((idx: number) => {
                return unred_vertices[idx].sub(center)
        });
        
        //Shift all vectors so 'basis' is actually a basis.
        let centered_vertices = unred_vertices
            .map((v: NVector) => v.sub(center));


        let E = compute_basis_projection(basis);

        let projected_vertices = centered_vertices
            .map((v) => E.apply_to(v));
        
        if(this.dim == 3 || this.dim == 2)
        {
            /*
            This procedure tries to find an affine transformation that will make the 
            polytope look 'nice' (i.e. not squashed), for visualization purposes. It
            does this by finding the minimum bounding ellipsoid, and computing a 
            transformation which will turn that ellipsoid into a sphere.
            */

            let {matrix: A, center} = min_bounding_ellipsoid(projected_vertices);

            let B = cholesky_decomposition(A.inv());

            //This has the property that B^T A B = I
            //So, the map x -> B^(-1)(x-c) takes the ellipsoid given by
            //(x-c)^TA(x-c)=1 to the unit sphere.

            this.vertices = projected_vertices
                .map((v) => B.inv().apply_to( v.sub(center) ).scale(0.95));
        }
        else
        {
            this.vertices = projected_vertices;
        }

        //computing the external simplices
        let external_simplices: number[][] = [];
        for(let clq_idx = 0; clq_idx < dag_cliques.cliques.length; clq_idx++)
        {
            //If 2-dimensional, *all* simplicies are external.
            if (this.dim == 2)
            {
                external_simplices.push(structuredClone(dag_cliques.cliques[clq_idx].routes));
                continue;
            }

            let clq = dag_cliques.cliques[clq_idx];
            let no_flip: number[] = [];
            for(let route_idx = 0; route_idx < clq.routes.length; route_idx++)
            {
                if(dag_cliques.mutate_by_idx_in_clq(clq_idx, route_idx) == clq_idx)
                {
                    no_flip.push(route_idx);
                }
            }

            for(let skip of no_flip)
            {
                let simpl: number[] = [];
                for(let route_idx = 0; route_idx < clq.routes.length; route_idx++)
                {
                    if(route_idx == skip) continue;
                    simpl.push(clq.routes[route_idx]);
                }
                external_simplices.push(simpl);
            }
            
        }
        this.external_simplices = external_simplices;
    }

    private quotient(dag_cliques: DAGCliques): FlowPolytope
    {
        let exceptional_span: NVector[] = [];
        for(let i of dag_cliques.exceptional_routes)
            exceptional_span.push(this.vertices[i])
        if(exceptional_span.length <= 1)
            return this;

        let qdim = this.dim - exceptional_span.length + 1;
        

        let center = exceptional_span[0];
        let e_basis: NVector[] = [];
        for(let i = 1; i < exceptional_span.length; i++)
        {
            e_basis.push(
                exceptional_span[i].sub(exceptional_span[0])
            );
        }
        let on_e_basis = orthonorm_basis(e_basis);



        throw new Error("Not yet implemented!");
    }

    to_json_ob(): JSONFlowPolytope
	{
        let vertices: number[][] = [];
        for(let vec of this.vertices)
        {
            vertices.push(structuredClone(vec.coordinates))
        }
		return {
            dim: this.dim,
            vertices,
            external_simplices: structuredClone(this.external_simplices)
        }
	}

    static from_json_ob(ob: JSONFlowPolytope): Result<FlowPolytope>
    {
        for(let field of ["dim", "vertices", "external_simplices"])
			if(!(field in ob))
				return Result.err("MissingField", "FlowPolytope is missing field: "+field);
        if(typeof ob.dim != "number")
            return Result.err("InvalidField", "FlowPolytope field 'num' is not a number.");
        for(let field of ["vertices", "external_simplices"]) {
            let data = (ob as any)[field];
            if(typeof data.length != "number")
                return Result.err("InvalidField", `FlowPolytope field '${data}' is not an array.`);
            if(data.length > 0 && typeof data[0].length != "number")
                return Result.err("InvalidField", `FlowPolytope field '${data}' is not an array of arrays.`);
            if(data[0].length > 0 && typeof data[0][0]!= "number")
                return Result.err("InvalidField", `FlowPolytope field '${data}' is not an array of arrays of numbers.`);
        }

        let vertices: NVector[] = ob.vertices.map(
            (x) => new NVector(x)
        );
        let just_fields = {
            dim: ob.dim,
            vertices,
            external_simplices: structuredClone(ob.external_simplices)
        };
        let base = new FlowPolytope(empty_clique());
        for(let field in just_fields)
            //@ts-ignore
            base[field] = just_fields[field]
        return Result.ok(base);
    }
}
export type JSONFlowPolytope = {
    dim: number,
    vertices: number[][],
    external_simplices: number[][]
}

//A class representing an arbitrary-length vector.
class NVector
{
    coordinates: number[]
    constructor(coordinates: number[])
    {
        this.coordinates = coordinates;
    }

    static zero(dim: number): NVector
    {
        return new NVector(new Array<number>(dim).fill(0));
    }

    static one(dim: number): NVector
    {
        return new NVector(new Array<number>(dim).fill(1));
    }

    norm()
    {
        let out = 0;

        for(let c of this.coordinates)
            out += c*c;

        return Math.sqrt(out);
    }

    dim(): number
    {
        return this.coordinates.length;
    }

    add(vec: NVector): NVector
    {
        if(this.dim() != vec.dim())
        {
            throw new Error("Dimensions do not match.");
        }
        let out = NVector.zero(this.dim());

        for(let i = 0; i < this.dim(); i++)
        {
            out.coordinates[i] = this.coordinates[i] + vec.coordinates[i];
        }

        return out;
    }

    scale(scalar: number): NVector
    {
        let out = NVector.zero(this.dim());
        for(let i = 0; i < this.dim(); i++)
        {
            out.coordinates[i] = scalar * this.coordinates[i];
        }

        return out;
    }

    sub(vec: NVector): NVector
    {
        return this.add(vec.scale(-1));
    }

    trunc(dim: number): NVector
    {
        let out: number[] = [];
        for(let i = 0; i < Math.min(dim, this.dim()); i++)
            out.push(this.coordinates[i])
        return new NVector( out );
    }

    dot(vec: NVector): number
    {
        if(vec.dim() != this.dim()) throw new Error("Dimensions don't match.")
        let out = 0;
        
        for(let i = 0; i < this.dim(); i++)
            out += this.coordinates[i] * vec.coordinates[i];

        return out;
    }

    proj_onto(onto: NVector): NVector
    {
        if(Math.abs(onto.norm()) <= 0.00001)
            return NVector.zero(this.dim())

        return onto.scale(
            this.dot(onto) / onto.dot(onto)
        )
    }

    as_row_matrix(): Matrix
    {
        let inner = structuredClone(this.coordinates);
        return new Matrix(this.dim(), 1, [inner])
    }

    as_column_matrix(): Matrix
    {
        let inner: number[][] = [];
        for(let x of this.coordinates)
            inner.push([x])
        return new Matrix(1, this.dim(), inner);
    }

}

//A class representing an arbitrary matrix. Used in the shape normalization procedure. 
class Matrix
{
    width: number;
    height: number;
    inner: number[][];

    constructor(width: number, height: number, inner: number[][])
    {
        this.inner = inner;
        this.height = height;
        this.width = width;
    }

    static zero(dim: number): Matrix
    {
        let inner: number[][] = [];
        for(let i = 0; i < dim; i++)
        {
            inner.push(new Array<number>(dim).fill(0));
        }
        return new Matrix(dim, dim, inner);
    }

    static zero_rect(width: number, height: number)
    {
        let inner: number[][] = [];
        for(let i = 0; i < height; i++)
        {
            inner.push(new Array<number>(width).fill(0));
        }
        return new Matrix(width, height, inner);
    }

    static id(dim: number): Matrix
    {
        let m = Matrix.zero(dim);
        for(let i = 0; i < dim; i++)
        {
            m.inner[i][i] = 1
        }
        return m;
    }

    static from_columns(columns: NVector[]): Matrix
    {
        let col_dum = columns[0].dim();
        let inner: number[][] = [];
        for(let r = 0; r < col_dum; r++)
        {
            let row: number[] = [];
            for(let c = 0; c < columns.length; c++)
            {
                row.push(columns[c].coordinates[r])
            }
            inner.push(row);
        }
        return new Matrix(columns.length, col_dum, inner);
    }

    static diag(vec: NVector): Matrix
    {
        let mat = Matrix.zero(vec.dim())
        for(let i = 0; i < vec.dim(); i++)
            mat.inner[i][i] = vec.coordinates[i];
        return mat;
    }

    swap_rows(i: number, j: number)
    {
        for(let c = 0; c < this.width; c++)
        {
            [this.inner[i][c], this.inner[j][c]] = 
                [this.inner[j][c], this.inner[i][c]]
        }
    }

    scale_row(i: number, scalar: number)
    {
        for(let c = 0; c < this.width; c++)
        {
            this.inner[i][c] *= scalar;
        }
    }

    add_scaled_row(add_to: number, add_from: number, scalar: number)
    {
        for(let c = 0; c < this.width; c++)
        {
            this.inner[add_to][c] += this.inner[add_from][c] * scalar;
        }
    }

    get_col_vec(col: number): NVector
    {
        let out: number[] = [];
        for(let r = 0; r < this.height; r++)
            out.push(this.get_entry(r,col))
        return new NVector(out);
    }

    get_row_vec(row: number): NVector
    {
        let out: number[] = [];
        for(let c = 0; c < this.width; c++)
            out.push(this.get_entry(row,c))
        return new NVector(out);
    }

    get_entry(row: number, col: number): number
    {
        return this.inner[row][col];
    }

    apply_to(vec: NVector): NVector
    {
        if(vec.dim() != this.width) throw new Error("Dimensions don't match!")
        let out = NVector.zero(this.height);

        for(let i = 0; i < this.width; i++)
        {
            out = out.add( this.get_col_vec(i).scale( vec.coordinates[i] ))
        }

        return out;
    }

    t(): Matrix
    {
        let out: number[][] = [];
        for(let c = 0; c < this.width; c++)
        {
            let row = [];
            for(let r = 0; r < this.height; r++)
                row.push(this.get_entry(r,c));
            out.push(row);
        }

        return new Matrix(this.height, this.width, out);
    }

    det(): number
    {
        if(this.width != this.height) throw new Error("Only square matrices have determinants.");
        if(this.width == 1) return this.inner[0][0];
        if(this.width == 2) {
            let a = this.inner[0][0];
            let b = this.inner[1][0];
            let c = this.inner[0][1];
            let d = this.inner[1][1];
            return a * d - b * c;
        }
        let out = 0;
        for(let r=0; r < this.height; r++)
        {
            let v = Math.pow(-1, r) * this.get_entry(r,0);
            let m = this.minor(r,0);
            out += v * m.det();
        }
        return out;
    }

    inv(): Matrix
    {
        if(this.width != this.height) throw new Error("Only square matrices have inverses.");
        let det = this.det();
        if(det == 0) throw new Error("Matrix not invertible.");

        let inverse = Matrix.zero(this.width);
        for(let r = 0; r < this.height; r++)
        {
            for(let c=0; c < this.width; c++)
            {
                inverse.inner[r][c] = Math.pow(-1, r+c) * this.minor(c,r).det() / det;
            }
        }
        return inverse;
    }

    diag_vector(): NVector
    {
        let out = [];
        let d = Math.min(this.height, this.width);
        for(let i = 0; i < d; i++)
            out.push(this.get_entry(i,i));
        return new NVector(out);
    }

    minor(rem_row: number, rem_col: number): Matrix
    {
        let out = [];
        for(let r = 0; r < this.height; r++)
        {
            if(r==rem_row)continue;

            let row = []
            for(let c = 0; c < this.width; c++)
            {
                if(c==rem_col)continue;

                row.push(this.get_entry(r,c))
            }
            out.push(row);

        }

        return new Matrix(this.width-1, this.height-1, out);
    }

    mul(rhs: Matrix): Matrix
    {
        if(this.width != rhs.height) throw new Error("Dimensions don't match for matrix multiplication.")
        let out = Matrix.zero_rect(rhs.width, this.height);
        for(let c = 0; c < out.width; c++)
            for(let r = 0; r < out.height; r++)
            {
                let rv = this.get_row_vec(r);
                let cv = rhs.get_col_vec(c);
                out.inner[r][c] = rv.dot(cv);
            }
        return out;
    }

    add(rhs: Matrix): Matrix
    {
        if(this.width != rhs.width || this.height != rhs.height) throw new Error("Dimensions don't match!");
        let out = Matrix.zero_rect(this.width, this.height);
        for(let c = 0; c < this.width; c++)
        {
            for(let r = 0; r < this.height; r++)
            {
                out.inner[r][c] = this.inner[r][c] + rhs.inner[r][c];
            }
        }
        return out;
    }

    scale(k: number): Matrix
    {
        let out = Matrix.zero_rect(this.width, this.height);
        for(let c = 0; c < this.width; c++)
        {
            for(let r = 0; r < this.height; r++)
            {
                out.inner[r][c] = this.inner[r][c] * k;
            }
        }
        return out;
    }

    sub(rhs: Matrix): Matrix
    {
        return this.add(rhs.scale(-1));
    }

    log_str(): string
    {
        let out = ""
        for(let row of this.inner)
        {
            for(let v of row)
            {
                out += v.toString();
            }
            out += "\n"
        }
        return out;
    }
}

function append_1_row(matrix: Matrix): Matrix
{
    let inner = structuredClone(matrix.inner);
    inner.push(new Array<number>(matrix.width).fill(1))
    return new Matrix(matrix.width, matrix.height+1, inner);
}

//https://stackoverflow.com/questions/1768197/bounding-ellipse/1768440#1768440
//https://people.orie.cornell.edu/miketodd/TYKhach.pdf

//M matrix, C center
//Ellipse is
//(x-C)^T M (x-C) = 1
function min_bounding_ellipsoid(points: NVector[], tolerance: number = 0.01): {center: NVector, matrix: Matrix}
{
    let N = points.length;
    let P = Matrix.from_columns(points);
    
    const d = points[0].dim();
    const n = d+1;

    let Q = append_1_row(P);
    let u = NVector.one(N).scale(1/N);

    let count = 1;
    let err = 1;

    while(err > tolerance)
    {
        let X = Q.mul(Matrix.diag(u)).mul(Q.t());
        let M = Q.t()
            .mul(X.inv())
            .mul(Q)
            .diag_vector();
        
        let max_loc = 0;
        let max = M.coordinates[0];
        for(let i = 1; i < M.dim(); i++)
        {
            if(M.coordinates[i] > max)
            {
                max = M.coordinates[i];
                max_loc = i;
            }
        }

        let step_size = (max - n) / (n * (max-1));
        let new_u = u.scale(1-step_size);

        new_u.coordinates[max_loc] += step_size;

        err = new_u.sub(u).norm();

        count += 1;
        u = new_u;
    }

    let U = Matrix.diag(u);
    
    let pup = P.mul(U).mul(P.t());

    let center = P.apply_to(u);
    let pupu = center.as_column_matrix()
        .mul(center.as_row_matrix());
    
    let A = pup.sub(pupu).inv().scale(1/d);

    //A = (1/d) * inv(P * U * P' - (P * u)*(P*u)' );
    //c = P * u;

    return {
        matrix: A,
        center
    };
}

function cholesky_decomposition(A: Matrix): Matrix
{
    let L = Matrix.zero(A.width).inner;
    let n = A.width;

    for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
            let sum = 0;
            for (let k = 0; k < j; k++)
                sum += L[i][k] * L[j][k];
    
            if (i == j)
                L[i][j] = Math.sqrt(A.inner[i][i] - sum);
            else
                L[i][j] = (1.0 / L[j][j] * (A.inner[i][j] - sum));
        }
    }

    return new Matrix(n,n,L);
}

function empty_clique(): DAGCliques
{
    return new DAGCliques(preset_dag_embedding("cube").dag)
}

function compute_basis_projection(basis: NVector[]): Matrix
{
    /*
    The following is Gauss-Jordan elimination,
    with the end of reducing the dimensionality
    of the vertices to the 'true' dimension of the polytope.

    Projects onto a new set of basis vectors, given by N-1 of
    the vertices of the maximal clique, minus the remaining one.

    The final matrix E is the necessary projection.
    */    
    let unred_dim = basis[0].dim();
    let dim = basis.length;

    let A = Matrix.from_columns(basis);
    let E = Matrix.id(unred_dim);

    let swap_both = (i: number, j: number) => 
    {
        A.swap_rows(i,j);
        E.swap_rows(i,j);
    }
    let scale_both = (i: number, scalar: number) =>
    {
        A.scale_row(i,scalar);
        E.scale_row(i,scalar);
    }
    let add_scaled_both = (add_to: number, add_from: number, scalar: number) => 
    {
        A.add_scaled_row(add_to, add_from, scalar);
        E.add_scaled_row(add_to, add_from, scalar);
    }

    for(let c = 0; c < A.width; c++)
    {
        if(A.get_entry(c,c) == 0)
        {
            for(let r = c+1; r < A.height; r++) {
                if(A.get_entry(r, c) != 0) {
                    swap_both(c,r);
                    break;
                }
            }
        }

        scale_both(c,1/A.get_entry(c,c));
        
        for(let i = 0; i < A.height; i++)
        {
            if(c == i) continue;
            add_scaled_both(
                i, c,
                -A.get_entry(i,c)
            );
        }
    }

    let trunc = Matrix.zero_rect(unred_dim, dim);
    for(let i = 0; i < dim; i++)
        trunc.inner[i][i] = 1;

    return trunc.mul(E);
}

function orthonorm_basis(basis: NVector[]): NVector[]
{
    let on_basis: NVector[] = [];
    for(let v of basis)
    {
        let u = v;
        for(let ui of on_basis)
        {
            u = u.sub( v.proj_onto(ui) )
        }
    }

    for(let i = 0; i < on_basis.length; i++)
    {
        on_basis[i] = on_basis[i].scale(1/on_basis[i].norm())
    }

    return on_basis;
}