import fs from "fs";
import worker from "worker_threads";
import process from "process";
import puppeteer from "puppeteer";

const port = worker.parentPort!;
const data = worker.workerData;

if (worker.isMainThread || port == null)
	throw new Error("Invalid script execution context");
if (data == null || typeof data !== "object")
	throw new Error("Invalid worker data");

const touch = data.touch;
const width = Math.max(Math.min(data.width, 1280), 300);
const height = Math.max(Math.min(data.height, 1280), 300);
const dataDir = data.dataDir;
const landscape = width >= height;

let focused: number = -1;
const pages: (puppeteer.Page | undefined)[] = [];
const stubImage = fs.readFileSync("./res/loading.jpg");

fs.cpSync("./local/chrome/data", dataDir, {
	force: true,
	recursive: true,
	errorOnExist: true,
	preserveTimestamps: true
});

const chrome = await puppeteer.launch({
	env: {},
	pipe: true,
	dumpio: false,
	browser: "chrome",
	channel: "chrome",
	timeout: 8000,
	headless: true,
	userDataDir: dataDir,
	handleSIGHUP: false,
	handleSIGINT: false,
	handleSIGTERM: false,
	executablePath: fs.existsSync("./local/chrome/chrome") ? "./local/chrome/chrome" : puppeteer.executablePath("chrome"),
	protocolTimeout: 5000,
	defaultViewport: {
		width: 1280,
		height: 720,
		isMobile: false,
		hasTouch: false,
		isLandscape: true,
		deviceScaleFactor: 1
	},
	args: [
		"--use-angle=vulkan",
		"--enable-unsafe-webgpu",
		"--enable-features=Vulkan",
		"--no-sandbox",
		"--disable-sync",
		"--disable-logging",
		"--disable-breakpad",
		"--disable-infobars",
		"--disable-translate",
		"--disable-extensions",
		"--disable-default-apps",
		"--disable-notifications",
		"--disable-dev-shm-usage",
		"--disable-setuid-sandbox",
		"--window-name=\"\ud800\"",
		"--window-size=1280,720",
		"--window-position=0,0"
	],
	ignoreDefaultArgs: [
		"--hide-scrollbars"
	]
});


type MouseEvent = { readonly type: "mousedown" | "mouseup" | "mousemove"; readonly x: number; readonly y: number; readonly button: puppeteer.MouseButton; };
type TouchEvent = { readonly type: "touchstart" | "touchend" | "touchmove"; readonly x: number; readonly y: number; };
type WheelEvent = { readonly type: "wheel"; readonly deltaX: number; readonly deltaY: number; };
type KeyboardEvent = { readonly type: "keydown" | "keyup"; readonly key: puppeteer.KeyInput; };
type Event = MouseEvent | TouchEvent | WheelEvent | KeyboardEvent;

function checkRewriteURL(url: URL): string | null {
	switch (url.protocol) {
		case "http:":
		case "https:":
			break;
		case "data:":
		case "chrome:":
			return url.href;
		default:
			return null;
	}

	const host = url.hostname;
	if (host === "localhost")
		return null;

	if (host.match(/^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/)) {
		const parts = host.split(".", 4); // direct ip access
		switch (parts[0]) {
			case "0": // 0.0.0.0/8
			case "10": // 10.0.0.0/8
			case "127": // 127.0.0.0/8
				return null;
			default:
				break;
		}
	}

	return url.href;
}

async function updatePageSettings(page: puppeteer.Page) {
	await page.setBypassCSP(true);
	await page.setCacheEnabled(true);
	await page.setJavaScriptEnabled(true);
	await page.setBypassServiceWorker(true);

	await page.setGeolocation({
		accuracy: 1,
		latitude: 0,
		longitude: 0
	});
	await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0", {
		architecture: "",
		bitness: "",
		brands: [],
		fullVersion: "",
		fullVersionList: [],
		mobile: false,
		model: "",
		platform: "",
		platformVersion: "",
		wow64: false
	});
	await page.setViewport({
		width: width,
		height: height,
		isMobile: false,
		hasTouch: touch,
		isLandscape: landscape,
		deviceScaleFactor: 1
	});

	page.setDefaultTimeout(5000);
	page.setDefaultNavigationTimeout(10000);

	page.on("load", async () => {
		const i = pages.indexOf(page, 0);
		if (i >= 0) {
			let title: string = "";
			let favicon: string = "";

			try {
				title = await page.title();
			} catch (err) {
				// ignore
			}

			try {
				const res = await fetch(await page.evaluate<[], { (): string; }>('"use strict"; (() => {\n\tfor (const e of document.querySelectorAll("link")) {\n\t\tfor (const it of (e.getAttribute("rel") || "").trim().split(" ")) {\n\t\t\tif (it === "icon") {\n\t\t\t\treturn new URL((e.getAttribute("href") || "").trim() || "/favicon.ico", document.baseURI).href;\n\t\t\t}\n\t\t}\n\t}\n\treturn new URL("/favicon.ico", document.baseURI).href;\n})();'), {
					method: "GET",
					signal: AbortSignal.timeout(3000),
					redirect: "follow",
					keepalive: false
				});
				if (res.ok) {
					const type = (res.headers.get("content-type") || "").split(";", 2)[0].trim();
					if (type.startsWith("image/", 0))
						favicon = "data:" + type + ";base64," + Buffer.from(await res.arrayBuffer()).toString("base64");
				}
			} catch (err) {
				// ignore
			}

			port.postMessage(["url", page.url()]);
			port.postMessage(["tabinfo", i, title, favicon]);
		}
	});
	page.on("close", () => {
		const i = pages.indexOf(page, 0);
		if (i >= 0) {
			pages.splice(i, 1);
			port.postMessage(["tabclose", i]);

			if (i === focused)
				focused--;
		}
	});
	page.on("popup", (page) => {
		if (page != null) {
			updatePageSettings(page).catch(() => { });
			port.postMessage(["tabopen", ++focused]);
			port.postMessage(["url", page.url()]);
			pages.push(page);
		}
	});
}

