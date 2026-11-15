// Signed-in flows. Needs a test account in .env.test.local (E2E_EMAIL, E2E_PASSWORD); skipped otherwise.
// Uses a throwaway generated PDF and deletes it at the end. It does not create quizzes or plans,
// so no AI quota is used.
import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD in .env.test.local to run signed-in tests.");

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("e.g. name@company.com").fill(EMAIL!);
  await page.getByPlaceholder("Enter password").fill(PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** A tiny valid one-page PDF with selectable text. */
function testPdf(title: string) {
  const text = `BT /F1 18 Tf 72 720 Td (${title}) Tj ET`;
  const objs = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offs[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offs.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

test.describe.configure({ mode: "serial" });

test("dashboard loads with real stats", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
  await expect(page.getByText("Documents", { exact: true })).toBeVisible();
});

test("every section opens from the navigation", async ({ page, isMobile }) => {
  await signIn(page);
  for (const [label, heading] of [
    ["My PDFs", "My PDFs"],
    ["Quiz History", "Quiz History"],
    ["Study Planner", "Study Planner"],
    ["Settings", "Account Settings"],
    ["Dashboard", /Good (morning|afternoon|evening)/],
  ] as const) {
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: label, exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("search finds a page and opens it", async ({ page }) => {
  await signIn(page);
  await page.keyboard.press("Control+k");
  const box = page.getByRole("dialog", { name: "Search" });
  await expect(box).toBeVisible();
  await box.getByRole("textbox", { name: "Search" }).fill("planner");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/study-planner$/);
});

test("notifications panel opens", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
});

test("planner views switch", async ({ page }) => {
  await signIn(page);
  await page.goto("/study-planner");
  const noPlans = page.getByRole("heading", { name: "No Study Plans Yet" });
  if (await noPlans.isVisible().catch(() => false)) test.skip(true, "No study plans to show views for.");
  for (const view of ["Board", "Timeline", "Calendar"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Month", exact: true })).toBeVisible();
});

test("upload a PDF, then delete it", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Runs once, on desktop.");
  await signIn(page);
  await page.goto("/pdfs");
  const title = `e2e-${Date.now()}`;
  await page.locator('input[type="file"]').setInputFiles({ name: `${title}.pdf`, mimeType: "application/pdf", buffer: testPdf(title) });
  const card = page.getByText(title, { exact: true }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });

  page.once("dialog", (d) => d.accept()); // confirm the delete prompt
  await page.getByRole("button", { name: `Delete ${title}` }).click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0, { timeout: 15_000 });
});
