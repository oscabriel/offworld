/**
 * AST patterns for extracting symbols from source code.
 * Uses ast-grep pattern syntax with metavariables:
 * - $NAME: single identifier
 * - $$$: multiple items (rest pattern)
 * - $PATH: import path
 */

export type PatternLanguage = "typescript" | "javascript" | "python" | "rust" | "go" | "java" | "c" | "cpp" | "ruby";

/**
 * Patterns for matching function declarations
 */
export const FUNCTION_PATTERNS: Record<PatternLanguage, string[]> = {
	typescript: [
		// Regular function
		"function $NAME($$$) { $$$ }",
		"function $NAME($$$): $TYPE { $$$ }",
		// Async function
		"async function $NAME($$$) { $$$ }",
		"async function $NAME($$$): $TYPE { $$$ }",
		// Arrow function assigned to const
		"const $NAME = ($$$) => $$$",
		"const $NAME = async ($$$) => $$$",
		// Export variants
		"export function $NAME($$$) { $$$ }",
		"export function $NAME($$$): $TYPE { $$$ }",
		"export async function $NAME($$$) { $$$ }",
		"export async function $NAME($$$): $TYPE { $$$ }",
		"export const $NAME = ($$$) => $$$",
		"export const $NAME = async ($$$) => $$$",
		// Method in class (handled by class patterns)
	],
	javascript: [
		// Regular function
		"function $NAME($$$) { $$$ }",
		// Async function
		"async function $NAME($$$) { $$$ }",
		// Arrow function assigned to const/let/var
		"const $NAME = ($$$) => $$$",
		"let $NAME = ($$$) => $$$",
		"var $NAME = ($$$) => $$$",
		"const $NAME = async ($$$) => $$$",
		// Export variants
		"export function $NAME($$$) { $$$ }",
		"export async function $NAME($$$) { $$$ }",
		"export const $NAME = ($$$) => $$$",
		"export const $NAME = async ($$$) => $$$",
	],
	python: [
		// Regular function (using µ instead of $ for Python)
		"def µNAME(µµµ): µµµ",
		// Async function
		"async def µNAME(µµµ): µµµ",
	],
	rust: [
		// Regular function
		"fn $NAME($$$) { $$$ }",
		"fn $NAME($$$) -> $TYPE { $$$ }",
		// Pub variants
		"pub fn $NAME($$$) { $$$ }",
		"pub fn $NAME($$$) -> $TYPE { $$$ }",
		// Async function
		"async fn $NAME($$$) { $$$ }",
		"async fn $NAME($$$) -> $TYPE { $$$ }",
		"pub async fn $NAME($$$) { $$$ }",
		"pub async fn $NAME($$$) -> $TYPE { $$$ }",
	],
	go: [
		// Regular function
		"func $NAME($$$) { $$$ }",
		"func $NAME($$$) $TYPE { $$$ }",
		"func $NAME($$$) ($$$) { $$$ }",
		// Method (receiver)
		"func ($RECV $TYPE) $NAME($$$) { $$$ }",
		"func ($RECV $TYPE) $NAME($$$) $RET { $$$ }",
	],
	java: [
		// Methods with various modifiers
		"public $TYPE $NAME($$$) { $$$ }",
		"private $TYPE $NAME($$$) { $$$ }",
		"protected $TYPE $NAME($$$) { $$$ }",
		"public static $TYPE $NAME($$$) { $$$ }",
		"private static $TYPE $NAME($$$) { $$$ }",
		"$TYPE $NAME($$$) { $$$ }",
	],
	c: [
		"$TYPE $NAME($$$) { $$$ }",
		"static $TYPE $NAME($$$) { $$$ }",
		"inline $TYPE $NAME($$$) { $$$ }",
	],
	cpp: [
		"$TYPE $NAME($$$) { $$$ }",
		"static $TYPE $NAME($$$) { $$$ }",
		"inline $TYPE $NAME($$$) { $$$ }",
		"virtual $TYPE $NAME($$$) { $$$ }",
		"$TYPE $CLASS::$NAME($$$) { $$$ }",
	],
	ruby: [
		"def $NAME($$$) $$$ end",
		"def $NAME $$$ end",
		"def self.$NAME($$$) $$$ end",
		"def self.$NAME $$$ end",
	],
};

/**
 * Patterns for matching class declarations
 * Note: $PARENT and $IFACE metavariables are extracted for inheritance tracking
 */
