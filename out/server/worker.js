import fs from "fs";
import worker from "worker_threads";
import process from "process";
import puppeteer from "puppeteer";
const port = worker.parentPort;
const data = worker.workerData;
if (worker.isMainThread || port == null || data == null || typeof data !== "object")
    throw new Error("Invalid script execution context");
const touch = data.touch || false;
const width = Math.max(Math.min(data.width || 1280, 1280), 300);
const height = Math.max(Math.min(data.height || 720, 1280), 300);
const dataDir = process.argv[2];
const landscape = width >= height;
let focused = -1;
const pages = [];
const stubImage = fs.readFileSync("./res/loading.jpg");
await fs.promises.cp("./local/chrome/data", dataDir, {
    force: true,
    recursive: true,
    errorOnExist: true,
    preserveTimestamps: true
});
const chrome = await puppeteer.launch({
    env: {},
    pipe: true,
    dumpio: true,
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
        width: width,
        height: height,
        isMobile: false,
        hasTouch: touch,
        isLandscape: landscape,
        deviceScaleFactor: 1
    },
    downloadBehavior: {
        policy: "deny",
        downloadPath: dataDir
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
        "--hide-scrollbars",
        "--enable-automation"
    ]
});
function checkRewriteURL(url) {
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
async function updatePageSettings(page) {
    await page.setBypassCSP(true);
    await page.setCacheEnabled(true);
    await page.setJavaScriptEnabled(true);
    await page.setExtraHTTPHeaders({
        "DNT": "1",
        "Sec-GPC": "1"
    });
    await page.setGeolocation({
        accuracy: 1,
        latitude: 0,
        longitude: 0
    });
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0", {
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
            let title = "";
            let favicon = "";
            try {
                title = await page.title();
            }
            catch (err) {
                // ignore
            }
            try {
                const res = await fetch(await page.evaluate('"use strict"; (() => {\n\tfor (const e of document.querySelectorAll("link")) {\n\t\tfor (const it of (e.getAttribute("rel") || "").trim().split(" ")) {\n\t\t\tif (it === "icon") {\n\t\t\t\treturn new URL((e.getAttribute("href") || "").trim() || "/favicon.ico", document.baseURI).href;\n\t\t\t}\n\t\t}\n\t}\n\treturn new URL("/favicon.ico", document.baseURI).href;\n})();'), {
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
            }
            catch (err) {
                // ignore
            }
            port.postMessage(Buffer.from("0" /* MessageID.url */ + "\n" + page.url(), "utf-8"));
            port.postMessage(Buffer.from("3" /* MessageID.tabinfo */ + "\n" + i.toString(36) + "\n" + title + "\n" + favicon, "utf-8"));
        }
    });
    page.on("close", () => {
        const i = pages.indexOf(page, 0);
        if (i >= 0) {
            pages.splice(i, 1);
            if (i === focused)
                focused--;
            port.postMessage(Buffer.from("4" /* MessageID.tabclose */ + "\n" + i.toString(36), "utf-8"));
        }
    });
    page.on("popup", (page) => {
        if (page != null) {
            if (pages.length < 255) {
                port.postMessage(Buffer.from("2" /* MessageID.tabopen */ + "\n" + (++focused), "utf-8"));
                port.postMessage(Buffer.from("0" /* MessageID.url */ + "\n" + page.url(), "utf-8"));
                updatePageSettings(page).catch(() => { });
                pages.push(page);
            }
            else
                page.close({ runBeforeUnload: false }).catch(() => { });
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
port.on("message", async (data) => {
    try {
        switch ((data = Buffer.from(data))[1]) {
            case 0 /* MessageID.stop */:
                shutdown();
                break;
            case 1 /* MessageID.event */:
                {
                    const page = pages[focused];
                    if (page != null) {
                        const event = JSON.parse(data.toString("utf-8", 2, data.byteLength));
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
                }
                break;
            case 2 /* MessageID.newtab */:
                if (pages.length < 255) {
                    const page = await chrome.newPage();
                    await updatePageSettings(page);
                    port.postMessage(Buffer.from("2" /* MessageID.tabopen */ + "\n" + (++focused), "utf-8"));
                    port.postMessage(Buffer.from("0" /* MessageID.url */ + "\n" + page.url(), "utf-8"));
                    pages.push(page);
                    const length = data.byteLength;
                    if (length > 2) {
                        const str = data.toString("utf-8", 2, length);
                        console.log(str);
                        const url = checkRewriteURL(new URL(str));
                        if (url != null) {
                            await page.goto(url, {
                                referer: "",
                                timeout: 10000,
                                waitUntil: "load"
                            });
                        }
                    }
                }
                break;
            case 3 /* MessageID.back */:
                {
                    const page = pages[focused];
                    if (page != null) {
                        await page.goBack({
                            timeout: 10000,
                            waitUntil: "load"
                        });
                    }
                }
                break;
            case 4 /* MessageID.forward */:
                {
                    const page = pages[focused];
                    if (page != null) {
                        await page.goForward({
                            timeout: 10000,
                            waitUntil: "load"
                        });
                    }
                }
                break;
            case 5 /* MessageID.refresh */:
                {
                    const page = pages[focused];
                    if (page != null) {
                        await page.reload({
                            timeout: 10000,
                            waitUntil: "load"
                        });
                    }
                }
                break;
            case 6 /* MessageID.focustab */:
                {
                    const id = data[2] || 0;
                    if (pages[id] != null)
                        focused = id;
                }
                break;
            case 7 /* MessageID.closetab */:
                {
                    const page = pages[data[2] || 0];
                    if (page != null)
                        await page.close({ runBeforeUnload: false });
                }
                break;
            case 8 /* MessageID.navigate */:
                {
                    const page = pages[focused];
                    if (page != null) {
                        const url = checkRewriteURL(new URL(data.toString("utf-8", 2, data.byteLength)));
                        if (url != null) {
                            await page.goto(url, {
                                referer: "",
                                timeout: 10000,
                                waitUntil: "load"
                            });
                        }
                    }
                }
                break;
            default:
                break;
        }
    }
    catch (err) {
        // ignore
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
const loop = async () => {
    const page = pages[focused];
    if (page != null) {
        let buffer = stubImage;
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
        }
        catch (err) {
            // ignore
        }
        port.postMessage(buffer, [buffer.buffer]);
    }
    setTimeout(loop, 150);
};
port.postMessage(Buffer.from("1" /* MessageID.ready */ + "\n" + width.toString(36) + "\n" + height.toString(36), "utf-8"));
await loop();
