/**
 * Test mocks index
 * Re-exports all mock utilities for easy importing in tests
 */

export {
	createExecSyncMock,
	configureGitMock,
	resetGitMock,
	mockChildProcess,
	type GitMockConfig,
} from "./git.js";

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