export const CLASS_PATTERNS: Record<PatternLanguage, string[]> = {
	typescript: [
		"class $NAME { $$$ }",
		"class $NAME extends $PARENT { $$$ }",
		"class $NAME implements $IFACE { $$$ }",
		"class $NAME extends $PARENT implements $IFACE { $$$ }",
		// Export variants
		"export class $NAME { $$$ }",
		"export class $NAME extends $PARENT { $$$ }",
		"export class $NAME implements $IFACE { $$$ }",
		"export class $NAME extends $PARENT implements $IFACE { $$$ }",
		// Abstract class
		"abstract class $NAME { $$$ }",
		"export abstract class $NAME { $$$ }",
		"abstract class $NAME extends $PARENT { $$$ }",
		"export abstract class $NAME extends $PARENT { $$$ }",
	],
	javascript: [
		"class $NAME { $$$ }",
		"class $NAME extends $PARENT { $$$ }",
		// Export variants
		"export class $NAME { $$$ }",
		"export class $NAME extends $PARENT { $$$ }",
	],
	python: ["class µNAME: µµµ", "class µNAME(µPARENT): µµµ"],
	rust: [
		// Struct (Rust's class equivalent)
		"struct $NAME { $$$ }",
		"pub struct $NAME { $$$ }",
		"struct $NAME;",
		"pub struct $NAME;",
		// Enum
		"enum $NAME { $$$ }",
		"pub enum $NAME { $$$ }",
		// Trait (interface)
		"trait $NAME { $$$ }",
		"pub trait $NAME { $$$ }",
	],
	go: [
		// Struct (Go's class equivalent)
		"type $NAME struct { $$$ }",
		// Interface
		"type $NAME interface { $$$ }",
	],
	java: [
		"class $NAME { $$$ }",
		"class $NAME extends $PARENT { $$$ }",
		"class $NAME implements $IFACE { $$$ }",
		"class $NAME extends $PARENT implements $IFACE { $$$ }",
		"public class $NAME { $$$ }",
		"public class $NAME extends $PARENT { $$$ }",
		"public class $NAME implements $IFACE { $$$ }",
		"public class $NAME extends $PARENT implements $IFACE { $$$ }",
		// Abstract
		"abstract class $NAME { $$$ }",
		"public abstract class $NAME { $$$ }",
		"abstract class $NAME extends $PARENT { $$$ }",
		"public abstract class $NAME extends $PARENT { $$$ }",
		// Interface
		"interface $NAME { $$$ }",
		"public interface $NAME { $$$ }",
		"interface $NAME extends $IFACE { $$$ }",
		"public interface $NAME extends $IFACE { $$$ }",
	],
	c: [
		"struct $NAME { $$$ }",
		"typedef struct { $$$ } $NAME",
		"typedef struct $TAG { $$$ } $NAME",
		"enum $NAME { $$$ }",
		"typedef enum { $$$ } $NAME",
		"union $NAME { $$$ }",
	],
	cpp: [
		"class $NAME { $$$ }",
		"class $NAME : public $PARENT { $$$ }",
		"class $NAME : private $PARENT { $$$ }",
		"class $NAME : protected $PARENT { $$$ }",
		"struct $NAME { $$$ }",
		"struct $NAME : $PARENT { $$$ }",
		"namespace $NAME { $$$ }",
		"template<$$$> class $NAME { $$$ }",
	],
	ruby: [
		"class $NAME $$$ end",
		"class $NAME < $PARENT $$$ end",
		"module $NAME $$$ end",
	],
};

/**
 * Patterns for matching interface declarations (TypeScript-specific)
 */
export const INTERFACE_PATTERNS: Record<PatternLanguage, string[]> = {
	typescript: [
		"interface $NAME { $$$ }",
		"interface $NAME extends $PARENT { $$$ }",
		"export interface $NAME { $$$ }",
		"export interface $NAME extends $PARENT { $$$ }",
	],
	javascript: [],
	python: [],
	rust: [],
	go: [],
	java: [],
	c: [],
	cpp: [],
	ruby: [],
};

/**
 * Patterns for matching import statements
 */
