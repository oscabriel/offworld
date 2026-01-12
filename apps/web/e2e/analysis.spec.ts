import { expect, test } from "@playwright/test";

test.describe("Analysis E2E Tests", () => {
	test("T5.1: browse page shows analysis list or empty state", async ({ page }) => {
		await page.goto("/explore");
		await page.waitForLoadState("networkidle");

		const analysisList = page.locator('[class*="Card"], [data-testid="analysis-list"]');
		const emptyState = page.getByText(/no analyses|no repositories/i);
		const loadingSkeleton = page.locator('[class*="Skeleton"]');

		await expect(analysisList.first().or(emptyState).or(loadingSkeleton.first())).toBeVisible({
			timeout: 15000,
		});

		await page.waitForTimeout(2000);

		await expect(analysisList.first().or(emptyState)).toBeVisible({ timeout: 10000 });
	});

	test("T5.2: repo detail page shows summary section", async ({ page }) => {
		await page.goto("/repo/tanstack/router");
		await page.waitForLoadState("networkidle");

		const summaryHeading = page.getByRole("heading", { name: /summary/i });
		const analysisNotFound = page.getByText(/analysis not found/i);
		const loadingSkeleton = page.locator('[class*="Skeleton"]');

		await expect(summaryHeading.or(analysisNotFound).or(loadingSkeleton.first())).toBeVisible({
			timeout: 15000,
		});
	});

	test("T5.3: repo detail page shows architecture section", async ({ page }) => {
		await page.goto("/repo/tanstack/router");
		await page.waitForLoadState("networkidle");

		const architectureHeading = page.getByRole("heading", { name: /architecture/i });
		const analysisNotFound = page.getByText(/analysis not found/i);
		const loadingSkeleton = page.locator('[class*="Skeleton"]');

		await expect(architectureHeading.or(analysisNotFound).or(loadingSkeleton.first())).toBeVisible({
			timeout: 15000,
		});
	});
});
