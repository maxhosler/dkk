type Quadratic = [number, number, number];
export class Spline
{
	readonly f1x: Quadratic;
	readonly f2x: Quadratic;
	readonly f1y: Quadratic;
	readonly f2y: Quadratic;

	constructor(
		tangent_start: {x: number, y: number},
		point_start:   {x: number, y: number},
		tangent_end:   {x: number, y: number},
		point_end:     {x: number, y: number}
	)
	{
		let [f1x, f2x] = comp_cubics(
			tangent_start.x,
			point_start.x,
			tangent_end.x,
			point_end.x
		);
		let [f1y, f2y] = comp_cubics(
			tangent_start.y,
			point_start.y,
			tangent_end.y,
			point_end.y
		);
		this.f1x = f1x;
		this.f2x = f2x;
		this.f1y = f1y;
		this.f2y = f2y;

	}
}

function comp_cubics(
	Ts: number,
	Ps: number,
	Te: number,
	Pe: number,
): [Quadratic, Quadratic]
{
	let a =  2*Pe - 2*Ps - 0.5*Te - 1.5*Ts;
	let A = -2*Pe + 2*Ps + 1.5*Te + 0.5*Ts;
	return [
		[Ps,Ts,a],
		[A+Pe-Te,Te-2*A, A]
	];
}