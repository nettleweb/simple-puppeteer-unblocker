import { Socket } from "engine.io-client";

"use strict"; debugger; (async ({ window: win, document: doc }: {
	readonly window: Window;
	readonly document: Document;
}) => {
	function $(id: string): HTMLElement {
		const e = doc.getElementById(id);
		if (e != null)
			return e;
		else
			throw new Error("Failed to resolve element by ID: " + id);
	}

	function optURL(value: string): URL | null {
		try {
			return new URL(value);
		} catch (err) {
			return null;
		}
	}

	function message(msg: string | nul) {
		if (msg != null) {
			msgElem.textContent = msg;
			msgElem.style.display = "block";
		} else msgElem.style.display = "none";
	}

	function rewriteURL(value: string, search: string): string {
		value = value.replace(/\s+/g, " ").trim();

		const url = optURL(value);
		if (url != null)
			return url.href;

		if (value.includes(" "))
			return search + encodeURIComponent(value);

		const i = value.indexOf("/");
		if (i === 0)
			return search + encodeURIComponent(value);

		if (i > 0) {
			const host = value.substring(0, i);
			if (isHostname(host))
				return "https://" + value;
		} else {
			if (isHostname(value) && value.includes("."))
				return "https://" + value;
		}

		return search + encodeURIComponent(value);
	}

	function isHostname(str: string): boolean {
		str = str.toLowerCase();
		for (let i = 0; i < str.length; i++) {
			const ch = str.charCodeAt(i);
			if ((ch < 48 || ch > 57) && (ch < 97 || ch > 122) && ch !== 45 && ch !== 46) {
				return false;
			}
		}
		return true;
	}

	function encodeUTF8(data: string): Uint8Array {
		const bytes: number[] = [];

		for (const ch of Array.from(data, (v) => v.codePointAt(0) || 0xfffd)) {
			if (ch < 0x80)
				bytes.push(ch);
			else if (ch < 0x800)
				bytes.push((ch >> 6) | 0xc0, (ch & 0x3f) | 0x80);
			else if (ch < 0x10000)
				bytes.push((ch >> 12) | 0xe0, ((ch >> 6) & 0x3f) | 0x80, (ch & 0x3f) | 0x80);
			else
				bytes.push((ch >> 18) | 0xf0, ((ch >> 12) & 0x3f) | 0x80, ((ch >> 6) & 0x3f) | 0x80, (ch & 0x3f) | 0x80);
		}

		return Uint8Array.from(bytes);
	}

	function decodeUTF8(data: Uint8Array): string {
		const len = data.byteLength;
		let str: string = "";

		for (let i = 0; i < len;) {
			const b1 = data[i++];

			if ((b1 & 0x80) === 0)
				str += String.fromCharCode(b1);
			else if ((b1 & 0xe0) === 0xc0)
				str += String.fromCharCode(((b1 & 0x1f) << 6) | (data[i++] & 0x3f));
			else if ((b1 & 0xf0) === 0xe0)
				str += String.fromCharCode(((b1 & 0x0f) << 12) | ((data[i++] & 0x3f) << 6) | (data[i++] & 0x3f));
			else if ((b1 & 0xf8) === 0xf0) {
				const cp = ((b1 & 0x07) << 18) | ((data[i++] & 0x3f) << 12) | ((data[i++] & 0x3f) << 6) | (data[i++] & 0x3f);
				str += cp > 0x10ffff ? "\ufffd" : String.fromCodePoint(cp);
			} else str += "\ufffd";
		}

		return str;
	}

	if (doc.readyState !== "complete") {
		await new Promise((resolve) => {
			const callback = () => {
				if (doc.readyState === "complete") {
					doc.removeEventListener("readystatechange", callback);
					setTimeout(resolve, 1000, null);
				}
			};
			doc.addEventListener("readystatechange", callback, { passive: true });
		});
	}

	const his = win.history;
	const body = $("content");
	const tabs = $("tabs");
	const search = new URLSearchParams(win.location.search);
	const mkElem: <K extends string>(tag: K, opt?: any) => K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : Element = doc.createElementNS.bind(doc, "http://www.w3.org/1999/xhtml") as any;
	const address = $("address") as HTMLInputElement;
	const msgElem = $("message");
	const tabElems = tabs.children;
	const container = $("container");

	win.stop();
	win.focus();
	his.scrollRestoration = "manual";
	his.replaceState(void 0, "", "/");

	const socket = new Socket({
		path: "/__Zetta_/",
		//secure: true,
		upgrade: true,
		protocols: [],
		transports: ["polling", "websocket"],
		timestampParam: "x",
		addTrailingSlash: true,
		timestampRequests: true,
		rejectUnauthorized: true,
		closeOnBeforeunload: true
	});

	message("Connecting to server...");
	await new Promise((resolve) => {
		socket.on("open", () => {
			resolve(null);
			socket.removeAllListeners("open");
		});
	});

	const canvas = mkElem("canvas");
	canvas.width = 1280;
	canvas.height = 720;
	canvas.tabIndex = 1;
	canvas.autofocus = true;
	container.appendChild(canvas);

	let width: number = Math.max(body.clientWidth, 300);
	let height: number = Math.max(body.clientHeight - 77, 300);
	let curTabId: number = -1;

	const pages: PageInfo[] = [];
	const buttons: string[] = ["left", "middle", "right", "back", "forward"];
	const options: string = JSON.stringify({
		touch: win.navigator.maxTouchPoints > 0,
		width: width,
		height: height
	}, void 0, "\t");

	const context = canvas.getContext("bitmaprenderer", { alpha: false })!;
	if (context == null) {
		message("Error: Failed to initialize the canvas element.");
		return;
	}

	function handleKeyEvent(e: KeyboardEvent) {
		e.preventDefault();
		e.stopPropagation();
		e.returnValue = false;

		socket.send(encodeUTF8("\x02\x01" + JSON.stringify({
			type: e.type,
			key: e.key
		})), { compress: false });

		return false;
	}

	function handleMouseEvent(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		e.returnValue = false;

		socket.send(encodeUTF8("\x02\x01" + JSON.stringify({
			type: e.type,
			x: e.offsetX,
			y: e.offsetY,
			button: buttons[e.button]
		})), { compress: false });

		return false;
	}

	function handleWheelEvent(e: WheelEvent) {
		e.preventDefault();
		e.stopPropagation();
		e.returnValue = false;

		socket.send(encodeUTF8("\x02\x01" + JSON.stringify({
			type: e.type,
			deltaX: e.deltaX,
			deltaY: e.deltaY
		})), { compress: false });

		return false;
	}

	function handleTouchEvent(e: TouchEvent) {
		e.preventDefault();
		e.stopPropagation();
		e.returnValue = false;

		const { type, touches } = e;

		if (touches.length > 0) {
			const rect = canvas.getBoundingClientRect();
			for (const touch of touches) {
				socket.send(encodeUTF8("\x02\x01" + JSON.stringify({
					type: type,
					x: touch.clientX - rect.x,
					y: touch.clientY - rect.y
				})), { compress: false });
			}
		} else socket.send(encodeUTF8("\x02\x01" + JSON.stringify({ type: type })), { compress: false });

		return false;
	}

	function handleGenericEvent(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		e.returnValue = false;

		canvas.focus({ preventScroll: true });
		return false;
	}

	address.onblur = () => {
		const page = pages[curTabId];
		if (page != null)
			address.value = page.url;
	};
	address.onfocus = () => {
		address.select();
	};
	address.onkeydown = (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			e.stopPropagation();

			const input = address.value.trim();
			if (input.length > 0) {
				canvas.focus({ preventScroll: true });
				socket.send(encodeUTF8("\x02\x08" + rewriteURL(input, "https://www.google.com/search?q=")), { compress: true });
			}
		}
	};
	address.ondragstart = (e) => {
		e.preventDefault();
		e.stopPropagation();
		address.selectionEnd = address.selectionStart ||= 0;
	};

	$("back").onclick = () => {
		socket.send(Uint8Array.of(2, 3), { compress: false });
	};
	$("forward").onclick = () => {
		socket.send(Uint8Array.of(2, 4), { compress: false });
	};
	$("refresh").onclick = () => {
		socket.send(Uint8Array.of(2, 5), { compress: false });
	};
	$("new-tab").onclick = () => {
		socket.send(Uint8Array.of(2, 2), { compress: false });
	};

	canvas.addEventListener("wheel", handleWheelEvent);
	canvas.addEventListener("keyup", handleKeyEvent, { passive: false });
	canvas.addEventListener("keydown", handleKeyEvent, { passive: false });
	canvas.addEventListener("mouseup", handleMouseEvent, { passive: false });
	canvas.addEventListener("mousedown", handleMouseEvent, { passive: false });
	canvas.addEventListener("mousemove", handleMouseEvent, { passive: false });
	canvas.addEventListener("touchend", handleTouchEvent, { passive: false });
	canvas.addEventListener("touchmove", handleTouchEvent, { passive: false });
	canvas.addEventListener("touchstart", handleTouchEvent, { passive: false });
	canvas.addEventListener("click", handleGenericEvent, { passive: false });
	canvas.addEventListener("contextmenu", handleGenericEvent, { passive: false });

	socket.on("open", () => {
		message("Restoring session...");
		socket.send(encodeUTF8("\x01" + options), { compress: true });
	});
	socket.on("close", (msg: string) => {
		console.log("Connection closed: ", msg);
		message("Disconnected from the backend server. Please check your internet connection.");
	});
	socket.on("message", (data: ArrayBufferLike) => {
		const view = new Uint8Array(data);
		if (view[0] === 0xff &&
			view[1] === 0xd8 &&
			view[2] === 0xff) {
			createImageBitmap(new Blob([view], { type: "image/jpeg", endings: "native" }), 0, 0, canvas.width, canvas.height, {
				resizeQuality: "pixelated",
				imageOrientation: "none",
				premultiplyAlpha: "none",
				colorSpaceConversion: "none"
			}).then((bitmap) => {
				context.transferFromImageBitmap(bitmap);
			}).catch((err) => {
				console.error("Bitmap decode error: ", err);
			});
			return;
		}

		const parts = decodeUTF8(view).split("\n", 10);
		switch (parts[0]) {
			case MessageID.url:
				{
					const url = parts[1] || "about:blank";
					if (url.length > 0) {
						const page = pages[curTabId];
						if (page != null)
							page.url = url;
						if (doc.activeElement !== address)
							address.value = url;
					}
				}
				break;
			case MessageID.ready:
				{
					const w = parseInt(parts[1], 36) || 1280;
					const h = parseInt(parts[2], 36) || 720;

					canvas.width = width = w;
					canvas.height = height = h;
					container.style.width = w + "px";
					container.style.height = h + "px";

					for (const page of pages)
						socket.send(encodeUTF8("\x02\x02" + page.url));
					if (curTabId === -1)
						socket.send(encodeUTF8("\x02\x02" + (search.get("q") || "")));
					else
						socket.send(Uint8Array.of(2, 6, curTabId), { compress: false });

					message(null);
					canvas.focus({ preventScroll: true });
				}
				break;
			case MessageID.tabopen:
				{
					const elem = mkElem("div");
					elem.innerHTML = "<img src=\"res/empty.ico\" width=\"19\" height=\"19\" draggable=\"false\" decoding=\"async\" loading=\"lazy\" alt=\"Site Icon\" /><div>Untitled</div>";
					elem.onclick = (e) => {
						e.preventDefault();
						e.stopPropagation();

						for (const e of tabElems)
							e.removeAttribute("data-current");

						address.value = page.url;
						elem.setAttribute("data-current", "");
						socket.send(Uint8Array.of(2, 6, curTabId = pages.indexOf(page, 0)), { compress: false });
					};

					{
						const e = mkElem("button");
						e.type = "button";
						e.title = "Close";
						e.onclick = () => {
							socket.send(Uint8Array.of(2, 7, pages.indexOf(page, 0)), { compress: false });
						};
						elem.appendChild(e);
					}

					const page: PageInfo = Object.preventExtensions(Object.setPrototypeOf({
						url: "",
						title: "",
						favicon: ""
					}, null));

					for (const e of tabElems)
						e.removeAttribute("data-current");

					elem.setAttribute("data-current", "");
					curTabId = pages.length;
					tabs.appendChild(elem);
					pages.push(page);
				}
				break;
			case MessageID.tabinfo:
				{
					const id = parseInt(parts[1], 36) || 0;
					const tab = tabElems[id];
					const page = pages[id];
					const title = parts[2] || "Untitled";
					const favicon = parts[3] || "/res/empty.ico";

					if (tab != null) {
						tab.querySelector("div")!.textContent = title;
						tab.querySelector("img")!.src = favicon;
					}
					if (page != null) {
						page.title = title;
						page.favicon = favicon;
					}
				}
				break;
			case MessageID.tabclose:
				{
					const id = parseInt(parts[1], 36) || 0;
					if (id >= 0 && id < pages.length) {
						if (id === curTabId) {
							if (id > 1) {
								curTabId = id - 1;
								address.value = pages[curTabId].url;
								tabElems[curTabId].setAttribute("data-current", "");
							} else {
								curTabId = 0;
								address.value = pages[0].url;
								tabElems[0].setAttribute("data-current", "");
							}
						}

						tabElems[id].remove();
						pages.splice(id, 1);
					}
				}
				break;
			default:
				console.error("Received invalid message: ", parts);
				break;
		}
	});

	message("Requesting new session...");
	socket.send(encodeUTF8("\x01" + options), { compress: true });
})(window);
