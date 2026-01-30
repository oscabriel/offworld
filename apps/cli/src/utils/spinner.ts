import * as p from "@clack/prompts";

export interface SpinnerLike {
	start(message?: string): void;
	stop(message?: string): void;
	message(message: string): void;
}

class NoOpSpinner implements SpinnerLike {
	start(_message?: string): void {}
	stop(_message?: string): void {}
	message(_message: string): void {}
}

export interface CreateSpinnerOptions {
	/** If true, returns a no-op spinner regardless of TTY status */
	silent?: boolean;
}

/**
 * Creates a spinner that works in both TTY and non-TTY environments.
 * In TTY: returns a real @clack/prompts spinner with animation
 * In non-TTY: returns a no-op spinner that outputs nothing
 *
 * This prevents garbage output when running in non-interactive environments
 * (CI, piped output, agent sessions).
 */
export function createSpinner(options: CreateSpinnerOptions = {}): SpinnerLike {
	if (options.silent) {
		return new NoOpSpinner();
	}
	if (process.stdout.isTTY) {
		return p.spinner();
	}
	return new NoOpSpinner();
}

/**
 * Check if running in a TTY environment
 */
export const isTTY = process.stdout.isTTY ?? false;
