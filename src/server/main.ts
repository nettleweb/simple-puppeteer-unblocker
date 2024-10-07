import fs from "fs";
import dns from "dns";
import Path from "path";
import http from "http";
import worker from "worker_threads";
import process from "process";
import { Server } from "socket.io";

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
			"Referrer-Policy": "no-referrer",
			"Permissions-Policy": "camera=(), gyroscope=(), microphone=(), geolocation=(), local-fonts=(), magnetometer=(), accelerometer=(), idle-detection=(), storage-access=(), browsing-topics=(), display-capture=(), encrypted-media=(), compute-pressure=(), window-management=(), xr-spatial-tracking=(), attribution-reporting=()",
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "img-src 'self' data:; base-uri 'self'; font-src 'self'; child-src 'self'; frame-src 'self'; media-src 'self'; style-src 'self'; object-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'; default-src 'self'; manifest-src 'self'; sandbox allow-scripts allow-same-origin; upgrade-insecure-requests",
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Resource-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp"
		});

		if (method === "GET")
			res.end(fs.readFileSync(path), "utf-8");
		else
			res.end();
	} else {
		res.writeHead(404, "", { "Content-Type": "text/plain" });
		res.end("404 Not Found", "utf-8");
	}
}

function handleUpgrade(req: http.IncomingMessage, sock: import("stream").Duplex, head: Buffer) {
	const path = req.url;
	const host = req.headers.host;

	if (path == null || host == null || path[0] !== "/") {
		sock.end("Bad Request", "utf-8");
		return;
	}

	// STUB
}

function handleSignal(signal: string) {
	if (__state__ === 0) {
		__state__ = 1;
		stderr.write("\n\nReceived signal: " + signal + "\n");
		stderr.write("Stopping services...\n");

		io.disconnectSockets(true);
		process.exit(0);
	}
}

function requestCB(req: http.IncomingMessage, res: http.ServerResponse) {
	try {
		handleRequest(req, res);
	} catch (err) {
		console.error(err);
		res.writeHead(500, "", { "Content-Type": "text/plain" });
		res.end("500 Internal Server Error", "utf-8");
	}
}

function upgradeCB(req: http.IncomingMessage, sock: import("stream").Duplex, head: Buffer) {
	try {
		handleUpgrade(req, sock, head);
	} catch (err) {
		console.error(err);
		sock.end("Internal Server Error", "utf-8");
	}
}

function errorCB(err: Error) {
	console.error(err);
}

////////////////////////////////////////////////////////////
// INIT
////////////////////////////////////////////////////////////

let __state__: number = 0;
const [, , ...args] = process.argv;
const { env, stdin, stdout, stderr } = process;

for (const k of Object.getOwnPropertyNames(env))
	delete env[k];

Object.setPrototypeOf(env, null);
env["PATH"] = "/sbin:/bin";
env["HOME"] = "/tmp/user";
env["LANG"] = "C.UTF-8";
env["LC_ALL"] = "C.UTF-8";

try {
	stdin.setDefaultEncoding("utf-8");
	stdin.setEncoding("utf-8");
	stdout.setDefaultEncoding("utf-8");
	stdout.setEncoding("utf-8");
	stderr.setDefaultEncoding("utf-8");
	stderr.setEncoding("utf-8");
} catch (err) {
	// ignore
}

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

httpServer.on("request", requestCB);
httpServer.on("upgrade", upgradeCB);
httpServer.on("error", errorCB);

httpServer.listen(9801, "0.0.0.0", 255, () => {
	let address = httpServer.address() || "unknown address";
	if (typeof address !== "string")
		address = address.address + ":" + address.port;
	console.log("HTTP server started on " + address);
});

//////////////////////////////////////////////////
// socket.io
//////////////////////////////////////////////////

const io = new Server(httpServer, {
	path: "/%FD%BF%80%90%80%81%0A/",
	pingTimeout: 10000,
	pingInterval: 15000,
	connectTimeout: 20000,
	upgradeTimeout: 10000,
	httpCompression: true,
	perMessageDeflate: true,
	maxHttpBufferSize: 1024,
	destroyUpgrade: true,
	destroyUpgradeTimeout: 1000,
	cleanupEmptyChildNamespaces: true
});
io.on("connection", (socket) => {
	let endSession: (() => void) | null = null;

	socket.on("disconnect", () => {
		if (endSession != null)
			endSession();

		socket.disconnect(true);
	});
	socket.on("es", () => {
		if (endSession != null)
			endSession();
	});

	socket.on("ns", (opt) => {
		if (endSession != null || opt == null || typeof opt !== "object") {
			socket.disconnect(true);
			return;
		}

		const { width, height, touch } = opt;
		if (typeof width !== "number" || typeof height !== "number" || typeof touch !== "boolean") {
			socket.disconnect(true);
			return;
		}

		const dataDir = "./local/sessions/" + Date.now().toString(16);
		const thread = new worker.Worker(Path.join(import.meta.dirname, "worker.js"), {
			env: env,
			name: "Handler",
			argv: ["lvl=256"],
			stdin: false,
			stdout: false,
			stderr: false,
			workerData: {
				touch: touch,
				width: width,
				height: height,
				dataDir: dataDir
			}
		});
		const callback = (...args: any[]) => {
			thread.postMessage(args);
		};

		endSession = () => {
			endSession = null;
			socket.offAny(callback);
			thread.removeAllListeners();
			thread.postMessage(["stop"]);
		};

		socket.onAny(callback);
		thread.on("message", (args) => {
			Reflect.apply(socket.emit, socket, args);
		});
		thread.on("error", (err) => {
			console.error("Worker Error: ", err);
			if (endSession != null) {
				endSession = null;
				socket.offAny(callback);
				thread.removeAllListeners();

				if (fs.existsSync(dataDir)) {
					// manual cleanup is required since the worker did not exit properly
					fs.rm(dataDir, {
						force: true,
						recursive: true,
						maxRetries: 5,
						retryDelay: 500
					}, (err) => {
						if (err != null) {
							console.error(err);
						}
					});
				}
			}
		});
		thread.on("exit", (code) => {
			if (endSession != null) {
				endSession = null;
				socket.offAny(callback);
				thread.removeAllListeners();

				if (code !== 0) {
					console.error("Worker Error: Worker exited with error code: " + code);
					if (fs.existsSync(dataDir)) {
						fs.rm(dataDir, {
							force: true,
							recursive: true,
							maxRetries: 5,
							retryDelay: 500
						}, (err) => {
							if (err != null) {
								console.error(err);
							}
						});
					}
				}
			}
		});
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
