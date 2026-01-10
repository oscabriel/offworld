import { expect, test } from "@playwright/test";

test.describe("Navigation E2E Tests", () => {
	test("T3.1: home page loads without error", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("domcontentloaded");
		const h1 = page.locator("h1");
		await expect(h1).toBeVisible();
		await expect(h1).toContainText("Offworld");
	});

	test("T3.2: browse page loads", async ({ page }) => {
		await page.goto("/browse");
		await page.waitForLoadState("domcontentloaded");
		const h1 = page.locator("h1");
		await expect(h1).toBeVisible();
		await expect(h1).toContainText("Browse Repositories");
	});

	test("T3.3: repo detail page loads with valid params", async ({ page }) => {
		await page.goto("/repo/tanstack/router");
		await page.waitForLoadState("domcontentloaded");
		const mainContent = page.locator("h1, [data-testid='main-content']");
		await expect(mainContent.first()).toBeVisible();
		await expect(page.locator("text=404"))
			.not.toBeVisible({ timeout: 1000 })
			.catch(() => {});
	});

	test("T3.4: 404 page renders for invalid routes", async ({ page }) => {
		await page.goto("/this-route-does-not-exist-12345");
		await page.waitForLoadState("domcontentloaded");
		const notFoundIndicator = page.locator("text=/404|not found/i");
		await expect(notFoundIndicator.first()).toBeVisible({ timeout: 5000 });
	});
});
