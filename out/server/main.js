import fs from "fs";
import dns from "dns";
import Path from "path";
import worker from "worker_threads";
import process from "process";
import uWebSockets from "uWebSockets.js";
import { uServer as Engine } from "engine.io";
function getFilePath(path) {
    if (fs.existsSync(path = Path.resolve(Path.join("./static/", path)))) {
        if (fs.statSync(path, { bigint: true, throwIfNoEntry: true }).isDirectory())
            return fs.existsSync(path = Path.join(path, "index.html")) ? path : null;
        else
            return path;
    }
    return null;
}
function getMimeType(path) {
    switch (Path.extname(path)) {
        // image
        case ".png":
            return "image/png";
        case ".apng":
            return "image/apng";
        case ".avif":
            return "image/avif";
        case ".bmp":
            return "image/bmp";
        case ".gif":
            return "image/gif";
        case ".ico":
            return "image/x-icon";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".svg":
            return "image/svg+xml";
        case ".tif":
        case ".tiff":
            return "image/tiff";
        case ".webp":
            return "image/webp";
        // audio
        case ".aac":
            return "audio/aac";
        case ".flac":
            return "audio/flac";
        case ".mid":
        case ".midi":
            return "audio/midi";
        case ".mp3":
            return "audio/mpeg";
        case ".oga":
        case ".ogg":
        case ".opus":
            return "audio/ogg";
        case ".wav":
            return "audio/wav";
        case ".weba":
            return "audio/webm";
        // video
        case ".avi":
            return "video/x-msvideo";
        case ".mp4":
            return "video/mp4";
        case ".mpeg":
            return "video/mpeg";
        case ".ogv":
            return "video/ogg";
        case ".ts":
            return "video/mp2t";
        case ".webm":
            return "video/webm";
        // fonts
        case ".otf":
            return "font/otf";
        case ".ttf":
            return "font/ttf";
        case ".woff":
            return "font/woff";
        case ".woff2":
            return "font/woff2";
        // misc
        case ".js":
        case ".cjs":
        case ".mjs":
            return "text/javascript";
        case ".css":
            return "text/css";
        case ".csv":
            return "text/csv";
        case ".txt":
            return "text/plain";
        case ".pdf":
            return "application/pdf";
        case ".rtf":
            return "application/rtf";
        case ".xml":
            return "application/xml";
        case ".json":
            return "application/json";
        case ".wasm":
            return "application/wasm";
        case ".htm":
        case ".html":
            return "text/html";
        case ".xht":
        case ".xhtml":
            return "application/xhtml+xml";
        // fallback
        default:
            return "application/octet-stream";
    }
}
function handleSignal(signal) {
    stderr.write("\n\nReceived signal: " + signal + "\n");
    stderr.write("Stopping services...\n");
    httpServer.close();
    process.exit(0);
}
////////////////////////////////////////////////////////////
// INIT
////////////////////////////////////////////////////////////
const { env, argv: args, stdin, stdout, stderr } = process;
for (const k of Object.getOwnPropertyNames(Object.setPrototypeOf(env, null)))
    delete env[k];
