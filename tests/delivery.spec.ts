import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultFixture = path.join(__dirname, '../public/examples/test_5s.mcap');
const fixturePath = process.env.ROSVIEW_TEST_MCAP ?? defaultFixture;
const hasMcapFixture = existsSync(fixturePath);

test('zh UI from ?lang= query', async ({ page }) => {
  await page.goto('/?lang=zh');
  await expect(page.locator('#xense-mcap-viewer-root')).toHaveAttribute('data-language', 'zh');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xense MCAP Viewer');
});

test('zh UI from ?lang=zh-CN query (SEO-friendly)', async ({ page }) => {
  await page.goto('/?lang=zh-CN');
  await expect(page.locator('#xense-mcap-viewer-root')).toHaveAttribute('data-language', 'zh');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xense MCAP Viewer');
});

test('remote single url opens fixture', async ({ page }) => {
  test.skip(
    !hasMcapFixture,
    `Missing MCAP fixture: copy to public/examples/test_5s.mcap or set ROSVIEW_TEST_MCAP (${fixturePath})`,
  );
  await page.goto('/?url=/examples/test_5s.mcap', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('rosview-dockview')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('rosview-dockview')).toContainText('/camera/', { timeout: 30_000 });
  await expect(page.locator('nav')).toContainText('test_5s.mcap', { timeout: 15_000 });
});

test('dockview theme class follows light mode', async ({ page }) => {
  test.skip(
    !hasMcapFixture,
    `Missing MCAP fixture: copy to public/examples/test_5s.mcap or set ROSVIEW_TEST_MCAP (${fixturePath})`,
  );
  await page.goto('/?url=/examples/test_5s.mcap&theme=light');
  await expect(page.getByTestId('rosview-dockview')).toBeVisible({ timeout: 30_000 });
  const dock = page.getByTestId('rosview-dockview');
  await expect(dock).toHaveAttribute('data-dockview-chrome-theme', 'light');
  await expect(page.locator('.xense-dockview-theme-light').first()).toBeVisible();
});
