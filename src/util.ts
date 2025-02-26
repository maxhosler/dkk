export type Matrix = [[number,number], [number, number]];
export class Vector
{
	readonly x: number;
	readonly y: number;

	constructor(x: number, y: number)
	{
		this.x=x;
		this.y=y;
	}

	static zero(): Vector
	{
		return new Vector(0,0);
	}

	scale(s: number): Vector
	{
		return new Vector(
			this.x * s,
			this.y * s
		);
	}

	add(v: Vector): Vector
	{
		return new Vector(
			this.x + v.x,
			this.y + v.y
		);
	}

	sub(v: Vector): Vector
	{
		return new Vector(
			this.x - v.x,
			this.y - v.y
		);
	}

	rot90(): Vector
	{
		return new Vector(
			-this.y,
			this.x
		);
	}

	rot(d: number): Vector
	{
		return new Vector(
			this.x * Math.cos(d) - this.y * Math.sin(d),
			this.x * Math.sin(d) + this.y * Math.cos(d)
		);
	}

	norm(): number
	{
		return Math.sqrt( 
			this.x * this.x +
			this.y * this.y
		);
	}

	normalized(): Vector
	{
		let n = this.norm();
		if (Math.abs(n) < 0.00000000001) {
			console.warn("Tried to normalize zero vector.")
			return Vector.zero();
		}
		return this.scale(1/n);
	}

	transform(m: Matrix): Vector
	{
		let c1 = new Vector(m[0][0], m[1][0]);
		let c2 = new Vector(m[0][1], m[1][1]);
		return c1.scale(this.x).add( c2.scale(this.y) )
	}

	clone(): Vector
	{
		return new Vector(
			this.x,
			this.y
		);
	}

	static right(): Vector
	{
		return new Vector(1,0);
	}

	min(other: Vector): Vector
	{
		return new Vector(
			Math.min(this.x, other.x),
			Math.min(this.y, other.y)
		)
	}

	max(other: Vector): Vector
	{
		return new Vector(
			Math.max(this.x, other.x),
			Math.max(this.y, other.y)
		)
	}
}

export class Bezier 
{
	readonly start_point: Vector;
	readonly end_point: Vector;
	readonly cp1: Vector;
	readonly cp2: Vector;

	constructor(st: Vector, cp1: Vector, cp2: Vector, end: Vector)
	{
		this.start_point = st;
		this.end_point = end,
		this.cp1 = cp1;
		this.cp2 = cp2;
	}

	transform(trans: (v: Vector) => Vector): Bezier
	{
		return new Bezier
		(
			trans(this.start_point),
			trans(this.cp1),
			trans(this.cp2),
			trans(this.end_point)
		)
	}

	get_point(t: number): Vector
	{
		let it = 1-t;
		return this.start_point.scale( it * it * it)
			.add( this.cp1.scale( 3 * t * it * it  ) )
			.add( this.cp2.scale( 3 * t * t * it ) )
			.add( this.end_point.scale( t * t * t ) );
	}

	distance_to(position: Vector): number
	{
		const EPSILON = 0.001;
		const STEP = 0.02;
	
		let dist = (t: number) => this.get_point(t).sub(position).norm();
		let d_dist = (t: number) => (dist(t+EPSILON) - dist(t)) / EPSILON;
		
		let min_t = 0;
		let min_dst = dist(0);
	
		for(let tp of [0, 0.2, 0.4, 0.6, 0.8, 1.0])
		{
			let d = dist(tp);
			if (d < min_dst)
			{
				min_t = tp;
				min_dst = d;
			}
		}
		
		let low  = clamp(min_t - 0.2, 0, 1);
		let high = clamp(min_t + 0.2, 0, 1);
		
		for(let i = 0; i < 8; i++)
		{
			let mid = (low + high) / 2;
			let dl = d_dist(low);
			let dm = d_dist(mid);

			if(dl * dm < 0)
			{
				high = mid;
			}
			else
			{
				low = mid;
			}
		}

		return dist((low + high) / 2);
	}
}

export class BoundingBox
{
	empty: boolean = true;
	top_corner: Vector = Vector.zero();
	bot_corner: Vector = Vector.zero();

	constructor(vecs: Vector[])
	{
		for(let v of vecs)
			this.add_box(v);
	}

	add_box(v: Vector)
	{
		if(this.empty)
		{
			this.empty = false;
			this.top_corner = v;
			this.bot_corner = v;
		}
		else
		{
			this.top_corner = this.top_corner.min(v);
			this.bot_corner = this.bot_corner.max(v);
		}
	}

	extent(): Vector
	{
		let x = Math.max(
			Math.abs(this.top_corner.x),
			Math.abs(this.bot_corner.x)
		);
		let y = Math.max(
			Math.abs(this.top_corner.y),
			Math.abs(this.bot_corner.y)
		);

		return new Vector(x,y);
	}
}

export const clamp: (num: number, min: number, max: number) => number
	= (num: number, min: number, max: number) => Math.min(Math.max(num, min), max)