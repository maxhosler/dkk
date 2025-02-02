export const SIDEBAR: HTMLDivElement   = document.getElementById("sidebar") as HTMLDivElement;
export const RIGHT_AREA: HTMLDivElement = document.getElementById("right_area") as HTMLDivElement;

export function clear_page()
{
	SIDEBAR.innerHTML = "";
	RIGHT_AREA.innerHTML = "";
}