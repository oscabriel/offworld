/**
 * Test mocks index
 * Re-exports all mock utilities for easy importing in tests
 */

// Git command mocks
export {
	createExecSyncMock,
	configureGitMock,
	resetGitMock,
	mockChildProcess,
	type GitMockConfig,
} from "./git.js";

// Fetch API mocks
export {
	createFetchMock,
	addFetchRoute,
	clearFetchRoutes,
	resetFetchMock,
	installFetchMock,
	mockOffworldPullResponse,
	mockOffworldCheckResponse,
	mockGitHubStarsResponse,
	mockOpenCodeHealthResponse,
	type FetchResponse,
	type FetchMockRoute,
} from "./fetch.js";

// File system mocks
export {
	initVirtualFs,
	addVirtualFile,
	removeVirtualFile,
	clearVirtualFs,
	getVirtualFs,
	createFsMock,
	createFsPromisesMock,
	installFsMocks,
	type VirtualFile,
	type VirtualFileSystem,
} from "./fs.js";
