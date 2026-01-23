#!/usr/bin/env node

import { loadDevEnv } from "./env-loader.js";
import { createOwCli } from "./index.js";

loadDevEnv();

const cli = createOwCli();

const args = process.argv.slice(2);
if (args.length === 0) {
	cli.run({ argv: ["--help"] });
} else if (args[0] === "-v") {
	cli.run({ argv: ["--version"] });
} else {
	cli.run();
}
