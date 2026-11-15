// Signed-out behaviour: no account needed.
import { expect, test } from "@playwright/test";

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/study-planner");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
});

test("a wrong password shows a friendly error", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("e.g. name@company.com").fill("nobody@example.com");
  await page.getByPlaceholder("Enter password").fill("definitely-wrong-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("alert")).toHaveText(/incorrect email or password/i);
  await expect(page).toHaveURL(/\/login$/);
});

test("forgot-password page opens and links back", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByRole("link", { name: /back to sign in/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("password field can be shown and hidden", async ({ page }) => {
  await page.goto("/login");
  const field = page.getByPlaceholder("Enter password");
  await expect(field).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(field).toHaveAttribute("type", "text");
});

test("login page has no horizontal scroll", async ({ page }) => {
  await page.goto("/login");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("login links to Create account and back", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("sign-up checks password length and match before sending anything", async ({ page }) => {
  let signupCalls = 0;
  page.on("request", (r) => r.url().includes("/auth/v1/signup") && signupCalls++);
  await page.goto("/register");
  await page.getByPlaceholder("e.g. name@company.com").fill("someone@example.com");
  await page.getByPlaceholder("At least 8 characters").fill("short");
  await page.getByPlaceholder("Repeat your password").fill("short");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByRole("alert")).toHaveText(/at least 8 characters/i);
  await page.getByPlaceholder("At least 8 characters").fill("long-enough-1");
  await page.getByPlaceholder("Repeat your password").fill("long-enough-2");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByRole("alert")).toHaveText(/do not match/i);
  expect(signupCalls).toBe(0);
});
