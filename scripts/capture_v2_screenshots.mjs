import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "reports", "screenshots", "v2");
const appUrl = process.env.ALGOARENA_APP_URL ?? "http://localhost:5173";
const docsUrl = `file://${path.join(root, "docs", "index.html").replaceAll("\\", "/")}`;
fs.mkdirSync(outDir, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function screenshot(page, name, fullPage = true) {
  await page.screenshot({ path: path.join(outDir, name), fullPage });
}

async function clickText(page, text) {
  await page.getByText(text, { exact: false }).first().click({ timeout: 8000 });
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.removeItem("algoarena-profile");
    localStorage.setItem("algoarena-language", "fr");
    localStorage.setItem("algoarena-theme", "dark");
  });
  await page.reload({ waitUntil: "networkidle" });
  await screenshot(page, "01-premier-lancement-profils.png");

  await clickText(page, "Chercheur");
  await page.waitForLoadState("networkidle");
  await screenshot(page, "02-benchmark-labs-probleme-algorithmes.png");

  await clickText(page, "Nouveau Lab");
  await wait(500);
  await screenshot(page, "03-lab-cree-stockage-suppression.png");

  await clickText(page, "Lancer la competition");
  await wait(5000);
  await screenshot(page, "04-run-temps-reel-classement-exports.png");

  await page.mouse.wheel(0, 900);
  await wait(800);
  await screenshot(page, "05-panneaux-concurrents-et-charts.png");

  await page.getByRole("button", { name: /Simuler/i }).click();
  await wait(1000);
  await screenshot(page, "06-simulateur-edge-fog-cloud.png");

  await page.getByRole("button", { name: /Explorer/i }).click();
  await wait(1000);
  await screenshot(page, "07-explorer-v2-landscape-drawable-3d.png");

  await page.getByRole("button", { name: /Lancer l'exploration/i }).click();
  await wait(2500);
  await screenshot(page, "08-explorer-resultats-convergence.png");

  await page.getByRole("button", { name: /Tutoriel/i }).click();
  await wait(1000);
  await screenshot(page, "09-tutoriel.png");

  await page.goto(docsUrl, { waitUntil: "load" });
  await wait(1000);
  await screenshot(page, "10-github-pages-demo-statique.png");

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await wait(1000);
  await screenshot(page, "11-mobile-benchmark.png");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
