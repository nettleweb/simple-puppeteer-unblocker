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
}

export { };