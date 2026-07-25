import type { SourceRef } from "./types";

const SOURCE_LINE =
  /^- \*\*(s\d+)\*\* - (.*?) (https?:\/\/\S+?)(?:\s+\*\(last_checked:\s*\d{4}-\d{2}-\d{2}\)\*)?$/;

/**
 * Parse the public source registry shared by the app and export CLI.
 *
 * The optional last_checked suffix is display metadata. Keeping it out
 * of SourceRef.url prevents stale-check annotations from becoming part
 * of outbound links while preserving compatibility with legacy lines.
 */
export function parseSources(raw: string): Map<string, SourceRef> {
  const entries = new Map<string, SourceRef>();

  for (const rawLine of raw.split(/\r?\n/)) {
    const match = rawLine.trim().match(SOURCE_LINE);
    if (!match) {
      continue;
    }

    const [, id, label, url] = match;
    entries.set(id, { id, label, url });
  }

  return entries;
}
