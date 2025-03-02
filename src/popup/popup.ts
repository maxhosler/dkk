export abstract class Popup
{
	close_callback: () => void;

	base: HTMLDivElement;
	window: HTMLDivElement;
	top_bar: HTMLDivElement;
	popup_body: HTMLDivElement;
	xout: HTMLDivElement;
	constructor(body: HTMLElement, title_name: string, close_callback: () => void)
	{
		this.close_callback = close_callback;

		let base = document.createElement("div");
		base.id = "shadow"
		base.className = "fullscreen"
		this.base = base;
		body.appendChild(base);

		let window = document.createElement("div");
		window.className = "popup-window";
		base.appendChild(window);
		this.window = window;

		let top_bar = document.createElement("div");
		top_bar.className = "popup-top-bar";
		window.appendChild(top_bar);
		this.top_bar = top_bar;

		let title = document.createElement("h3");
		title.innerText = title_name;
		top_bar.appendChild(title);

		let xout = document.createElement("div");
		xout.className = "popup-xout";
		xout.innerText = "X";
		xout.onclick = () => {
			this.close()
		};
		top_bar.appendChild(xout);
		this.xout = xout;

		let popup_body = document.createElement("div");
		popup_body.className = "popup-body";
		this.window.appendChild(popup_body);
		this.popup_body = popup_body;
		
	}

	close()
	{
		this.base.remove();
		this.close_callback();
	}
}