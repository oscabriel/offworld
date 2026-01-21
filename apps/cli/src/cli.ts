#!/usr/bin/env node

import { loadDevEnv } from "./env-loader.js";
import { createOwCli } from "./index.js";

// Load .env for local development
loadDevEnv();

const cli = createOwCli();
cli.run();
