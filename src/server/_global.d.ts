declare global {
	export const enum MessageID {
		// client to server
		stop = 0,
		event = 1,
		newtab = 2,
		back = 3,
		forward = 4,
		refresh = 5,
		focustab = 6,
		closetab = 7,
		navigate = 8,

		// server to client
		url = "0",
		ready = "1",
		tabopen = "2",
		tabinfo = "3",
		tabclose = "4"
	}
}

export { };