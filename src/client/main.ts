import io from "socket.io-client"

"use strict"; debugger; (async ({ window: win, document: doc }: {
	readonly window: Window;
	readonly document: Document;
}) => {
	function $(id: string): HTMLElement {
		const elem = doc.getElementById(id);
		if (elem == null)
			throw new Error("Element does not exist: " + id);
		return elem;
	}

	function q(q: string): HTMLElement {
		const elem = doc.querySelector(q);
		if (elem instanceof HTMLElement)
			return elem;
		throw new Error("Failed to query selector: " + q);
	}

	function error(message: string | nul) {
		if (message != null) {
			errEl.textContent = message;
			errEl.style.display = "block";
		} else errEl.style.display = "none";
	}

	function optURL(value: string): URL | null {
		try {
			return new URL(value);
		} catch (err) {
			return null;
		}
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

	if (doc.readyState !== "complete") {
		await new Promise((resolve) => {
			const callback = () => {
				if (doc.readyState === "complete") {
					doc.removeEventListener("readystatechange", callback);
					setTimeout(resolve, 500, null);
				}
			};
			doc.addEventListener("readystatechange", callback, { passive: true });
		});
	}

	const his = win.history;
	const body = doc.body;
	const errEl = doc.createElement("div");
	const search = new URLSearchParams(win.location.search);

	win.stop();
	win.focus();
	his.scrollRestoration = "manual";
	his.replaceState(void 0, "", "/");
	body.innerHTML = "<span>Loading... (1)</span>";

	await new Promise((resolve) => {
		setTimeout(resolve, 1000, null);
	});

	const socket = io("/", {
		path: "/%FD%BF%80%90%80%81%0A/",
		secure: true,
		upgrade: true,
		timeout: 10000,
		forceNew: true,
		multiplex: false,
		protocols: [],
		transports: ["polling", "websocket"],
		autoConnect: true,
		reconnection: true,
		rememberUpgrade: true,
		reconnectionDelay: 5000,
		rejectUnauthorized: true,
		closeOnBeforeunload: true
	});

	body.innerHTML = "<span>Connecting to server...</span>";

	await new Promise<void>((resolve) => {
		socket.on("connect", resolve);
	});

	body.innerHTML = `
<div id="tab-bar">
<div id="tabs"></div>
	<button id="new-tab" type="button" title="New tab"></button>
</div>
<div id="toolbar">
	<button id="back" type="button" title="Back"></button>
	<button id="forward" type="button" title="Forward"></button>
	<button id="refresh" type="button" title="Refresh"></button>
	<input id="address" type="text" spellcheck="false" placeholder="Search or type a URL" autocomplete="off" />
</div>
<div id="container">
	<div id="message">Error</div>
</div>`;
	body.prepend(errEl);

	{
		const tabs = $("tabs");
		const address = $("address") as HTMLInputElement;
		const msgElem = $("message");
		const container = $("container");

		const canvas = doc.createElement("canvas");
		canvas.width = 1280;
		canvas.height = 720;
		canvas.tabIndex = 1;
		canvas.autofocus = true;
		container.appendChild(canvas);

		const pages: PageInfo[] = [];
		const buttons: string[] = ["left", "middle", "right", "back", "forward"];
		const options = Object.freeze(Object.setPrototypeOf({
			touch: win.navigator.maxTouchPoints > 0,
			width: Math.max(body.clientWidth, 300),
			height: Math.max(body.clientHeight - 77, 300),
		}, null));

		const tabElems = tabs.children;
		let currentTabId: number = -1;

		const context = canvas.getContext("bitmaprenderer", { alpha: false })!;
		if (context == null) {
			error("Error: Failed to initialize canvas context.");
			return;
		}

		function message(msg: string | nul) {
			if (msg != null) {
				msgElem.textContent = msg;
				msgElem.style.display = "block";
			} else msgElem.style.display = "none";
		}

		function handleWheelEvent(e: WheelEvent) {
			e.preventDefault();
			e.stopPropagation();
			e.returnValue = false;

			socket.emit("event", {
				type: e.type,
				deltaX: e.deltaX,
				deltaY: e.deltaY
			});

			return false;
		}

		function handleKeyEvent(e: KeyboardEvent) {
			e.preventDefault();
			e.stopPropagation();
			e.returnValue = false;

			socket.emit("event", {
				type: e.type,
				key: e.key
			});

			return false;
		}

		function handleMouseEvent(e: MouseEvent) {
			e.preventDefault();
			e.stopPropagation();
			e.returnValue = false;

			socket.emit("event", {
				type: e.type,
				x: e.offsetX,
				y: e.offsetY,
				button: buttons[e.button]
			});

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
					socket.emit("event", {
						type: type,
						x: touch.clientX - rect.x,
						y: touch.clientY - rect.y
					});
				}
			} else socket.emit("event", { type: type });

			return false;
		}

		function handleGenericEvent(e: Event) {
			e.preventDefault();
			e.stopPropagation();
			e.returnValue = false;

			canvas.focus({ preventScroll: true });
			return false;
		}

		async function startOrRestoreSession() {
			socket.removeAllListeners();
			socket.emit("ns", options);

			const { width, height } = await new Promise<SessionInfo>((resolve) => {
				socket.once("ready", (width, height) => {
					resolve({ width, height });
				});
			});

			canvas.width = width;
			canvas.height = height;
			options.width = width;
			options.height = height;
			container.style.width = width + "px";
			container.style.height = height + "px";

			for (const page of pages) {
				socket.emit("newtab", page.url);
				await new Promise<void>((resolve) => {
					socket.once("tabinfo", (id: number, title: string, favicon: string) => {
						const tab = tabElems[id];
						page.title = tab.querySelector("div")!.textContent = title || "Untitled";
						page.favicon = tab.querySelector("img")!.src = favicon || "/res/empty.ico";
						resolve();
					});
				});
			}

			socket.on("url", (url: string) => {
				if (typeof url === "string") {
					const page = pages[currentTabId];
					if (page != null)
						page.url = url;
					if (doc.activeElement !== address)
						address.value = url;
				}
			});
			socket.on("frame", (data: ArrayBuffer) => {
				createImageBitmap(new Blob([data], { type: "image/jpeg", endings: "native" }), 0, 0, width, height, {
					resizeQuality: "pixelated",
					imageOrientation: "none",
					premultiplyAlpha: "none",
					colorSpaceConversion: "none"
				}).then((bitmap) => {
					context.transferFromImageBitmap(bitmap);
				}).catch((err) => {
					console.error("Bitmap decode error: ", err);
				});
			});
			socket.on("tabinfo", (id: number, title: string, favicon: string) => {
				const tab = tabElems[id];
				const page = pages[id];

				title ||= "Untitled";
				favicon ||= "/res/empty.ico";

				if (tab != null) {
					tab.querySelector("div")!.textContent = title;
					tab.querySelector("img")!.src = favicon;
				}
				if (page != null) {
					page.title = title;
					page.favicon = favicon;
				}
			});
			socket.on("tabopen", () => {
				const elem = doc.createElement("div");
				elem.innerHTML = "<img src=\"res/empty.ico\" width=\"19\" height=\"19\" draggable=\"false\" decoding=\"async\" loading=\"lazy\" alt=\"Site Icon\" /><div>Untitled</div>";
				elem.onclick = (e) => {
					e.preventDefault();
					e.stopPropagation();

					for (const e of tabElems)
						e.removeAttribute("data-current");

					address.value = page.url;
					elem.setAttribute("data-current", "");
					socket.emit("focustab", currentTabId = pages.indexOf(page, 0));
				};

				{
					const e = doc.createElement("button");
					e.type = "button";
					e.title = "Close";
					e.onclick = () => {
						socket.emit("closetab", pages.indexOf(page, 0));
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
				currentTabId = pages.length;
				tabs.appendChild(elem);
				pages.push(page);
			});
			socket.on("tabclose", (id: number) => {
				if (id >= 0 && id < pages.length) {
					if (id === currentTabId) {
						if (id > 1) {
							currentTabId = id - 1;
							address.value = pages[currentTabId].url;
							tabElems[currentTabId].setAttribute("data-current", "");
						} else {
							currentTabId = 0;
							address.value = pages[0].url;
							tabElems[0].setAttribute("data-current", "");
						}
					}

					tabElems[id].remove();
					pages.splice(id, 1);
				}
			});

			if (currentTabId === -1)
				socket.emit("newtab", search.get("q"));
			else
				socket.emit("focustab", currentTabId);

			message(null);
			canvas.focus({ preventScroll: true });
		}

		address.onblur = () => {
			const page = pages[currentTabId];
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
					socket.emit("navigate", rewriteURL(input, "https://www.google.com/search?q="));
				}
			}
		};
		address.ondragstart = (e) => {
			e.preventDefault();
			e.stopPropagation();
			address.selectionEnd = address.selectionStart ||= 0;
		};

		$("back").onclick = () => {
			socket.emit("back");
		};
		$("forward").onclick = () => {
			socket.emit("forward");
		};
		$("refresh").onclick = () => {
			socket.emit("refresh");
		};
		$("new-tab").onclick = () => {
			socket.emit("newtab");
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

		socket.io.on("close", () => {
			message("Disconnected from the backend server. Please check your internet connection.");
		});
		socket.io.on("reconnect", () => {
			message("Restoring session...");
			startOrRestoreSession();
		});

		message("Requesting new session...");
		await startOrRestoreSession();
	}
})(window);
