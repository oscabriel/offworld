/**
 * Sample TypeScript file with various import patterns for testing
 */

// ES6 named imports
import { useState, useEffect } from "react";
import { Router, Route } from "react-router-dom";

// Default import
import axios from "axios";

// Namespace import
import * as fs from "node:fs";

// Type-only import
import type { Config, RepoSource } from "@offworld/types";

// Relative imports
import { helper } from "./utils";
import { Component } from "../components/Component";

// Side-effect import
import "./styles.css";

// Re-export
export { useState } from "react";

// Dynamic import (should not be extracted as static import)
const loadModule = async () => {
	const mod = await import("./dynamic-module");
	return mod;
};

// Sample function using imports
export function sampleFunction(config: Config): void {
	const [state, setState] = useState<string>("");

	useEffect(() => {
		axios.get("/api/data").then((res) => {
			setState(res.data);
		});
	}, []);

	fs.readFileSync("file.txt");
}

export const constantValue = 42;
