import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultFixture = path.join(__dirname, "../public/examples/test_5s.mcap");
const fixturePath = process.env.ROSVIEW_TEST_MCAP ?? defaultFixture;
const hasMcapFixture = existsSync(fixturePath);

test.describe("transport fallback", () => {
  test.beforeEach(() => {
    test.skip(
      !hasMcapFixture,
      `Missing MCAP fixture: copy to public/examples/test_5s.mcap or set ROSVIEW_TEST_MCAP (current ${fixturePath})`,
    );
  });

  test("exposes selected transport mode on dockview shell", async ({ page }) => {
    await page.goto("/?url=/examples/test_5s.mcap");
    await expect(page.getByTestId("rosview-dockview")).toContainText("/camera/", { timeout: 30_000 });
    await expect(page.getByTestId("rosview-dockview")).toHaveAttribute("data-transport-mode", /^(sab|transfer|comlink)$/);
  });

  test("query parameter forces transfer mode", async ({ page }) => {
    await page.goto("/?url=/examples/test_5s.mcap&transport=transfer");
    await expect(page.getByTestId("rosview-dockview")).toContainText("/camera/", { timeout: 30_000 });
    await expect(page.getByTestId("rosview-dockview")).toHaveAttribute("data-transport-mode", "transfer");
  });

  test("query parameter forces comlink mode", async ({ page }) => {
    await page.goto("/?url=/examples/test_5s.mcap&transport=comlink");
    await expect(page.getByTestId("rosview-dockview")).toContainText("/camera/", { timeout: 30_000 });
    await expect(page.getByTestId("rosview-dockview")).toHaveAttribute("data-transport-mode", "comlink");
  });
});

