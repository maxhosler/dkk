import { DAGCliques } from "./routes";

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
    
    static linearly_independent(vectors: NVector[]): boolean
    {
        throw new Error("Unimplemented.")
    }
}

class Matrix
{
    width: number;
    height: number;
    inner: number[][];

    private constructor(width: number, height: number, inner: number[][])
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

    get_entry(row: number, col: number): number
    {
        return this.inner[row][col];
    }

    apply_to(vec: NVector): NVector
    {
        if(vec.dim() != this.width) throw new Error("Dimensions don't match!")
        let out = NVector.zero(this.width);

        for(let i = 0; i < this.width; i++)
        {
            out = out.add( this.get_col_vec(i).scale( vec.coordinates[i] ))
        }

        return out;
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

export class FlowPolytope
{
    readonly dim: number;
    //readonly vertices: NVector[]

    constructor(dag_cliques: DAGCliques)
    {
        let unreduced_dim = dag_cliques.dag.num_edges();
        this.dim = dag_cliques.dag.num_edges() - dag_cliques.dag.num_verts() + 1;

        let unred_vertices: NVector[] = [];
        for(let route of dag_cliques.routes)
        {
            let vertex = NVector.zero(unreduced_dim);
            for(let edge of route.edges)
                vertex.coordinates[edge] = 1;
            unred_vertices.push(vertex);
        }

        let max_clique = dag_cliques.cliques[
            dag_cliques.hasse.maximal_elt
        ];
        let center = unred_vertices[max_clique.routes[0]];
        let basis  = max_clique.routes.slice(1)
            .map((idx: number) => {
                return unred_vertices[idx].sub(center)
        });
 
        let centered_vertices = unred_vertices
            .map((v: NVector) => v.sub(center));

        let A = Matrix.from_columns(basis);
        let E = Matrix.id(unreduced_dim);

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

        let projected_vertices = centered_vertices
            .map((v) => E.apply_to(v).trunc(this.dim));
        let mid = projected_vertices.reduce(
            (acc, val) => acc.add(val.scale(1/projected_vertices.length)),
            NVector.zero(this.dim)
        )
        console.log(mid);
    }
}