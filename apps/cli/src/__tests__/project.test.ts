import { describe, expect, it } from "vitest";
import { isInternalDependencyVersion } from "../handlers/project";

describe("isInternalDependencyVersion", () => {
	it("treats workspace and local path protocols as internal", () => {
		expect(isInternalDependencyVersion("workspace:*")).toBe(true);
		expect(isInternalDependencyVersion("file:../local-pkg")).toBe(true);
		expect(isInternalDependencyVersion("link:../local-pkg")).toBe(true);
		expect(isInternalDependencyVersion("portal:../local-pkg")).toBe(true);
		expect(isInternalDependencyVersion("./local-pkg")).toBe(true);
		expect(isInternalDependencyVersion("../local-pkg")).toBe(true);
		expect(isInternalDependencyVersion("/opt/local-pkg")).toBe(true);
		expect(isInternalDependencyVersion("~/local-pkg")).toBe(true);
		expect(isInternalDependencyVersion("~\\local-pkg")).toBe(true);
	});

	it("keeps semver and patch protocol dependencies external", () => {
		expect(isInternalDependencyVersion("~1.2.3")).toBe(false);
		expect(isInternalDependencyVersion("^1.2.3")).toBe(false);
		expect(isInternalDependencyVersion("1.2.3")).toBe(false);
		expect(isInternalDependencyVersion("catalog:")).toBe(false);
		expect(isInternalDependencyVersion("patch:react@18.2.0#./patches/react.patch")).toBe(false);
	});

	it("handles empty and missing values", () => {
		expect(isInternalDependencyVersion()).toBe(false);
		expect(isInternalDependencyVersion("   ")).toBe(false);
	});
});
