/**
 * Generate a minimal indexed MCAP for public/examples/test_5s.mcap and Playwright.
 * Includes JSON-encoded /camera/.../compressed messages so the timeline has non-zero span.
 */
import { McapWriter } from '@mcap/core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class BufferWritable {
  /** @type {Buffer[]} */
  #chunks = [];
  /** @type {bigint} */
  #pos = 0n;

  position() {
    return this.#pos;
  }

  /** @param {Uint8Array} buffer */
  write(buffer) {
    const b = Buffer.from(buffer);
    this.#chunks.push(b);
    this.#pos += BigInt(b.byteLength);
    return Promise.resolve();
  }

  getBuffer() {
    return Buffer.concat(this.#chunks);
  }
}

const writable = new BufferWritable();
const writer = new McapWriter({ writable });

await writer.start({ profile: 'ros2', library: 'rosview-gen' });

const schemaId = await writer.registerSchema({
  name: 'sensor_msgs/msg/CompressedImage',
  encoding: 'jsonschema',
  data: new TextEncoder().encode('{"type":"object"}'),
});

const channelId = await writer.registerChannel({
  schemaId,
  topic: '/camera/top/color/image_raw/compressed',
  messageEncoding: 'json',
  metadata: new Map(),
});

const messageTimes = [1_000_000_000n, 3_000_000_000n, 5_000_000_000n];
for (const [idx, ts] of messageTimes.entries()) {
  await writer.addMessage({
    channelId,
    sequence: idx + 1,
    logTime: ts,
    publishTime: ts,
    data: new TextEncoder().encode(JSON.stringify({ format: 'jpeg', data: '' })),
  });
}

await writer.end();

const outPath = path.join(__dirname, '../public/examples/test_5s.mcap');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, writable.getBuffer());
console.log('Wrote', outPath, `(${writable.getBuffer().length} bytes)`);
