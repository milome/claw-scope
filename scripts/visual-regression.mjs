import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:4173";
const baselineName = process.env.VISUAL_BASELINE_NAME ?? new Date().toISOString().slice(0, 10);
const outDir = path.resolve("artifacts", "visual-regression", baselineName);
const viewportWidth = Number(process.env.VISUAL_VIEWPORT_WIDTH ?? 1440);
const viewportHeight = Number(process.env.VISUAL_VIEWPORT_HEIGHT ?? 1200);

const routes = [
  { name: "profile", path: "/" },
  { name: "memory", path: "/memory" },
  { name: "config", path: "/config" },
  { name: "evolution", path: "/evolution" },
];

const themes = ["light", "dark"];

async function setTheme(page, theme) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("theme", value);
    document.documentElement.classList.toggle("dark", value === "dark");
  }, theme);
}

async function preparePage(page) {
  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
}

async function run() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    for (const theme of themes) {
      const themeDir = path.join(outDir, theme);
      await mkdir(themeDir, { recursive: true });
      for (const route of routes) {
        const context = await browser.newContext({ colorScheme: theme === "dark" ? "dark" : "light" });
        const page = await context.newPage();
        await setTheme(page, theme);
        await preparePage(page);
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle" });
        await page.screenshot({
          path: path.join(themeDir, `${route.name}.png`),
          fullPage: true,
        });
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
