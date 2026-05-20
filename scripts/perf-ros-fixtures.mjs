#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = {
    manifest: "fixtures/ros-fixtures/manifest.local.json",
    strict: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const cur = argv[i];
    if (cur === "--manifest" && i + 1 < argv.length) {
      args.manifest = argv[++i];
    } else if (cur === "--strict") {
      args.strict = true;
    }
  }
  return args;
}

function assertManifestShape(manifest) {
  if (!manifest || typeof manifest !== "object") throw new Error("manifest must be an object");
  if (!Array.isArray(manifest.datasets) || manifest.datasets.length === 0) {
    throw new Error("manifest.datasets must be a non-empty array");
  }
}

function checkDataset(dataset, index) {
  const id = dataset?.id || `dataset-${index + 1}`;
  const result = {
    id,
    sourcePath: String(dataset?.sourcePath || ""),
    exists: false,
    expectedTopics: Array.isArray(dataset?.expectedTopics) ? dataset.expectedTopics.length : 0,
    metrics: dataset?.acceptanceMetrics || {},
  };
  if (result.sourcePath.length > 0) {
    result.exists = fs.existsSync(result.sourcePath);
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv);
  const manifestPath = path.resolve(args.manifest);
  if (!fs.existsSync(manifestPath)) {
    console.error(`[perf:ros-fixtures] manifest not found: ${manifestPath}`);
    process.exitCode = 1;
    return;
  }
  const raw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  assertManifestShape(manifest);

  const checks = manifest.datasets.map(checkDataset);
  const missing = checks.filter((item) => !item.exists);
  const hasMissing = missing.length > 0;

  console.log(`[perf:ros-fixtures] manifest: ${manifestPath}`);
  console.log(`[perf:ros-fixtures] datasets: ${checks.length}`);
  for (const item of checks) {
    console.log(
      `- ${item.id}: ${item.exists ? "OK" : "MISSING"} | topics=${item.expectedTopics} | source=${item.sourcePath}`,
    );
  }

  if (hasMissing) {
    console.log("\n[perf:ros-fixtures] missing dataset files:");
    for (const item of missing) {
      console.log(`  - ${item.id}: ${item.sourcePath}`);
    }
    if (args.strict) {
      process.exitCode = 1;
      return;
    }
  }

  console.log("\n[perf:ros-fixtures] gate checklist:");
  console.log("- run npm test");
  console.log("- run npm run build");
  console.log("- run npm run perf:check -- --trace <trace.json.gz>");
  console.log("- complete docs/reliability/ROS_FIXTURE_CHECKLIST.md");
}

try {
  main();
} catch (error) {
  console.error(`[perf:ros-fixtures] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
