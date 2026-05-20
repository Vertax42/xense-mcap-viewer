import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultFixture = path.join(__dirname, '../public/examples/test_5s.mcap');
const fixturePath = process.env.ROSVIEW_TEST_MCAP ?? defaultFixture;
const hasMcapFixture = existsSync(fixturePath);

test.describe('multi-source URLs and sidebar', () => {
  test.beforeEach(() => {
    test.skip(
      !hasMcapFixture,
      `Missing MCAP fixture: copy to public/examples/test_5s.mcap or set ROSVIEW_TEST_MCAP (current ${fixturePath})`,
    );
  });

  test('single url= opens fixture', async ({ page }) => {
    await page.goto('/?url=/examples/test_5s.mcap');
    await expect(page.getByTestId('rosview-dockview')).toContainText('/camera/', { timeout: 30_000 });
    await expect(page.getByTestId('playback-loaded-range').first()).toBeVisible();
  });

  test('local file via welcome hidden file input', async ({ page }) => {
    await page.goto('/');
    await page.locator('#rosview-landing-file').setInputFiles(fixturePath);
    await expect(page.getByTestId('rosview-dockview')).toContainText('/camera/', { timeout: 30_000 });
  });
});
