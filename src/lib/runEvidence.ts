/**
 * Run-evidence emitter for the chip-supply-chain-map watchlist export.
 *
 * This module is the source-of-truth emitter for two artifact types:
 *
 * - Append-only Event records written as JSONL under
 *   `ops/event-ledger/<run-id>.jsonl`.
 * - Final Run records written as JSON under
 *   `ops/run-records/<run-id>.json`.
 *
 * Both records conform to the cross-repo CDCP schemas mirrored in
 * `ops/schemas-cache/event.schema.json` and
 * `ops/schemas-cache/run.schema.json` (athena-site is the source of
 * truth). The amended Run schema carries six replay-equivalence fields:
 * `prompt_snapshot_hash`, `tool_schemas_snapshot_hash`, `determinism`,
 * `checkpoint_ref`, `sandbox_image_ref`, and `gate_results_summary`.
 *
 * A Run in this repo is one execution of the deterministic watchlist
 * export pipeline: read nodes.csv + edges.csv + sources.md +
 * financial_sensitivity.csv, compute chokepoint scores, build the
 * investor watchlist risk packet, write the packet to disk. No LLM is
 * in the loop. Replay-equivalence is still meaningful here: the same
 * input bytes plus the same scoring heuristic version must produce
 * byte-equal packets, and the Run record makes that auditable.
 *
 * Field-population rules followed here:
 *
 * - `prompt_snapshot_hash`: SHA-256 of the canonicalized scoring
 *   heuristic config (LEAD_TIME_BY_TYPE, strengthWeight, scoring
 *   formula version). This is the closest analog to "prompt" in a
 *   no-LLM data pipeline: the policy that turns inputs into outputs.
 *   Always populated.
 * - `tool_schemas_snapshot_hash`: SHA-256 of the canonicalized input
 *   data surface (nodes.csv + edges.csv + sources.md +
 *   financial_sensitivity.csv contents). The input data IS the tool
 *   surface in a deterministic data pipeline. Always populated.
 * - `determinism`: omitted. There is no sampler, no seed, no
 *   temperature in a pure data pipeline. Schema absence means
 *   "deterministic by construction".
 * - `checkpoint_ref`: omitted. The pipeline runs in-process with no
 *   resumable checkpoint store.
 * - `sandbox_image_ref`: populated as
 *   `repo://chip-supply-chain-map@<HEAD-SHA>/` so a reviewer can pin
 *   replay context to the producing commit. The URI grammar lands
 *   in DEC-CDCP-014 (athena-site). Note: at first-emit the recorded
 *   SHA is the PARENT of the commit that ultimately contains the
 *   sample on disk; `scripts/finalize_sandbox_ref.py` rewrites this
 *   field to the post-commit SHA so HEAD-strict replay is satisfiable
 *   on first emit. See DEC-FIN-006 for the off-by-one fix rationale.
 *   The placeholder shape on first emit is
 *   `repo://chip-supply-chain-map@PENDING/`; the finalizer replaces
 *   PENDING with the resolved 40-char SHA.
 * - `gate_results_summary`: aggregated from `gate.check.*` events
 *   fired during the run (input-validation gate, schema-shape gate).
 *
 * The validator gate at `scripts/validate_run_evidence.py` walks both
 * directories and checks every record against the cached schemas.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// ----------------------------------------------------------------- types

export interface CanonicalInput {
  /** Logical name for the input slot (e.g. "nodes.csv"). */
  path: string;
  /** Raw file content as a string. */
  content: string;
}

export interface EventActor {
  kind: "role" | "human" | "system";
  id: string;
}

export interface EmittedEvent {
  event_id: string;
  type: string;
  created_at: string;
  actor: EventActor;
  payload: Record<string, unknown>;
  run_id?: string;
  spec_id?: string;
  artifact_id?: string;
  parent_event_id?: string;
}

export interface GateCheckEvent extends EmittedEvent {
  type: "gate.check.passed" | "gate.check.failed";
  payload: { gate_name: string } & Record<string, unknown>;
}

export interface GateResultsSummary {
  gates_passed: string[];
  gates_failed: string[];
  all_passed: boolean;
}

export interface RunEvidenceFields {
  prompt_snapshot_hash: string;
  tool_schemas_snapshot_hash: string;
  sandbox_image_ref?: string;
  gate_results_summary?: GateResultsSummary;
}

export interface BuildRunEvidenceArgs {
  /** Canonicalized scoring-heuristic config (the "prompt" analog). */
  heuristicConfig: Record<string, unknown>;
  /** Input-data files that drove the run (the "tool surface" analog). */
  inputs: CanonicalInput[];
  /** Repo path on disk; `git rev-parse HEAD` runs against this. */
  repoPath?: string;
  /** Gate events fired during the run; used to aggregate the summary. */
  gateEvents: ReadonlyArray<EmittedEvent>;
}

// ----------------------------------------------------------------- canonical hashing

