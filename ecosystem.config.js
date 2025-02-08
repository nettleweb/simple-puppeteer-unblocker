export const apps = [
	{
		name: "puppeteer",
		args: [],
		time: true,
		watch: false,
		script: "./main.js",
		autostart: true,
		wait_ready: true,
		autorestart: true,
		kill_timeout: 10000,
		restart_delay: 1000
	}
];