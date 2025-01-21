declare global {
	export type nul = null | void | undefined;
	export type globalThis = typeof globalThis;
	export interface Window extends Record<any, any>, globalThis {
	}

	export interface PageInfo {
		url: string;
		title: string;
		favicon: string;
	}
	export interface SessionInfo {
		readonly width: number;
		readonly height: number;
	}

	export const enum MessageID {
		// client to server
		// stop = "\x00",
		// event = "\x01",
		// newtab = "\x02",
		// back = "\x03",
		// forward = "\x04",
		// refresh = "\x05",
		// focustab = "\x06",
		// closetab = "\x07",
		// navigate = "\x08",

		// server to client
		url = "0",
		ready = "1",
		tabopen = "2",
		tabinfo = "3",
		tabclose = "4"
	}
}

export { };