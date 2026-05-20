import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureName = 'kaixiangzi52_2026-04-16_17-25-08_0.mcap';
const fixturePath = path.join(__dirname, '../public/examples', fixtureName);
const hasFixture = existsSync(fixturePath);

if (!hasFixture) {
  console.warn(`[e2e] ros-image-grid.spec.ts not registered: missing sample MCAP ${fixturePath}`);
}

if (hasFixture) {
test('loads the three-camera compressed image sample without empty decoder payloads', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      pageErrors.push(message.text());
    }
  });

  await page.goto(`/?url=/examples/${fixtureName}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('rosview-dockview')).toBeVisible({ timeout: 60_000 });

  const imagePanels = page.getByTestId('image-panel');
  await expect(imagePanels).toHaveCount(3, { timeout: 60_000 });
  await expect(page.getByText(/Failed to construct 'ImageDecoder'|No image data provided/i)).toHaveCount(0);

  const play = page.getByRole('button', { name: 'Play playback' });
  if (await play.isVisible().catch(() => false)) {
    await play.click();
  }

  await expect(page.getByTestId('image-panel-status')).toHaveCount(3, { timeout: 90_000 });
  const statusTexts = await page.getByTestId('image-panel-status').allTextContents();
  expect(statusTexts).toEqual(expect.arrayContaining([
    expect.stringMatching(/^\d+x\d+/),
    expect.stringMatching(/^\d+x\d+/),
    expect.stringMatching(/^\d+x\d+/),
  ]));

  await page.waitForTimeout(4_000);
  await expect(page.getByTestId('image-panel-status')).toHaveCount(3);
  await expect(page.getByText(/Image decode failed|Compressed image payload is empty|No image data provided/i)).toHaveCount(0);
  expect(pageErrors.filter((entry) => /ImageDecoder|No image data provided/i.test(entry))).toEqual([]);
});
}
