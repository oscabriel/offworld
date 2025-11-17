import * as Sentry from "@sentry/tanstackstart-react";

Sentry.init({
	dsn: process.env.VITE_SENTRY_DSN,

	// Adds request headers and IP for users
	sendDefaultPii: true,

	// Enable logs to be sent to Sentry
	enableLogs: true,

	// Set tracesSampleRate to 1.0 to capture 100%
	// of transactions for tracing.
	// We recommend adjusting this value in production
	tracesSampleRate: 1.0,

	// Set environment from NODE_ENV or default to production
	environment: process.env.NODE_ENV || "production",

	// Disable debug to avoid console pollution
	debug: false,
});