env["PATH"] = "/sbin:/bin";
env["HOME"] = "/tmp/user";
env["LANG"] = "C.UTF-8";
env["LC_ALL"] = "C.UTF-8";
args.splice(0, 2);
stdin.setEncoding("utf-8");
stdout.setDefaultEncoding("utf-8");
stderr.setDefaultEncoding("utf-8");
process.chdir(Path.dirname(Path.dirname(import.meta.dirname)));
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["1.1.1.1", "1.0.0.1"]);
dns.promises.setDefaultResultOrder("ipv4first");
dns.promises.setServers(["1.1.1.1", "1.0.0.1"]);
fs.rmSync("./local/sessions", { force: true, recursive: true });
fs.mkdirSync("./local/sessions", { mode: 0o770, recursive: true });
fs.mkdirSync("./local/chrome/data", { mode: 0o770, recursive: true });
for (const arg of args) {
    if (arg[0] === "-") {
        const op = arg[1] === "-" ? arg.slice(2) : arg.slice(1);
        switch (op) {
            case "help":
                stdout.write("Usage: ubo-relay [OPTION...]\n\n");
                stdout.write("\t--help			Show this help message and exit.\n");
                stdout.write("\t--version		Show version information and exit.\n\n");
                process.exit(0);
                break;
            case "version":
                stdout.write("v0.1.0\n");
                process.exit(0);
                break;
            default:
                stderr.write("Error: Invalid option: -" + op + "\n");
                stderr.write("Try '--help' for more information.\n");
                process.exit(1);
                break;
        }
    }
    else {
        stderr.write("Error: Invalid arguments.");
        stderr.write("Try '--help' for more information.\n");
        process.exit(1);
    }
}
//////////////////////////////////////////////////
// HTTP Server
//////////////////////////////////////////////////
const httpServer = uWebSockets.App({
    passphrase: "__NettleWeb__"
}).ws("/__Zetta_/*", {
    open: (ws) => {
        const transport = ws.getUserData().transport;
        transport.socket = ws;
        transport.writable = true;
        transport.emit("ready");
    },
    close: (ws, code, msg) => {
        ws.getUserData().transport.onClose(code, msg);
    },
    message: (ws, msg, bin) => {
        ws.getUserData().transport.onData(bin ? msg.slice(0, msg.byteLength) : Buffer.from(msg).toString("utf-8"));
    },
    upgrade: (res, req, ctx) => {
        eio.handleUpgrade(res, req, ctx);
    },
    compression: uWebSockets.SHARED_COMPRESSOR | uWebSockets.SHARED_DECOMPRESSOR,
    idleTimeout: 60,
    maxPayloadLength: 15000000,
    sendPingsAutomatically: true,
    closeOnBackpressureLimit: true
}).any("/*", (res, req) => {
    const path = decodeURIComponent(req.getUrl());
    const method = req.getCaseSensitiveMethod();
    if (path.startsWith("/__Zetta_/")) {
        eio.handleRequest(res, req);
        return;
    }
    switch (req.getCaseSensitiveMethod()) {
        case "GET":
        case "HEAD":
            break;
        case "OPTIONS":
            res.writeStatus("200").writeHeader("Allow", "GET, HEAD, OPTIONS").end();
            return;
        default:
            res.writeStatus("405")
                .writeHeader("Allow", "GET, HEAD, OPTIONS")
                .writeHeader("Content-Type", "text/plain")
                .end("405 Method Not Allowed", true);
            return;
    }
    const file = getFilePath(path);
    if (file == null) {
        res.writeStatus("404").writeHeader("Content-Type", "text/plain").end("404 Not Found");
        return;
    }
    res.writeStatus("200").writeHeader("Content-Type", getMimeType(file))
        .writeHeader("Referrer-Policy", "no-referrer")
        .writeHeader("Permissions-Policy", "camera=(), gyroscope=(), microphone=(), geolocation=(), local-fonts=(), magnetometer=(), accelerometer=(), idle-detection=(), storage-access=(), browsing-topics=(), display-capture=(), encrypted-media=(), compute-pressure=(), window-management=(), xr-spatial-tracking=(), attribution-reporting=()")
        .writeHeader("X-Content-Type-Options", "img-src 'self' data:; base-uri 'self'; font-src 'self'; child-src 'self'; frame-src 'self'; media-src 'self'; style-src 'self'; object-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'; default-src 'self'; manifest-src 'self'; sandbox allow-scripts allow-same-origin; upgrade-insecure-requests")
        .writeHeader("Cross-Origin-Opener-Policy", "same-origin")
        .writeHeader("Cross-Origin-Embedder-Policy", "require-corp");
    const size = fs.statSync(file, { bigint: false, throwIfNoEntry: true }).size;
    if (method === "HEAD" || size === 0) {
        res.endWithoutBody(size);
        return;
    }
    const controller = new AbortController();
    const signal = controller.signal;
    res.onAborted(() => {
        controller.abort("client disconnected");
    });
    fs.readFile(file, { signal: signal }, (err, data) => {
        if (err != null) {
            if (!signal.aborted)
                res.close();
            console.error("HTTP Handler Error: Failed to read file: ", err);
        }
        res.end(data);
    });
}).listen("0.0.0.0", 9997, () => {
    console.log("HTTP server started!");
});
//////////////////////////////////////////////////
// socket.io
//////////////////////////////////////////////////
const eio = new Engine({
    transports: ["polling", "websocket"],
    pingTimeout: 10000,
    pingInterval: 15000,
    upgradeTimeout: 10000,
    httpCompression: true,
    perMessageDeflate: true,
    maxHttpBufferSize: 4096
});
eio.on("connection", (socket) => {
    let thread;
    socket.on("close", () => {
        if (thread != null) {
            thread.postMessage(Buffer.of(0, 0 /* MessageID.stop */));
            thread.removeAllListeners();
            socket.removeAllListeners("close");
            socket.removeAllListeners("message");
        }
        socket.close(true);
    });
    socket.on("message", (e) => {
        switch (e[0]) {
            case 2:
                if (thread != null)
                    thread.postMessage(e);
                break;
            case 1:
                if (thread == null) {
                    try {
                        const data = JSON.parse(e.toString("utf-8", 1, e.byteLength));
                        if (data == null || typeof data !== "object") {
                            socket.close(true);
                            return;
                        }
                        const dataDir = "./local/sessions/" + process.hrtime.bigint().toString(36);
                        const mThread = new worker.Worker(Path.join(import.meta.dirname, "worker.js"), {
                            env: env,
                            name: "Handler",
                            argv: [dataDir],
                            eval: false,
                            stdin: false,
                            stdout: false,
                            stderr: false,
                            workerData: data,
                            resourceLimits: {
                                stackSizeMb: 2,
                                codeRangeSizeMb: 16,
                                maxOldGenerationSizeMb: 512,
                                maxYoungGenerationSizeMb: 16
                            }
                        });
                        mThread.on("message", (msg) => {
                            socket.send(msg, { compress: true });
                        });
                        mThread.on("error", (err) => {
                            console.error("Worker Error: ", err);
                            mThread.removeAllListeners();
                            thread = void 0;
                            if (fs.existsSync(dataDir)) {
                                // manual cleanup is required since the worker did not exit properly
                                fs.rm(dataDir, {
                                    force: true,
                                    recursive: true,
                                    maxRetries: 5,
                                    retryDelay: 500
                                }, (err) => {
                                    if (err != null)
                                        console.error("Worker Error: Failed to cleanup session directory: ", err);
                                });
                            }
                        });
                        mThread.on("exit", (code) => {
                            mThread.removeAllListeners();
                            thread = void 0;
                            if (code !== 0) {
                                console.error("Worker Error: Worker exited with error code: ", code);
                                if (fs.existsSync(dataDir)) {
                                    fs.rm(dataDir, {
                                        force: true,
                                        recursive: true,
                                        maxRetries: 5,
                                        retryDelay: 500
                                    }, (err) => {
                                        if (err != null)
                                            console.error("Worker Error: Failed to cleanup session directory: ", err);
                                    });
                                }
                            }
                        });
                        thread = mThread;
                    }
                    catch (err) {
                        console.error("Worker Setup Error: Failed to start worker thread: ", err);
                    }
                }
                break;
            default:
                socket.close(true);
                break;
        }
    });
});
//////////////////////////////////////////////////
// Error Handlers
//////////////////////////////////////////////////
process.on("SIGHUP", handleSignal);
process.on("SIGINT", handleSignal);
process.on("SIGTERM", handleSignal);
process.on("SIGQUIT", handleSignal);
process.on("uncaughtException", (error, origin) => {
    stderr.write("Uncaught error: " + origin + "\n");
    console.error(error);
});
process.on("unhandledRejection", () => {
    // ignore
});
