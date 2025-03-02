var colors_cache: { [key: number]: string[] } = {}

export function get_colors(num_colors: number): string[]
{
	if(!(num_colors in colors_cache))
	{
		colors_cache[num_colors] = get_colors_inner(num_colors);
	}
	return colors_cache[num_colors];
}

export function get_colors_inner(num_colors: number): string[]
{
	let lum_rows: number;
	let hue_rows: number;
	let lums: number[];

	if(num_colors <= 10)
	{
		lum_rows = 1;
		hue_rows = num_colors;
		lums = [0.5];
	}
	else if(num_colors <= 20)
	{
		lum_rows = 2;
		hue_rows = Math.ceil(num_colors/2);
		lums = [0.33, 0.66]
	}
	else
	{
		lum_rows = 3;
		hue_rows = Math.ceil(num_colors/3);
		lums = [0.25, 0.5, 0.75]
	}

	let row_offset = Math.ceil(hue_rows/lum_rows);
	let out: string[] = [];
	let hue_step = half_coprime(hue_rows);

	for(let i = 0; i < num_colors; i++)
	{
		let lum_idx = Math.floor(i / hue_rows);
		let hue_idx = (hue_step * i + lum_idx * row_offset) % hue_rows;
		let lum = lums[lum_idx];
		let hue = skip_yellow(hue_idx / hue_rows);
		

		let color = hsl_to_rgb(hue, 0.65, lum);
		out.push(
			`rgb(${color[0]}, ${color[1]}, ${color[2]})`
		);
	}


	return out;
}

function hsl_to_rgb(h: number, s: number, l: number): [number,number,number]
{
	let c = (1-Math.abs(2*l-1)) * s;
	let hp = 6*h;
	let x = c * (1-Math.abs( hp % 2  -1 ));

	let rgb1: [number,number,number];
	if(hp < 1)
	{
		rgb1 = [c,x,0];
	}
	else if(hp < 2)
	{
		rgb1 = [x,c,0];
	}
	else if(hp < 3)
	{
		rgb1 = [0,c,x];
	}
	else if(hp < 4)
	{
		rgb1 = [0,x,c];
	}
	else if(hp < 5)
	{
		rgb1 = [x,0,c];
	}
	else
	{
		rgb1 = [c,0,x];
	}

	let intscale = (x: number) => Math.floor(x * 255);
	let m = l-c/2;
	return [
		intscale(rgb1[0] + m),
		intscale(rgb1[1] + m),
		intscale(rgb1[2] + m),
	]
}

function half_coprime(n: number)
{
	for(let i = Math.floor(n/2); i >= 1; i++)
		if(gcd(n, i) == 1)
			return i;
	return 1; //Should never be run, but just in case.
}

function gcd(x: number, y: number) {

    while(y) {
        var t = y;
        y = x % y;
        x = t;
    }
    return x;
}

function skip_yellow(x: number): number
{
	let interp = (70/360) + ( 1 + 40/360 - 70/360 ) * x;
	return interp % 1;
}