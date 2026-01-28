/**
 * Text accumulator for stream events
 * Manages accumulation of text parts by ID and provides delta extraction
 */

import type { TextPart } from "./types.js";

/**
 * Accumulates text from streaming message parts.
 * Tracks multiple parts by ID and provides delta text between updates.
 */
export class TextAccumulator {
	private readonly parts = new Map<string, string>();
	private _firstTextReceived = false;

	/**
	 * Whether any text has been received
	 */
	get hasReceivedText(): boolean {
		return this._firstTextReceived;
	}

	/**
	 * Accumulate text from a message part and return the delta (new text only).
	 * Returns null if the part should be skipped (non-text, no ID, no text).
	 */
	accumulatePart(part: TextPart): string | null {
		if (part.type !== "text" || !part.text || !part.id) {
			return null;
		}

		const partId = part.id;
		const prevText = this.parts.get(partId) ?? "";
		this.parts.set(partId, part.text);

		if (!this._firstTextReceived) {
			this._firstTextReceived = true;
		}

		if (part.text.length > prevText.length) {
			return part.text.slice(prevText.length);
		}

		return null;
	}

	/**
	 * Get the full accumulated text from all parts
	 */
	getFullText(): string {
		return Array.from(this.parts.values()).join("");
	}

	/**
	 * Clear accumulated text
	 */
	clear(): void {
		this.parts.clear();
		this._firstTextReceived = false;
	}
}
