import assert from "node:assert/strict";
import { computeFingerprint, extractPageUrl } from "./dedup.ts";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    const r = fn();
    if (r instanceof Promise) {
      r.then(
        () => {
          console.log(`  ✓ ${name}`);
          passed++;
        },
        (err) => {
          console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
          failed++;
        },
      );
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
    failed++;
  }
}

console.log("\nfingerprint normalization");

test("URL query and trailing slash dropped", () => {
  const a = computeFingerprint("https://example.com/tracker/?utm=foo", "Bug body here");
  const b = computeFingerprint("https://EXAMPLE.com/tracker", "Bug body here");
  assert.equal(a, b);
});

test("URL different paths → different fingerprints", () => {
  const a = computeFingerprint("https://example.com/tracker", "Bug body");
  const b = computeFingerprint("https://example.com/skills", "Bug body");
  assert.notEqual(a, b);
});

test("Description whitespace/case normalized", () => {
  const a = computeFingerprint("https://example.com/x", "  Hello, WORLD!  \n\nfoo");
  const b = computeFingerprint("https://example.com/x", "hello world foo");
  assert.equal(a, b);
});

test("Description beyond 200 chars ignored", () => {
  const base = "a".repeat(200);
  const a = computeFingerprint("https://example.com/x", base + "TAIL_A");
  const b = computeFingerprint("https://example.com/x", base + "TAIL_B");
  assert.equal(a, b);
});

test("Different descriptions → different fingerprints", () => {
  const a = computeFingerprint("https://example.com/x", "Save button does nothing on tracker page");
  const b = computeFingerprint("https://example.com/x", "Cannot log in with email/password");
  assert.notEqual(a, b);
});

console.log("\npageUrl extraction");

test("extracts 'Page URL: https://...'", () => {
  const url = extractPageUrl("Description: Foo\nPage URL: https://example.com/tracker\nUA: Mozilla/5.0");
  assert.equal(url, "https://example.com/tracker");
});

test("extracts 'URL: https://...' (case-insensitive)", () => {
  const url = extractPageUrl("Hit it on URL: https://example.com/skills");
  assert.equal(url, "https://example.com/skills");
});

test("returns empty when no URL line", () => {
  const url = extractPageUrl("Just text, no URL anywhere here");
  assert.equal(url, "");
});

setImmediate(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
});
