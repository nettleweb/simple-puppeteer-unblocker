# Simple Puppeteer Unblocker
A simple embeddable in-browser proxy based on [Puppeteer](https://github.com/puppeteer/puppeteer). A demo version is available on the [NettleWeb Apps website](https://nettleweb.com/apps). Change the mode to 'Puppeteer' to use.

## Website Compatibility
**Supports more than 99.9% of the popular websites** - Since the proxy runs a headless Chromium browser on the server-side and pipes the screen buffer to the client, all the websites that function correctly in the Chrome browser should work within the proxy. This includes Facebook, Instagram, which are not supported by most URL-rewriting based proxy.

## Self Hosting Guide
To deploy this project onto your own server, simply follow the steps below:
1. Ensure your server has at least 8GB of RAM. Operating systems can be Windows, Linux, or any OS that supports the latest version of Node.js.
2. Install Node.js onto your server if you haven't done so already. The version should be 18.17.1 or later, check with command line `node -v` to confirm.
3. Install Google Chrome onto your server if you haven't done so already. The latest version is recommended in most cases. The browser must be installed system-wide, portable versions won't work.
4. Clone this repository using the `git` CLI or simply download and extract the source code ZIP file.
5. In the project source's root directory, open a terminal and run the following commands:
```
npm install
```
```
npm run build
```
```
node .
```
6. The server should now be started at `http://0.0.0.0:9801`. Now you can configure port-forwarding and firewall rules to make it accessible on the internet.
7. (Optional) Install [pm2](https://www.npmjs.com/package/pm2) to start the service automatically on system startup. For detailed instructions, please follow pm2's official documentation.

## Known Issues
- **Unable to sign in into Google accounts** - Some websites like Google explicitly detect Puppeteer-controlled browsers and prevent you from using certain services. Some Puppeteer users claimed that using a [stealth extension](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth) could be a workaround, but it has not been included here due to the excess overhead associated with extra plugins.
- **The frame rate is too low to play certain games** - As the proxy sends the screen buffer of the browser to the client by calling Puppeteer's screenshot API, the frame rate is limited to prevent some other issues. You can increase the frame rate by re-adjusting the timeout set at the last few lines of `src/worker.ts`. High frame rate could cause even more lag under poor network connection.

## License
All code and files within this repository are licensed under the MIT License. You are free to modify or redistribute this project under the terms stated in `LICENSE.md`.
