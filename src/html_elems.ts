export const SIDEBAR_HEAD: HTMLDivElement   = document.getElementById("sb-head") as HTMLHeadingElement;
export const SIDEBAR_CONTENTS: HTMLDivElement   = document.getElementById("sb-contents") as HTMLDivElement;
export const RIGHT_AREA: HTMLDivElement = document.getElementById("right_area") as HTMLDivElement;

export function clear_page()
{
	SIDEBAR_HEAD.innerHTML = "";
	SIDEBAR_CONTENTS.innerHTML = "";
	RIGHT_AREA.innerHTML = "";
}