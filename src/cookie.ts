/*
Code stolen from
https://www.slingacademy.com/article/set-and-get-browser-cookies-with-typescript-basic-and-advanced-examples/
Why is the javascript cookie API so cursed? Why do I have to format a string to access basic functionality?
*/

export function set_cookie(name: string, value: string, days: number): void {
	let expires = "";
	if (days) {
		const date = new Date();
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
		expires = "; expires=" + date.toUTCString();
	}
	document.cookie = name + "=" + value + expires + "; path=/ ;SameSite=Lax";
}

export function get_cookie(name: string): string | null {
	const nameEQ = name + "=";
	const ca = document.cookie.split(';');
	for(let i=0;i < ca.length;i++) {
		let c = ca[i].trim();
		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
	}
	return null;
}