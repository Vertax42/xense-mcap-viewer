import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureCandidates = [
  path.join(__dirname, '../public/examples/episode_00689_2026_04_01_07_14_56.mcap'),
  path.join(process.cwd(), 'public/examples/episode_00689_2026_04_01_07_14_56.mcap'),
];
const fixturePath = fixtureCandidates.find((candidate) => existsSync(candidate)) ?? fixtureCandidates[0];
const hasFixture = existsSync(fixturePath);

if (!hasFixture) {
  console.warn(`[e2e] pose-panel.spec.ts not registered: missing sample MCAP ${fixturePath}`);
}

if (hasFixture) {
test('PoseStamped fixture exposes pose topics by schema', async ({ page }) => {
  await page.goto('/?url=/examples/episode_00689_2026_04_01_07_14_56.mcap', {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByTestId('rosview-dockview')).toBeVisible({ timeout: 60_000 });

  await expect(page.getByText('geometry_msgs/msg/PoseStamped').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('/io/pose/Left_Gripper')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('/io/pose/Right_Gripper')).toBeVisible({ timeout: 30_000 });
});
}
