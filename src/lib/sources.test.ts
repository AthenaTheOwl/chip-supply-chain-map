import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSources } from "./sources";

const legacy = parseSources(
  "- **s1** - Example annual report. https://example.com/report"
);
assert.deepEqual(legacy.get("s1"), {
  id: "s1",
  label: "Example annual report.",
  url: "https://example.com/report"
});

const annotated = parseSources(
  "- **s2** - Example filings. https://example.com/filings/ *(last_checked: 2026-05-31)*"
);
assert.deepEqual(annotated.get("s2"), {
  id: "s2",
  label: "Example filings.",
  url: "https://example.com/filings/"
});

const malformed = parseSources(
  [
    "- **s3** - Missing URL.",
    "- **bad** - Wrong identifier. https://example.com",
    "- **s4** - Bad date. https://example.com *(last_checked: yesterday)*"
  ].join("\n")
);
assert.equal(malformed.size, 0);

const sourceText = readFileSync(resolve("src/data/sources.md"), "utf8");
const declaredSourceLines = sourceText
  .split(/\r?\n/)
  .filter((line) => /^- \*\*s\d+\*\* - /.test(line.trim()));
const currentSources = parseSources(sourceText);

assert.ok(
  declaredSourceLines.length >= 100,
  `expected a portfolio-scale source file, got ${declaredSourceLines.length} entries`
);
assert.equal(
  currentSources.size,
  declaredSourceLines.length,
  "every declared source line should parse"
);
assert.ok(currentSources.get("s1")?.url.startsWith("https://"));

console.log(`sources tests passed (${currentSources.size} registry entries)`);
