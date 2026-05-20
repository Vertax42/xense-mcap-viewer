import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultFixture = path.join(__dirname, '../public/examples/episode_20260122_122345.hdf5');
const fixturePath = process.env.ROSVIEW_TEST_HDF5 ?? defaultFixture;
const hasFixture = existsSync(fixturePath);
const fixtureUrlName = path.basename(fixturePath);

// The 245 MB sample takes a while to load even over lazy ranges.
test.describe.configure({ mode: 'serial', timeout: 300_000 });

if (!hasFixture) {
  console.warn(
    `[e2e] hdf5-basic.spec.ts not registered: missing fixture public/examples/${fixtureUrlName} ` +
      `or ROSVIEW_TEST_HDF5 (${fixturePath})`,
  );
}

if (hasFixture) {
test('HDF5 sample loads and exposes synthesized ROS topics in the sidebar', async ({ page }) => {
  page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message));

  await page.goto(`/?url=/examples/${fixtureUrlName}`);

  // Once the HDF5 worker has initialized, the sidebar lists the synthesized
  // virtual topics. This is our readiness signal (the dockview shows only the
  // Welcome placeholder by default until the user pins a panel).
  await expect(page.locator('body')).toContainText('/observations/joint_states', {
    timeout: 180_000,
  });
  await expect(page.locator('body')).toContainText('/observations/images/ext1');
  await expect(page.locator('body')).toContainText('/observations/ee_pose');
  await expect(page.locator('body')).toContainText('/action');

  // Playback controls must be present once the source is ready.
  await expect(page.getByRole('button', { name: 'Play playback' })).toBeVisible();
});

test('HDF5 image topic can be opened into an Image panel', async ({ page }) => {
  await page.goto(`/?url=/examples/${fixtureUrlName}`);

  // Wait for topics to show up in the sidebar. Use getByText (text engine)
  // with an explicit string so Playwright doesn't misinterpret the leading
  // slash as a regex flag.
  const imageTopicRow = page.getByText('/observations/images/ext1', { exact: false }).first();
  await expect(imageTopicRow).toBeVisible({ timeout: 180_000 });

  // Click to add as a panel. The sidebar entry is clickable and defaults to
  // opening the Image panel for image-typed topics.
  await imageTopicRow.click();

  // The Image panel renders into a <canvas>. Wait for it.
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 45_000 });
});
}
