// Start the local backend with frontend/dist built, then run: node scripts/test_studio.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true });
const base = process.env.ALGOARENA_TEST_URL ?? "http://127.0.0.1:8000";
await mkdir("reports", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1586, height: 992 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByLabel("generations", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Lancer", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".status-label strong")?.textContent ===
      "Résultats disponibles",
    null,
    { timeout: 60000 },
  );
  await page.locator(".pareto-point").last().press("Enter");
  const before = await page.locator(".solution-metrics").innerText();
  await page.getByRole("button", { name: "Recherche", exact: true }).click();
  assert.equal(
    await page.locator(".solution-metrics").innerText(),
    before,
    "mode switch changed results",
  );
  await page.getByRole("button", { name: "Présenter", exact: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".studio.presentation").count(), 0);
  await page.getByRole("button", { name: "Explorer", exact: true }).click();
  await page.screenshot({ path: "reports/studio-desktop.png" });
  for (const viewport of [
    { width: 1586, height: 992 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    assert(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
      "desktop page scroll",
    );
  }
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Manifeste reproductible/ }).click();
  assert((await downloaded).suggestedFilename().endsWith(".json"));
  await page.getByRole("button", { name: "Scénario", exact: true }).click();
  await page.getByRole("button", { name: /Simulation edge/ }).click();
  await page
    .locator(".inspector-config label")
    .filter({ hasText: "Générations" })
    .locator("input")
    .fill("2");
  await page.getByRole("button", { name: "Lancer", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".status-label strong")?.textContent ===
      "Résultats disponibles",
    null,
    { timeout: 60000 },
  );
  await page.locator(".pareto-point").last().press("Enter");
  await page.locator(".gantt-row").first().waitFor();
  assert.equal(await page.locator(".gantt-row").count(), 12);
  await page.screenshot({ path: "reports/studio-scenario.png" });
  await page.getByRole("button", { name: "Statistiques", exact: true }).click();
  await page
    .getByLabel("Budget demandé par exécution (évaluations)")
    .fill("120");
  await page
    .getByRole("button", { name: "Lancer la campagne", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Exporter la campagne complète · JSON",
      exact: true,
    })
    .waitFor({ timeout: 60000 });
  assert.equal(
    await page.getByText("Budget respecté", { exact: true }).count(),
    5,
  );
  await page.getByRole("button", { name: "Pareto", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile horizontal overflow",
  );
  await page.screenshot({ path: "reports/studio-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "Studio E2E passed: benchmark, modes, presentation, export, scenario/Pareto/Gantt, campaign, desktop and mobile.",
  );
} finally {
  await browser.close();
}
