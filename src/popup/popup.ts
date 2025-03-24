/*
This abstract class is for 'popups'; specifically, the boxes
which darken the screen behind them, have a title, and are closed
with an 'x' in the corner.

Classes that inherit from this need to add their own content,
which should be appended to the 'popup_body' field.

The object should be constructed when the popup appears, and
expected to disappear with the popup.

Objects extending this are found in the same directory.
*/

export abstract class Popup
{
	close_callback: () => void;  //Function to call on close.

	base: HTMLDivElement;        //The div shadowing out the background
	window: HTMLDivElement;      //The body of the window
	top_bar: HTMLDivElement;     //The top bar, containing the title and 'x'
	popup_body: HTMLDivElement;  //The body, where content is added by implementations
	xout: HTMLDivElement;        //the x-out button

	/*
	All of this builds the popup as a child of 'body'; in all uses, this is the
	'body' element of the HTML document.
	*/
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

	//Method to close the popup.
	close()
	{
		this.base.remove();
		this.close_callback();
	}
}