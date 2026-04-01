import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = process.env.VISUAL_PORT ?? "4173";
const host = process.env.VISUAL_HOST ?? "127.0.0.1";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function waitForUrl(url, retries = 30) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  try {
    const existing = await fetch(`http://${host}:${port}`);
    if (existing.ok) {
      await run("node", ["scripts/visual-regression.mjs"], {
        env: {
          ...process.env,
          VISUAL_BASE_URL: `http://${host}:${port}`,
          VISUAL_BASELINE_NAME: process.env.VISUAL_BASELINE_NAME ?? "ci-baseline",
        },
      });
      return;
    }
  } catch {
    // no existing preview server, continue to spawn one
  }

  const preview = spawn(
    "npm",
    ["run", "preview", "--", "--host", host, "--port", port],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    },
  );

  try {
    await waitForUrl(`http://${host}:${port}`);
    await run("node", ["scripts/visual-regression.mjs"], {
      env: {
        ...process.env,
        VISUAL_BASE_URL: `http://${host}:${port}`,
        VISUAL_BASELINE_NAME: process.env.VISUAL_BASELINE_NAME ?? "ci-baseline",
      },
    });
  } finally {
    preview.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
