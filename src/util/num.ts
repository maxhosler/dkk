import { Result } from "./result";

/*
Various classes and methods for numerical and geometric stuff.
Includes 2x2 matrices, 2-dimensional vectors, bounding boxes, etc.
*/

export type Matrix2x2 = [[number,number], [number, number]];
export class Vector2
{
	readonly x: number;
	readonly y: number;

	constructor(x: number, y: number)
	{
		this.x=x;
		this.y=y;
	}

	static zero(): Vector2
	{
		return new Vector2(0,0);
	}

	scale(s: number): Vector2
	{
		return new Vector2(
			this.x * s,
			this.y * s
		);
	}

	add(v: Vector2): Vector2
	{
		return new Vector2(
			this.x + v.x,
			this.y + v.y
		);
	}

	sub(v: Vector2): Vector2
	{
		return new Vector2(
			this.x - v.x,
			this.y - v.y
		);
	}

	rot90(): Vector2
	{
		return new Vector2(
			-this.y,
			this.x
		);
	}

	rot(d: number): Vector2
	{
		return new Vector2(
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

	normalized(): Vector2
	{
		let n = this.norm();
		if (Math.abs(n) < 0.00000000001) {
			console.warn("Tried to normalize zero vector.")
			return Vector2.zero();
		}
		return this.scale(1/n);
	}

	transform(m: Matrix2x2): Vector2
	{
		let c1 = new Vector2(m[0][0], m[1][0]);
		let c2 = new Vector2(m[0][1], m[1][1]);
		return c1.scale(this.x).add( c2.scale(this.y) )
	}

	clone(): Vector2
	{
		return new Vector2(
			this.x,
			this.y
		);
	}

	static right(): Vector2
	{
		return new Vector2(1,0);
	}

	min(other: Vector2): Vector2
	{
		return new Vector2(
			Math.min(this.x, other.x),
			Math.min(this.y, other.y)
		)
	}

	max(other: Vector2): Vector2
	{
		return new Vector2(
			Math.max(this.x, other.x),
			Math.max(this.y, other.y)
		)
	}

	to_json_ob(): [number, number]
	{
		return [this.x, this.y];
	}
}


/*
Bezier curve with two control points. Is a parametric function with
B(0) = {start_point} and B(1) = {end_point}.
*/
export class Bezier 
{
	readonly start_point: Vector2;
	readonly end_point: Vector2;
	readonly cp1: Vector2;
	readonly cp2: Vector2;

	constructor(st: Vector2, cp1: Vector2, cp2: Vector2, end: Vector2)
	{
		this.start_point = st;
		this.end_point = end,
		this.cp1 = cp1;
		this.cp2 = cp2;
	}

	//Apply function {trans} to all points to get a new curve.
	transform(trans: (v: Vector2) => Vector2): Bezier
	{
		return new Bezier
		(
			trans(this.start_point),
			trans(this.cp1),
			trans(this.cp2),
			trans(this.end_point)
		)
	}

	//Gets derivative along curve at time {t}.
	get_direc(t: number): Vector2
	{
		let it = 1-t;
		return this.start_point.scale( -3 * it * it)
			.add( this.cp1.scale( 3 * (1 - 3 * t) * it  ) )
			.add( this.cp2.scale( 3 * (2 - 3 * t) * t ) )
			.add( this.end_point.scale( 3 * t * t ) );
	}

	//Get position along curve at time {t}.
	get_point(t: number): Vector2
	{
		let it = 1-t;
		return this.start_point.scale( it * it * it)
			.add( this.cp1.scale( 3 * t * it * it  ) )
			.add( this.cp2.scale( 3 * t * t * it ) )
			.add( this.end_point.scale( t * t * t ) );
	}

	//Approximates distance from this curve to {position}.
	distance_to(position: Vector2): number
	{
		const EPSILON = 0.001;
		
		//Distance to point
		let dist = (t: number) => this.get_point(t).sub(position).norm();
		//Derivative of above
		let d_dist = (t: number) => (dist(t+EPSILON) - dist(t)) / EPSILON;
		
		let min_t = 0;
		let min_dst = dist(0);
		
		//get closest amongst these 6 points.
		for(let tp of [0, 0.2, 0.4, 0.6, 0.8, 1.0])
		{
			let d = dist(tp);
			if (d < min_dst)
			{
				min_t = tp;
				min_dst = d;
			}
		}
		
		//Refine with binary search.
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

	//Approximate point along line {dist} from the endpoint {from}.
	point_distance_along(dist: number, from: "start" | "end"): Vector2
	{
		//Guaranteed to be longer than the length of the curve, by the geometry
		//of Bezier curves.
		let length_overestimate = this.start_point.sub(this.cp1).norm() + 
			this.cp1.sub(this.cp2).norm() + 
			this.cp2.sub(this.end_point).norm();

		let t = 0;
		let d = 1;
		if(from == "end")
		{
			t = 1;
			d = -1;
		}

		let last_pos = this.get_point(t);
		let travelled = 0;
		let iterations = 0;

		//Step along the curve until the total distance is greater than
		//the desired distance, or 20 iterations.
		while(travelled < dist && 0 <= t && t <= 1 && iterations < 20)
		{
			let dist_to_go = dist - travelled;
			
			t += d * dist_to_go / length_overestimate;
			iterations += 1;

			let next_pos = this.get_point(t);
			let delta = last_pos.sub(next_pos).norm();

			last_pos = next_pos;
			travelled += delta;
		}

		return last_pos;
	}
}

//Bounding box.
export class BoundingBox
{
	empty: boolean = true;
	top_corner: Vector2 = Vector2.zero();
	bot_corner: Vector2 = Vector2.zero();

	constructor(vecs: Vector2[])
	{
		for(let v of vecs)
			this.add_point(v);
	}

	//If {point} not in box, expands to fit it.
	add_point(v: Vector2)
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

	//Check if {point} in box.
	contains(point: Vector2): boolean
	{
		if(this.empty) return false;
		return this.top_corner.x <= point.x &&
			   point.x <= this.bot_corner.x &&
			   this.top_corner.y <= point.y &&
			   point.y <= this.bot_corner.y
	}

	//Expand box by {w} units in all directions.
	pad(w: number)
	{
		let delta = new Vector2(w,w);
		this.top_corner = this.top_corner.sub(delta);
		this.bot_corner = this.bot_corner.add(delta);
	}

	//Absolute size of vector furthest from zero in box.
	extent(): Vector2
	{
		let x = Math.max(
			Math.abs(this.top_corner.x),
			Math.abs(this.bot_corner.x)
		);
		let y = Math.max(
			Math.abs(this.top_corner.y),
			Math.abs(this.bot_corner.y)
		);

		return new Vector2(x,y);
	}

	width(): number
	{
		return this.bot_corner.x - this.top_corner.x
	}

	height(): number
	{
		return this.bot_corner.y - this.top_corner.y
	}

	to_json_ob(): JSONBoundingBox
	{
		return {
			empty: this.empty,
			top_corner: this.top_corner.to_json_ob(),
			bot_corner: this.bot_corner.to_json_ob()
		}
	}

	static from_json_ob(ob: JSONBoundingBox): Result<BoundingBox>
	{
		//TODO: Validate 
		let bb = new BoundingBox([]);

		if(!ob.empty)
		{
			bb.add_point(new Vector2(ob.top_corner[0], ob.top_corner[1]));
			bb.add_point(new Vector2(ob.bot_corner[0], ob.bot_corner[1]));
		}

		return Result.ok(bb)
	}

	clone(): BoundingBox
	{
		let bb = new BoundingBox([this.top_corner, this.bot_corner]);
		bb.empty = this.empty;
		return bb;
	}
}
export type JSONBoundingBox = {
	empty: boolean,
	top_corner: [number,number];
	bot_corner: [number,number];
}

export const clamp: (num: number, min: number, max: number) => number
	= (num: number, min: number, max: number) => Math.min(Math.max(num, min), max)