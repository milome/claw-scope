import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:4173";
const baselineName = process.env.VISUAL_BASELINE_NAME ?? new Date().toISOString().slice(0, 10);
const outDir = path.resolve("artifacts", "visual-regression", baselineName);
const viewportWidth = Number(process.env.VISUAL_VIEWPORT_WIDTH ?? 1440);
const viewportHeight = Number(process.env.VISUAL_VIEWPORT_HEIGHT ?? 1200);
const stableGatewayUrl = process.env.VISUAL_GATEWAY_URL ?? "http://127.0.0.1:18789";

const stableStorageState = {
  theme: "light",
  oc_configured: "true",
  oc_skipped: "false",
  oc_url: stableGatewayUrl,
  oc_auth_mode: "paired_device",
  oc_auth_secret: "",
};

const routes = [
  {
    name: "profile",
    path: "/",
    ready: async (page) => {
      await page.waitForURL((url) => new URL(url).pathname === "/");
      await page.waitForSelector("text=/ClawScope|Available Agents|profile/i");
    },
  },
  {
    name: "memory",
    path: "/memory",
    ready: async (page) => {
      await page.waitForURL((url) => new URL(url).pathname === "/memory");
      await page.waitForSelector("text=/Memory Bank|记忆库|記憶庫/");
    },
  },
  {
    name: "config",
    path: "/config",
    ready: async (page) => {
      await page.waitForURL((url) => new URL(url).pathname === "/config");
      await page.waitForSelector("text=/OpenClaw Instance Connection Config|Current Instance Status|管理应用偏好与 OpenClaw 网关连接/");
    },
  },
  {
    name: "evolution",
    path: "/evolution",
    ready: async (page) => {
      await page.waitForURL((url) => new URL(url).pathname === "/evolution");
      await page.waitForSelector("text=/Evolution|进化实验|進化實驗/");
    },
  },
];

const themes = ["light", "dark"];

async function setTheme(page, theme) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("theme", value);
    document.documentElement.classList.toggle("dark", value === "dark");
  }, theme);
}

async function seedStableState(page, theme) {
  await page.addInitScript(
    ({ state, currentTheme }) => {
      Object.entries(state).forEach(([key, value]) => {
        window.localStorage.setItem(key, value);
      });
      window.localStorage.setItem("theme", currentTheme);
      document.documentElement.classList.toggle("dark", currentTheme === "dark");
    },
    {
      state: stableStorageState,
      currentTheme: theme,
    },
  );
}

async function ensureNoSetupWizard(page, routeName) {
  const wizard = page.getByText(/Welcome to ClawScope|欢迎使用 ClawScope|歡迎使用 ClawScope/);
  if (await wizard.first().isVisible().catch(() => false)) {
    throw new Error(`Route ${routeName} fell back to SetupWizard instead of stable app content`);
  }
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
        await seedStableState(page, theme);
        await setTheme(page, theme);
        await preparePage(page);
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle" });
        await route.ready(page);
        await ensureNoSetupWizard(page, route.name);
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
