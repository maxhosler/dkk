export type Matrix = [[number,number], [number, number]];
export class Vector
{
	public x: number;
	public y: number;

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
}

export function on_thick_bezier(
	position: Vector,

	start: Vector,
	cp1:   Vector,
	cp2:   Vector,
	end:   Vector,

	thickness: number
): boolean
{
	

	return false;
}