/**
 * Return a stable canonical form of input files.
 *
 * Each entry serializes as `{path, content}`; the array is sorted by
 * path so the resulting hash is insensitive to declaration order.
 */
export function canonicalizeInputs(inputs: ReadonlyArray<CanonicalInput>): string {
  const sorted = [...inputs].sort((a, b) => a.path.localeCompare(b.path));
  return JSON.stringify(
    sorted.map((input) => ({ path: input.path, content: input.content }))
  );
}

/**
 * Return a stable canonical form of the heuristic configuration.
 *
 * Object keys are sorted at every nesting level so byte-equal configs
 * always produce byte-equal canonical strings.
 */
export function canonicalizeHeuristicConfig(
  config: Record<string, unknown>
): string {
  return JSON.stringify(sortKeys(config));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Lowercase hex SHA-256. Matches the Run schema's hash field pattern. */
export function computeSha256(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// ----------------------------------------------------------------- sandbox ref

/**
 * The portfolio-stable repo name for chip-supply-chain-map. The
 * repo:// URI grammar defined in DEC-CDCP-014 requires a portable
 * lowercase-kebab repo identifier here, never an absolute filesystem
 * path. This is the workspace_id and the repo segment of every
 * repo:// URI this emitter produces.
 */
export const REPO_NAME = "chip-supply-chain-map";

/**
 * Placeholder SHA the emitter records at first emit. The finalizer
 * (`scripts/finalize_sandbox_ref.py`) rewrites this to the actual
 * 40-char post-commit SHA once the data files have landed on disk.
 * The placeholder is the lowest-friction fix for the systemic
 * sandbox_image_ref off-by-one bug: emitting `git rev-parse HEAD`
 * at emit-time records the PARENT of the commit that ultimately
 * contains the sample, so HEAD-strict replay is unsatisfiable on
 * first emit. See DEC-FIN-006 for the rationale.
 */
export const PENDING_SANDBOX_SHA = "PENDING";

/**
 * Return `repo://chip-supply-chain-map@<head-sha>/` for a real git
 * repo, else `repo://chip-supply-chain-map@PENDING/` when a repoPath
 * was supplied but the git lookup failed, else undefined.
 *
 * An undefined return tells the caller to omit `sandbox_image_ref`
 * from the Run record entirely. The schema treats absence as "not
 * derivable".
 *
 * The PENDING placeholder branch is reserved for tests and for the
 * regenerate flow that splits emission from the data commit; see
 * DEC-FIN-006.
 */
export function deriveSandboxImageRef(repoPath: string | undefined): string | undefined {
  if (!repoPath) {
    return undefined;
  }
  try {
    const head = execFileSync("git", ["-C", repoPath, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000
    }).trim();
    if (!head) {
      return undefined;
    }
    return `repo://${REPO_NAME}@${head}/`;
  } catch {
    return undefined;
  }
}

/**
 * Build a placeholder sandbox_image_ref URI to record on first emit.
 *
 * Callers use this when they intend a downstream finalizer step to
 * rewrite the SHA after the regenerate commit lands. The URI
 * conforms to the repo:// grammar with PENDING in the SHA slot;
 * `finalize_sandbox_ref.py` swaps PENDING for the post-commit SHA.
 */
export function pendingSandboxImageRef(): string {
  return `repo://${REPO_NAME}@${PENDING_SANDBOX_SHA}/`;
}

/**
 * Build a `repo://chip-supply-chain-map@<sha>/<rel-path>` URI.
 *
 * The relative path is preserved as-is (forward-slash POSIX). The
 * caller is responsible for stripping the repo root from any
 * absolute path before passing it in.
 */
export function buildRepoUri(sha: string, relPath: string): string {
  // Normalize Windows separators first, then strip any leading slash
  // so the URI shape is `repo://<repo>@<sha>/<rel-path>` with exactly
  // one slash between the SHA and the relative path.
  const cleanedPath = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `repo://${REPO_NAME}@${sha}/${cleanedPath}`;
}

/**
 * Build an `artifact://chip-supply-chain-map/<id>` URI for logical
 * artifact references that are not file paths.
 */
export function buildArtifactUri(artifactId: string): string {
  return `artifact://${REPO_NAME}/${artifactId}`;
}

// ----------------------------------------------------------------- gate aggregation

/**
 * Aggregate `gate.check.passed` / `gate.check.failed` events.
 *
 * Returns undefined if the iterable carries no gate-check events so
 * the caller can omit `gate_results_summary` for runs that ran zero
 * gates.
 */
export function aggregateGateResults(
  events: ReadonlyArray<EmittedEvent>
): GateResultsSummary | undefined {
  const passed: string[] = [];
  const failed: string[] = [];
  let seenAny = false;
  for (const event of events) {
    if (!event.type || !event.type.startsWith("gate.check.")) {
      continue;
    }
    seenAny = true;
    const payload = event.payload as { gate_name?: unknown };
    const name =
      typeof payload?.gate_name === "string" && payload.gate_name
        ? payload.gate_name
        : event.type;
    if (event.type === "gate.check.passed") {
      passed.push(name);
    } else if (event.type === "gate.check.failed") {
      failed.push(name);
    }
  }
  if (!seenAny) {
    return undefined;
  }
  return { gates_passed: passed, gates_failed: failed, all_passed: failed.length === 0 };
}

// ----------------------------------------------------------------- event factory

/** RFC 3339 timestamp in UTC with second precision. */
export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Fresh UUIDv4 for use as an event_id. */
export function newEventId(): string {
  return randomUUID();
}

/** Fresh `run-<12hex>` identifier for a pipeline execution. */
export function newRunId(): string {
  return `run-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export interface MakeEventArgs {
  type: string;
  actor: EventActor;
  payload: Record<string, unknown>;
  runId?: string;
  specId?: string;
  artifactId?: string;
  parentEventId?: string;
  createdAt?: string;
}

/**
 * Build an Event record conforming to `event.schema.json`.
 *
 * Optional fields land only when supplied so the resulting object
 * matches the schema's `additionalProperties: false` constraint.
 */
export function makeEvent(args: MakeEventArgs): EmittedEvent {
  const event: EmittedEvent = {
    event_id: newEventId(),
    type: args.type,
    created_at: args.createdAt ?? nowIso(),
    actor: { kind: args.actor.kind, id: args.actor.id },
    payload: { ...args.payload }
  };
  if (args.runId !== undefined) {
    event.run_id = args.runId;
  }
  if (args.specId !== undefined) {
    event.spec_id = args.specId;
  }
  if (args.artifactId !== undefined) {
    event.artifact_id = args.artifactId;
  }
  if (args.parentEventId !== undefined) {
    event.parent_event_id = args.parentEventId;
  }
  return event;
}

// ----------------------------------------------------------------- emitters

/**
 * Append-only writer for one Event record.
 *
 * Serializes the event with sorted keys so the JSONL line is stable
 * across runs, then appends a newline.
 */
export function emitEvent(event: EmittedEvent, ledgerPath: string): void {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  const line = JSON.stringify(sortKeys(event)) + "\n";
  appendFileSync(ledgerPath, line, "utf8");
}

export interface RunRecord {
  id: string;
  spec_id: string;
  agent_id: string;
  runtime: string;
  workspace_id: string;
  started_at: string;
  finished_at?: string;
  status: "running" | "needs_review" | "done" | "failed" | "cancelled";
  inputs?: Array<{ kind: string; ref: string }>;
  outputs?: Array<{ artifact_id: string; type?: string }>;
  prompt_snapshot_hash?: string;
  tool_schemas_snapshot_hash?: string;
  determinism?: { seed?: number; temperature?: number; top_p?: number };
  checkpoint_ref?: string;
  sandbox_image_ref?: string;
  gate_results_summary?: GateResultsSummary;
}

/**
 * Final Run record writer.
 *
 * Serializes with sorted keys and two-space indentation so the file
 * is diff-friendly across runs.
 */
export function emitRun(run: RunRecord, recordPath: string): void {
  mkdirSync(dirname(recordPath), { recursive: true });
  writeFileSync(recordPath, JSON.stringify(sortKeys(run), null, 2) + "\n", "utf8");
}

// ----------------------------------------------------------------- replay fields builder

/**
 * Compute the four derivable replay-equivalence fields.
 *
 * - `prompt_snapshot_hash` and `tool_schemas_snapshot_hash` are always
 *   populated for a successful build.
 * - `sandbox_image_ref` is populated when `git rev-parse HEAD` works
 *   against `repoPath`.
 * - `gate_results_summary` is populated when at least one
 *   `gate.check.*` event fired during the run.
 *
 * `determinism` and `checkpoint_ref` are omitted by design; see the
 * field-population rules in the module docstring.
 */
export function buildRunEvidenceFields(
  args: BuildRunEvidenceArgs
): { fields: RunEvidenceFields; populated: string[] } {
  const fields: RunEvidenceFields = {
    prompt_snapshot_hash: computeSha256(canonicalizeHeuristicConfig(args.heuristicConfig)),
    tool_schemas_snapshot_hash: computeSha256(canonicalizeInputs(args.inputs))
  };
  const populated: string[] = ["prompt_snapshot_hash", "tool_schemas_snapshot_hash"];

  const sandboxRef = deriveSandboxImageRef(args.repoPath);
  if (sandboxRef !== undefined) {
    fields.sandbox_image_ref = sandboxRef;
    populated.push("sandbox_image_ref");
  }

  const summary = aggregateGateResults(args.gateEvents);
  if (summary !== undefined) {
    fields.gate_results_summary = summary;
    populated.push("gate_results_summary");
  }

  return { fields, populated };
}