function shutdown() {
	chrome.close().then(() => {
		fs.rmSync(dataDir, {
			force: true,
			recursive: true,
			maxRetries: 20,
			retryDelay: 500
		});
		process.exit(0);
	});
}

port.on("message", async (args: any[]) => {
	switch (args.shift() || "") {
		case "newtab":
			try {
				const page = await chrome.newPage();
				await updatePageSettings(page);
				port.postMessage(["tabopen", ++focused]);
				port.postMessage(["url", page.url()]);
				pages.push(page);

				let url = args.shift();
				if (url != null && (url = checkRewriteURL(new URL(url, "https://nettleweb.com/"))) != null) {
					await page.goto(url, {
						referer: "",
						timeout: 10000,
						waitUntil: "load"
					});
				}
			} catch (err) {
				// ignore
			}
			break;
		case "navigate":
			try {
				const page = pages[focused];
				if (page != null) {
					const url = checkRewriteURL(new URL(args.shift(), "https://nettleweb.com/"));
					if (url != null) {
						await page.goto(url, {
							referer: "",
							timeout: 10000,
							waitUntil: "load"
						});
					}
				}
			} catch (err) {
				// ignore
			}
			break;
		case "back":
			try {
				const page = pages[focused];
				if (page != null) {
					await page.goBack({
						timeout: 10000,
						waitUntil: "load"
					});
				}
			} catch (err) {
				// ignore
			}
			break;
		case "forward":
			try {
				const page = pages[focused];
				if (page != null) {
					await page.goForward({
						timeout: 10000,
						waitUntil: "load"
					});
				}
			} catch (err) {
				// ignore
			}
			break;
		case "refresh":
			try {
				const page = pages[focused];
				if (page != null) {
					await page.reload({
						timeout: 10000,
						waitUntil: "load"
					});
				}
			} catch (err) {
				// ignore
			}
			break;
		case "focustab":
			{
				const id = args.shift();
				if (pages[id] != null)
					focused = id;
			}
			break;
		case "closetab":
			try {
				const page = pages[args.shift()];
				if (page != null)
					await page.close({ runBeforeUnload: false });
			} catch (err) {
				// ignore
			}
			break;
		case "event":
			try {
				const page = pages[focused];
				if (page != null) {
					const event: Event = args.shift();
					switch (event.type) {
						case "wheel":
							await page.mouse.wheel({ deltaX: event.deltaX, deltaY: event.deltaY });
							break;
						case "keyup":
							await page.keyboard.up(event.key);
							break;
						case "keydown":
							await page.keyboard.down(event.key);
							break;
						case "mouseup":
							await page.mouse.up({ button: event.button });
							break;
						case "mousedown":
							await page.mouse.down({ button: event.button });
							break;
						case "mousemove":
							await page.mouse.move(event.x, event.y, { steps: 1 });
							break;
						case "touchend":
							await page.touchscreen.touchEnd();
							break;
						case "touchmove":
							await page.touchscreen.touchMove(event.x, event.y);
							break;
						case "touchstart":
							await page.touchscreen.touchStart(event.x, event.y);
							break;
						default:
							break;
					}
				}
			} catch (err) {
				// ignore
			}
			break;
		case "stop":
			shutdown();
			break;
		default:
			break;
	}
});
port.on("messageerror", (err) => {
	console.error("Worker Message Error: ", err);
});


process.on("SIGHUP", shutdown);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGQUIT", shutdown);

process.on("unhandledRejection", () => {
	// ignore
});

port.postMessage(["ready", width, height]);


const loop: () => Promise<void> = async () => {
	const page = pages[focused];
	if (page != null) {
		let buffer: Uint8Array = stubImage;

		try {
			buffer = await page.screenshot({
				type: "jpeg",
				quality: 50,
				encoding: "binary",
				fullPage: false,
				fromSurface: true,
				omitBackground: true,
				optimizeForSpeed: true
			});
		} catch (err) {
			// ignore
		}

		port.postMessage(["frame", buffer]);
	}

	setTimeout(loop, 100);
};

await loop();