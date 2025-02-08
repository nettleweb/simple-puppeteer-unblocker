import fs from "fs";
import dns from "dns";
import Path from "path";
import http from "http";
import stream from "stream";
import worker from "worker_threads";
import process from "process";
import { Server, Socket } from "engine.io";

function getFilePath(path: string): string | null {
	if (fs.existsSync(path = Path.resolve(Path.join("./static/", path)))) {
		if (fs.lstatSync(path, { bigint: true, throwIfNoEntry: true }).isDirectory())
			return fs.existsSync(path = Path.join(path, "index.html")) ? path : null;
		else
			return path;
	}
	return null;
}

function getFileMimeType(path: string): string {
	switch (Path.extname(path)) {
		case ".js":
			return "text/javascript";
		case ".css":
			return "text/css";
		case ".txt":
			return "text/plain";
		case ".svg":
			return "image/svg+xml";
		case ".png":
			return "image/png";
		case ".ico":
			return "image/x-icon";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".woff2":
			return "font/woff2";
		case ".xml":
			return "application/xml";
		case ".json":
			return "application/json";
		case ".htm":
		case ".xht":
		case ".html":
		case ".xhtml":
			return "application/xhtml+xml";
		default:
			return "application/octet-stream";
	}
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
	const method = req.method;
	const headers = req.headers;
	const rawPath = req.url;
	const host = headers.host;

	if (method == null || rawPath == null || host == null || rawPath[0] !== "/") {
		res.writeHead(400, "", { "Content-Type": "text/plain" });
		res.end("400 Bad Request", "utf-8");
		return;
	}

	if (rawPath.startsWith("/%FD%BF%80%90%80%81%0A/")) {
		eio.handleRequest(req as any, res);
		return;
	}

	switch (method) {
		case "GET":
		case "HEAD":
			break;
		case "OPTIONS":
			res.writeHead(200, "", {
				"Allow": "GET, HEAD, OPTIONS"
			});
			res.end();
			return;
		default:
			res.writeHead(405, "", {
				"Allow": "GET, HEAD, OPTIONS",
				"Content-Type": "text/plain"
			});
			res.end("405 Method Not Allowed", "utf-8");
			return;
	}

	const url = new URL(rawPath, "https://nettleweb.com/");
	const path = getFilePath(url.pathname);

	if (path != null) {
		res.writeHead(200, "", {
			"Content-Type": getFileMimeType(path),
			"Content-Length": fs.statSync(path, { bigint: true, throwIfNoEntry: true }).size.toString(10),
			"Referrer-Policy": "no-referrer",
			"Permissions-Policy": "camera=(), gyroscope=(), microphone=(), geolocation=(), local-fonts=(), magnetometer=(), accelerometer=(), idle-detection=(), storage-access=(), browsing-topics=(), display-capture=(), encrypted-media=(), compute-pressure=(), window-management=(), xr-spatial-tracking=(), attribution-reporting=()",
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "img-src 'self' data:; base-uri 'self'; font-src 'self'; child-src 'self'; frame-src 'self'; media-src 'self'; style-src 'self'; object-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'; default-src 'self'; manifest-src 'self'; sandbox allow-scripts allow-same-origin; upgrade-insecure-requests",
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Resource-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp"
		});

		if (method === "HEAD") {
			res.end();
			return;
		}

		fs.createReadStream(path, {
			start: 0,
			autoClose: true,
			emitClose: true,
			highWaterMark: 32768
		}).pipe(res, { end: true });
	} else {
		res.writeHead(404, "", { "Content-Type": "text/plain" });
		res.end("404 Not Found", "utf-8");
	}
}

function handleUpgrade(req: http.IncomingMessage, sock: stream.Duplex, head: Buffer) {
	const path = req.url;
	const host = req.headers.host;

	if (path == null || host == null || path[0] !== "/") {
		sock.end("Bad Request", "utf-8");
		return;
	}

	if (path.startsWith("/%FD%BF%80%90%80%81%0A/"))
		eio.handleUpgrade(req as any, sock, head);
	else
		sock.end("Forbidden", "utf-8");
}

function handleSignal(signal: string) {
	if (Reflect.get(process, "__closing") == null) {
		stderr.write("\n\nReceived signal: " + signal + "\n");
		stderr.write("Stopping services...\n");
		Reflect.set(process, "__closing", 1);

		httpServer.closeAllConnections();
		httpServer.close((err) => {
			if (err != null)
				console.log("[Ignore]", String(err));

			process.exit(0);
		});
	}
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
	} else {
		stderr.write("Error: Invalid arguments.");
		stderr.write("Try '--help' for more information.\n");
		process.exit(1);
	}
}

//////////////////////////////////////////////////
// HTTP Server
//////////////////////////////////////////////////

const httpServer = http.createServer({
	noDelay: false,
	keepAlive: false,
	maxHeaderSize: 8192,
	requestTimeout: 15000
}, void 0);

httpServer.on("request", handleRequest);
httpServer.on("upgrade", handleUpgrade);
httpServer.on("error", (err) => {
	console.error("HTTP Server Error: ", err);
});

httpServer.listen(9801, "0.0.0.0", 255, () => {
	let address = httpServer.address() || "unknown address";
	if (typeof address !== "string")
		address = address.address + ":" + address.port;
	console.log("HTTP server started on " + address);
});

//////////////////////////////////////////////////
// socket.io
//////////////////////////////////////////////////

const eio = new Server({
	transports: ["polling", "websocket"],
	pingTimeout: 10000,
	pingInterval: 15000,
	upgradeTimeout: 10000,
	httpCompression: true,
	perMessageDeflate: true,
	maxHttpBufferSize: 1024
});

eio.on("connection", (socket: Socket) => {
	let thread: worker.Worker | undefined;

	socket.on("close", () => {
		if (thread != null) {
			thread.postMessage(Buffer.of(0, MessageID.stop));
			thread.removeAllListeners();
			socket.removeAllListeners("close");
			socket.removeAllListeners("message");
		}
		socket.close(true);
	});
	socket.on("message", (e: Buffer) => {
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
					} catch (err) {
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

// send ready signal to pm2
{
	const send = process.send;
	if (send != null)
		send("ready", void 0, { keepOpen: false });
}
