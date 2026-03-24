# Sophon - NodeJS server for GovClerkMinutes

## Prerequisites

- Node.js 22+
- Bun 1.0+ (for building)
- macOS or Linux (EC2) runtime

## Deploy

You can deploy to prod by running `npm run deploy`.  This will build and rsync the necessary code.

If setting up a server for the first time, ssh into the server and run `./setup.sh` (shipped with the deploy script above).

## Restarting Production

After you deploy a code change, you need to restart the server.  Do this with systemctl: `sudo systemctl restart sophon.service`

To see logs from the server process, use `sudo journalctl -u sophon.service -f`

## Local install

We skip the Chromium download automatically using a `preinstall` script that sets `PUPPETEER_SKIP_DOWNLOAD=1`. If you want Puppeteer to download its bundled Chromium, remove or override that env var.

On Mac for development you will need to make sure you have the right version of Chrome installed.  Easiset way is to run:

```sh
npx puppeteer browsers install chrome
```

```sh
# from this folder
npm install
```

## Build

```sh
npm run build
```

Outputs ESM to `dist/`. Run it with:

```sh
npm start
```

## Test

Runs build + integration tests (spawns the server, probes endpoints):

```sh
npm test   # bun test
```