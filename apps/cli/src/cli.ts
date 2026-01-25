#!/usr/bin/env node

import { loadDevEnv } from "./env-loader.js";
import { createOwCli, version } from "./index.js";

loadDevEnv();

const cli = createOwCli();

const args = process.argv.slice(2);
if (args.length === 0) {
	cli.run({ argv: ["--help"] });
} else if (args[0] === "-v" || args[0] === "--version") {
	console.log(`offworld v${version}`);
} else {
	cli.run();
}
