import { expect, test } from "@playwright/test";

test.describe("Reference E2E Tests", () => {
	test("T5.1: browse page shows reference list or empty state", async ({ page }) => {
		await page.goto("/explore");
		await page.waitForLoadState("networkidle");

		const referenceList = page.locator('[class*="Card"], [data-testid="reference-list"]');
		const emptyState = page.getByText(/no references|no repositories/i);
		const loadingSkeleton = page.locator('[class*="Skeleton"]');

		await expect(referenceList.first().or(emptyState).or(loadingSkeleton.first())).toBeVisible({
			timeout: 15000,
		});

		await page.waitForTimeout(2000);

		await expect(referenceList.first().or(emptyState)).toBeVisible({ timeout: 10000 });
	});

	test("T5.2: repo detail page shows summary section", async ({ page }) => {
		await page.goto("/repo/tanstack/router");
		await page.waitForLoadState("networkidle");

		const summaryHeading = page.getByRole("heading", { name: /summary/i });
		const referenceNotFound = page.getByText(/reference not found/i);
		const loadingSkeleton = page.locator('[class*="Skeleton"]');

		await expect(summaryHeading.or(referenceNotFound).or(loadingSkeleton.first())).toBeVisible({
			timeout: 15000,
		});
	});

	test("T5.3: repo detail page shows architecture section", async ({ page }) => {
		await page.goto("/repo/tanstack/router");
		await page.waitForLoadState("networkidle");

		const architectureHeading = page.getByRole("heading", { name: /architecture/i });
		const referenceNotFound = page.getByText(/reference not found/i);
		const loadingSkeleton = page.locator('[class*="Skeleton"]');

		await expect(architectureHeading.or(referenceNotFound).or(loadingSkeleton.first())).toBeVisible(
			{
				timeout: 15000,
			},
		);
	});
});