export const IMPORT_PATTERNS: Record<PatternLanguage, string[]> = {
	typescript: [
		// Named imports
		'import { $$$ } from "$PATH"',
		"import { $$$ } from '$PATH'",
		// Default import
		'import $NAME from "$PATH"',
		"import $NAME from '$PATH'",
		// Namespace import
		'import * as $NAME from "$PATH"',
		"import * as $NAME from '$PATH'",
		// Side-effect import
		'import "$PATH"',
		"import '$PATH'",
		// Combined
		'import $NAME, { $$$ } from "$PATH"',
		"import $NAME, { $$$ } from '$PATH'",
		// Type imports
		'import type { $$$ } from "$PATH"',
		"import type { $$$ } from '$PATH'",
		'import type $NAME from "$PATH"',
		"import type $NAME from '$PATH'",
	],
	javascript: [
		// Named imports
		'import { $$$ } from "$PATH"',
		"import { $$$ } from '$PATH'",
		// Default import
		'import $NAME from "$PATH"',
		"import $NAME from '$PATH'",
		// Namespace import
		'import * as $NAME from "$PATH"',
		"import * as $NAME from '$PATH'",
		// Side-effect import
		'import "$PATH"',
		"import '$PATH'",
		// Combined
		'import $NAME, { $$$ } from "$PATH"',
		"import $NAME, { $$$ } from '$PATH'",
		// CommonJS require
		'const $NAME = require("$PATH")',
		"const $NAME = require('$PATH')",
		'const { $$$ } = require("$PATH")',
		"const { $$$ } = require('$PATH')",
	],
	python: [
		"import µNAME",
		"import µNAME as µALIAS",
		"from µPATH import µNAME",
		"from µPATH import µNAME as µALIAS",
		"from µPATH import µµµ",
	],
	rust: [
		"use $PATH;",
		"use $PATH as $NAME;",
		"use $PATH::{ $$$ };",
		"use $PATH::*;",
		"pub use $PATH;",
		"pub use $PATH::{ $$$ };",
	],
	go: ['import "$PATH"', 'import $NAME "$PATH"', "import ( $$$ )"],
	java: ["import $PATH;", "import $PATH.*;", "import static $PATH;", "import static $PATH.*;"],
	c: ['#include "$PATH"', "#include <$PATH>"],
	cpp: ['#include "$PATH"', "#include <$PATH>", "using namespace $NAME;", "using $NAME::$$$;"],
	ruby: [
		"require '$PATH'",
		'require "$PATH"',
		"require_relative '$PATH'",
		'require_relative "$PATH"',
		"load '$PATH'",
		'load "$PATH"',
	],
};

/**
 * Patterns for matching export statements (for languages with explicit exports)
 */
export const EXPORT_PATTERNS: Record<PatternLanguage, string[]> = {
	typescript: [
		// Named exports
		"export { $$$ }",
		'export { $$$ } from "$PATH"',
		"export { $$$ } from '$PATH'",
		// Default export
		"export default $EXPR",
		// Re-export all
		'export * from "$PATH"',
		"export * from '$PATH'",
		'export * as $NAME from "$PATH"',
		"export * as $NAME from '$PATH'",
		// Type exports
		"export type { $$$ }",
		'export type { $$$ } from "$PATH"',
		"export type { $$$ } from '$PATH'",
	],
	javascript: [
		// Named exports
		"export { $$$ }",
		'export { $$$ } from "$PATH"',
		"export { $$$ } from '$PATH'",
		// Default export
		"export default $EXPR",
		// Re-export all
		'export * from "$PATH"',
		"export * from '$PATH'",
		// CommonJS
		"module.exports = $EXPR",
		"module.exports.$NAME = $EXPR",
		"exports.$NAME = $EXPR",
	],
	python: [
		// Python uses __all__ for explicit exports
		"__all__ = [µµµ]",
	],
	rust: [
		// Public items are exports in Rust
		"pub mod $NAME;",
		"pub mod $NAME { $$$ }",
		"pub use $PATH;",
		"pub use $PATH::{ $$$ };",
	],
	go: [],
	java: [],
	c: [],
	cpp: [],
	ruby: [],
};

/**
 * Get the pattern language string for a given Lang value or language string
 */
export function getPatternLanguage(lang: string): PatternLanguage | null {
	const langLower = lang.toLowerCase();
	switch (langLower) {
		case "typescript":
		case "tsx":
			return "typescript";
		case "javascript":
			return "javascript";
		case "python":
			return "python";
		case "rust":
			return "rust";
		case "go":
			return "go";
		case "java":
			return "java";
		case "c":
			return "c";
		case "cpp":
			return "cpp";
		case "ruby":
			return "ruby";
		default:
			return null;
	}
}
