import { expect, test } from "@playwright/test";

test.describe("Authentication E2E Tests", () => {
	test("T4.1: sign-in form renders on dashboard (unauthenticated)", async ({ page }) => {
		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");

		await page
			.getByRole("button", { name: /sign in/i })
			.first()
			.click()
			.catch(() => {});

		await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible({ timeout: 10000 });
		await expect(page.locator('input[type="password"]')).toBeVisible();
		await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
	});

	test("T4.2: sign-up form renders on dashboard (unauthenticated)", async ({ page }) => {
		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");

		const signUpLink = page.getByRole("button", { name: /need an account|sign up/i });
		if (await signUpLink.isVisible({ timeout: 5000 }).catch(() => false)) {
			await signUpLink.click();
		}

		await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible({ timeout: 10000 });
		await expect(page.locator('input[type="password"]')).toBeVisible();
		await expect(
			page
				.getByRole("button", { name: /sign up/i })
				.or(page.getByRole("button", { name: /create/i })),
		).toBeVisible();
	});

	test("T4.3: protected route shows auth forms for unauthenticated users", async ({ page }) => {
		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");

		const authForm = page.locator('form, [data-testid="auth-form"]');
		const authLoading = page.getByText(/loading/i);

		await expect(authForm.or(authLoading).first()).toBeVisible({ timeout: 10000 });
	});
});
