import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePathCandidates = [
  path.join(__dirname, '../public/examples/episode_00004_2026_04_22_08_41_30.mcap'),
  path.join(process.cwd(), 'public/examples/episode_00004_2026_04_22_08_41_30.mcap'),
];
const fixturePath = fixturePathCandidates.find((p) => existsSync(p)) ?? fixturePathCandidates[0];
const hasFixture = existsSync(fixturePath);

if (!hasFixture) {
  console.warn(`[e2e] image-h264.spec.ts not registered: missing sample MCAP ${fixturePath}`);
}

if (hasFixture) {
test('H.264 CompressedImage decodes without error (episode mcap)', async ({ page }) => {
  await page.goto('/?url=/examples/episode_00004_2026_04_22_08_41_30.mcap', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('rosview-dockview')).toBeVisible({ timeout: 60_000 });

  const play = page.getByRole('button', { name: 'Play playback' });
  if (await play.isVisible().catch(() => false)) {
    await play.click();
  }

  await expect(page.locator('canvas')).not.toHaveCount(0, { timeout: 90_000 });

  const hasDecodeFailure = await page.getByText(/decode failed|could not be decoded/i).count();
  expect(hasDecodeFailure).toBe(0);

  // Image surface may render via OffscreenCanvas (no readable 2D on the DOM canvas); rely on worker UI + no errors above.
  const imageStatus = page.getByTestId('image-panel-status');
  if (await page.getByTestId('image-panel-canvas').isVisible().catch(() => false)) {
    await expect(imageStatus).toBeVisible({ timeout: 90_000 });
    await expect(imageStatus).toHaveText(/\d+x\d+/);
  }
});
}
