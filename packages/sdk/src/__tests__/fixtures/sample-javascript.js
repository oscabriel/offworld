/**
 * Sample JavaScript file with various import patterns for testing
 */

// ES6 imports
import { readFile, writeFile } from "fs/promises";
import path from "path";

// CommonJS require (should also be detected)
const express = require("express");
const { Router } = require("express");

// Dynamic require
const dynamicModule = require(`./dynamic-${process.env.NODE_ENV}`);

// Relative imports
import { config } from "./config.js";
import utils from "../utils/index.js";

// Sample usage
export async function processFile(filePath) {
	const fullPath = path.resolve(filePath);
	const content = await readFile(fullPath, "utf-8");
	return content;
}

const app = express();
const router = Router();

export { app, router };
