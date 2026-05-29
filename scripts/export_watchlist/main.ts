/**
 * Watchlist export CLI - the Run boundary for chip-supply-chain-map.
 *
 * Pipeline shape:
 *
 *   1. Read input data files (nodes.csv, edges.csv, sources.md,
 *      financial_sensitivity.csv) from disk.
 *   2. Parse into GraphData + source map + financial-sensitivity rows
 *      using the same parsers the React app uses (parseCsv, parseSources).
 *   3. Compute chokepoint scores via computeChokepointScores (same
 *      function the React app calls).
 *   4. Build the WatchlistRiskPacket via buildWatchlistRiskPacket
 *      against a configurable watchlist of node IDs.
 *   5. Format the packet (JSON or markdown) and write to the output
 *      path.
 *   6. Throughout, emit Event records to ops/event-ledger/<run-id>.jsonl
 *      and at the end write a Run record to ops/run-records/<run-id>.json.
 *
 * Determinism note: the entire pipeline is a pure function of the
 * input bytes plus the scoring heuristic version. No LLM, no random
 * seed, no network. The Run record's prompt_snapshot_hash fingerprints
 * the heuristic; tool_schemas_snapshot_hash fingerprints the input
 * data; sandbox_image_ref pins the producing commit. Replay equivalence
 * is "same canonical inputs + same code = same packet bytes" and the
 * Run record makes that claim auditable.
 *
 * CLI surface:
 *
 *   node scripts/export_watchlist.mjs \
 *     [--watchlist=id1,id2,...] \
 *     [--scenarios=id1,id2,...] \
 *     [--format=json|markdown] \
 *     [--output=path] \
 *     [--no-emit-evidence]
 *
 * The defaults pick a representative AI-accelerator watchlist (NVIDIA,
 * TSMC, ASML, SK hynix) under no active scenarios so a repeat run
 * produces byte-identical packets and Run records (modulo timestamps
 * and run_id).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../../src/lib/csv";
// financial.ts and graph.ts both top-level-import "?raw" CSV/markdown
// modules that only Vite knows how to load, so we cannot import them
// here. We import the types via /// reference of the source-of-truth
// modules and re-state the small helpers (SENSITIVITY_BANDS,
// parseSources) below so the CLI bundles cleanly under esbuild without
// pulling in the Vite raw-import side effects.
import {
  buildWatchlistRiskPacket,
  formatRiskPacket,
  type RiskPacketFormat,
  type WatchlistRiskPacket
} from "../../src/lib/riskPacket";
import {
  REPO_NAME,
  buildArtifactUri,
  buildRepoUri,
  buildRunEvidenceFields,
  emitEvent,
  emitRun,
  makeEvent,
  newEventId,
  newRunId,
  nowIso,
  pendingSandboxImageRef,
  type EmittedEvent,
  type RunRecord
} from "../../src/lib/runEvidence";
import {
  computeChokepointScores,
  strengthWeight,
  type ScoreMap
} from "../../src/lib/scoring";
import {
  NODE_TYPES,
  RELATIONS,
  STRENGTHS,
  type GraphData,
  type NodeType,
  type Relation,
  type SourceRef,
  type Strength,
  type SupplyEdge,
  type SupplyNode
} from "../../src/lib/types";

// Pulled byte-for-byte from src/lib/financial.ts; kept here because the
// source module imports a "?raw" CSV under the Vite asset pipeline.
const SENSITIVITY_BANDS = ["high", "medium", "watch"] as const;
type SensitivityBand = (typeof SENSITIVITY_BANDS)[number];

interface FinancialSensitivity {
  company: string;
  ticker: string;
  node_id: string;
  scenario_id: string;
  metric_name: string;
  metric_value: string;
  period: string;
  source_id: string;
  sensitivity_band: SensitivityBand;
  note: string;
}

// Pulled byte-for-byte from src/lib/graph.ts (parseSources only); kept
// here for the same Vite-raw-import reason.
function parseSources(raw: string): Map<string, SourceRef> {
  const entries = new Map<string, SourceRef>();
  const linePattern = /^- \*\*(s\d+)\*\* - (.*?) (https?:\/\/\S+)$/;

  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .forEach((line) => {
      const match = line.match(linePattern);
      if (!match) {
        return;
      }
      const [, id, label, url] = match;
      entries.set(id, { id, label, url });
    });

  return entries;
}

// ----------------------------------------------------------------- arg parsing

interface CliArgs {
  watchlist: string[];
  scenarios: string[];
  format: RiskPacketFormat;
  output: string;
  emitEvidence: boolean;
  repoRoot: string;
}

const DEFAULT_WATCHLIST = ["nvidia", "tsmc", "asml", "sk-hynix"];
const DEFAULT_FORMAT: RiskPacketFormat = "json";
const SCORE_HEURISTIC_VERSION = "chokepoint-score-v1";
const RUNTIME_LABEL = "chip-supply-chain-map-export";
const SPEC_ID = "specs/0002-earnings-sensitivity-overlay/";

function parseArgs(argv: string[]): CliArgs {
  // process.cwd() is the repo root because export_watchlist.mjs spawns
  // the bundled child with cwd=repo root. This avoids relying on
  // import.meta.url which points into node_modules/.tmp/ after bundling.
  const repoRoot = process.cwd();
  const args: CliArgs = {
    watchlist: DEFAULT_WATCHLIST,
    scenarios: [],
    format: DEFAULT_FORMAT,
    output: resolve(repoRoot, "ops/exports/chip-watchlist-risk-packet.json"),
    emitEvidence: true,
    repoRoot
  };
  for (const arg of argv) {
    if (arg.startsWith("--watchlist=")) {
      args.watchlist = arg
        .slice("--watchlist=".length)
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    } else if (arg.startsWith("--scenarios=")) {
      args.scenarios = arg
        .slice("--scenarios=".length)
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    } else if (arg.startsWith("--format=")) {
      const value = arg.slice("--format=".length).trim();
      if (value !== "json" && value !== "markdown") {
        throw new Error(`unknown --format value: ${value}`);
      }
      args.format = value;
    } else if (arg.startsWith("--output=")) {
      args.output = resolve(repoRoot, arg.slice("--output=".length));
    } else if (arg === "--no-emit-evidence") {
      args.emitEvidence = false;
    }
  }
  // Output extension follows format unless explicitly set.
  if (args.format === "markdown" && args.output.endsWith(".json")) {
    args.output = args.output.replace(/\.json$/, ".md");
  }
  return args;
}

// ----------------------------------------------------------------- data loading

interface PipelineInputs {
  nodesCsv: string;
  edgesCsv: string;
  sourcesMd: string;
  financialCsv: string;
  graph: GraphData;
  sources: Map<string, SourceRef>;
  financial: FinancialSensitivity[];
}

function readInputs(repoRoot: string): PipelineInputs {
  const nodesCsv = readFileSync(resolve(repoRoot, "src/data/nodes.csv"), "utf8");
  const edgesCsv = readFileSync(resolve(repoRoot, "src/data/edges.csv"), "utf8");
  const sourcesMd = readFileSync(resolve(repoRoot, "src/data/sources.md"), "utf8");
  const financialCsv = readFileSync(
    resolve(repoRoot, "src/data/financial_sensitivity.csv"),
    "utf8"
  );
  const nodes = parseCsv(nodesCsv).map(toNode);
  const edges = parseCsv(edgesCsv).map(toEdge);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const graph: GraphData = { nodes, edges, nodeById };
  const sources = parseSources(sourcesMd);
  const financial = parseCsv(financialCsv).map(toFinancialSensitivity);
  return { nodesCsv, edgesCsv, sourcesMd, financialCsv, graph, sources, financial };
}

function toNode(row: Record<string, string>): SupplyNode {
  const type = row.type as NodeType;
  if (!NODE_TYPES.includes(type)) {
    throw new Error(`Invalid node type ${row.type} for ${row.id}`);
  }
  return {
    id: row.id,
    name: row.name,
    type,
    subtype: row.subtype,
    country: row.country,
    city: row.city,
    public_ticker: row.public_ticker,
    founded: Number(row.founded),
    short_description: row.short_description,
    source_id: row.source_id
  };
}

function toEdge(row: Record<string, string>): SupplyEdge {
  const relation = row.relation as Relation;
  const strength = row.strength as Strength;
  if (!RELATIONS.includes(relation)) {
    throw new Error(`Invalid edge relation ${row.relation}`);
  }
  if (!STRENGTHS.includes(strength)) {
    throw new Error(`Invalid edge strength ${row.strength}`);
  }
  return {
    source: row.source,
    target: row.target,
    relation,
    strength,
    notes: row.notes,
    source_id: row.source_id
  };
}

function toFinancialSensitivity(row: Record<string, string>): FinancialSensitivity {
  const band = row.sensitivity_band as FinancialSensitivity["sensitivity_band"];
  if (!SENSITIVITY_BANDS.includes(band)) {
    throw new Error(
      `Invalid sensitivity band ${row.sensitivity_band} for ${row.company}`
    );
  }
  return {
    company: row.company,
    ticker: row.ticker,
    node_id: row.node_id,
    scenario_id: row.scenario_id,
    metric_name: row.metric_name,
    metric_value: row.metric_value,
    period: row.period,
    source_id: row.source_id,
    sensitivity_band: band,
    note: row.note
  };
}

// ----------------------------------------------------------------- heuristic config

/**
 * Canonical fingerprint of the scoring heuristic + packet shape.
 *
 * This is what `prompt_snapshot_hash` hashes. The fingerprint must
 * change every time the chokepoint formula or the packet shape
 * changes in a way that could alter outputs against fixed inputs.
 */
function heuristicConfig() {
  return {
    score_basis: SCORE_HEURISTIC_VERSION,
    strength_weight: { ...strengthWeight },
    packet_version: 1,
    runtime: RUNTIME_LABEL
  };
}

// ----------------------------------------------------------------- gates

interface GateCheckResult {
  name: string;
  passed: boolean;
  detail: Record<string, unknown>;
}

function runInputValidationGate(inputs: PipelineInputs): GateCheckResult {
  const reasons: string[] = [];
  if (inputs.graph.nodes.length === 0) {
    reasons.push("nodes.csv parsed to 0 nodes");
  }
  if (inputs.graph.edges.length === 0) {
    reasons.push("edges.csv parsed to 0 edges");
  }
  if (inputs.sources.size === 0) {
    reasons.push("sources.md parsed to 0 source refs");
  }
  // Every edge endpoint must resolve to a known node.
  let unresolvedEdges = 0;
  for (const edge of inputs.graph.edges) {
    if (!inputs.graph.nodeById.has(edge.source) || !inputs.graph.nodeById.has(edge.target)) {
      unresolvedEdges += 1;
    }
  }
  if (unresolvedEdges > 0) {
    reasons.push(`${unresolvedEdges} edge(s) reference unknown node IDs`);
  }
  return {
    name: "input_validation",
    passed: reasons.length === 0,
    detail: {
      node_count: inputs.graph.nodes.length,
      edge_count: inputs.graph.edges.length,
      source_count: inputs.sources.size,
      financial_record_count: inputs.financial.length,
      unresolved_edges: unresolvedEdges,
      reasons
    }
  };
}

function runPacketShapeGate(packet: WatchlistRiskPacket): GateCheckResult {
  const reasons: string[] = [];
  if (packet.version !== 1) {
    reasons.push(`packet version ${packet.version} not equal to 1`);
  }
  if (!Array.isArray(packet.watchlist)) {
    reasons.push("packet.watchlist not an array");
  }
  if (!Array.isArray(packet.evidence_sources)) {
    reasons.push("packet.evidence_sources not an array");
  }
  if (packet.summary.watched_node_count !== packet.watchlist.length) {
    reasons.push(
      `summary.watched_node_count (${packet.summary.watched_node_count}) ` +
        `disagrees with watchlist length (${packet.watchlist.length})`
    );
  }
  return {
    name: "packet_shape",
    passed: reasons.length === 0,
    detail: {
      watchlist_size: packet.watchlist.length,
      evidence_source_count: packet.evidence_sources.length,
      sensitive_link_count: packet.sensitive_links.length,
      reasons
    }
  };
}

// ----------------------------------------------------------------- main

function main(argv: string[]): number {
  const args = parseArgs(argv);
  const runId = newRunId();
  const startedAt = nowIso();
  const events: EmittedEvent[] = [];
  const ledgerPath = resolve(
    args.repoRoot,
    "ops",
    "event-ledger",
    `${runId}.jsonl`
  );
  const recordPath = resolve(
    args.repoRoot,
    "ops",
    "run-records",
    `${runId}.json`
  );

  function record(event: EmittedEvent): void {
    events.push(event);
    if (args.emitEvidence) {
      emitEvent(event, ledgerPath);
    }
  }

  const actor = { kind: "system" as const, id: RUNTIME_LABEL };

  // Step 1: read inputs.
  const inputs = readInputs(args.repoRoot);

  // Step 2: emit pipeline.start with the canonical input fingerprints.
  const heuristic = heuristicConfig();
  const canonicalInputs = [
    { path: "src/data/nodes.csv", content: inputs.nodesCsv },
    { path: "src/data/edges.csv", content: inputs.edgesCsv },
    { path: "src/data/sources.md", content: inputs.sourcesMd },
    { path: "src/data/financial_sensitivity.csv", content: inputs.financialCsv }
  ];
  const evidenceShape = buildRunEvidenceFields({
    heuristicConfig: heuristic,
    inputs: canonicalInputs,
    repoPath: args.repoRoot,
    gateEvents: [] // populated after gates run; only used to derive sandbox + hashes here.
  });

  const startEvent = makeEvent({
    type: "pipeline.start",
    actor,
    payload: {
      pipeline: "watchlist_export",
      heuristic_version: SCORE_HEURISTIC_VERSION,
      watchlist: args.watchlist,
      scenarios: args.scenarios,
      format: args.format,
      prompt_snapshot_hash: evidenceShape.fields.prompt_snapshot_hash,
      tool_schemas_snapshot_hash: evidenceShape.fields.tool_schemas_snapshot_hash,
      input_byte_counts: {
        "nodes.csv": inputs.nodesCsv.length,
        "edges.csv": inputs.edgesCsv.length,
        "sources.md": inputs.sourcesMd.length,
        "financial_sensitivity.csv": inputs.financialCsv.length
      }
    },
    runId,
    specId: SPEC_ID,
    createdAt: startedAt
  });
  record(startEvent);

  // Step 3: input-validation gate.
  const inputGate = runInputValidationGate(inputs);
  const inputGateEvent = makeEvent({
    type: inputGate.passed ? "gate.check.passed" : "gate.check.failed",
    actor,
    payload: { gate_name: inputGate.name, ...inputGate.detail },
    runId,
    specId: SPEC_ID,
    parentEventId: startEvent.event_id
  });
  record(inputGateEvent);
  if (!inputGate.passed) {
    return finalizeFailedRun(args, runId, startedAt, events, recordPath, canonicalInputs, heuristic, "input_validation_failed");
  }

  // Step 4: compute scores.
  const scores: ScoreMap = computeChokepointScores(inputs.graph, args.scenarios);
  const scoreEvent = makeEvent({
    type: "tool.call.completed",
    actor,
    payload: {
      tool_name: "computeChokepointScores",
      node_count: inputs.graph.nodes.length,
      scored_node_count: scores.size,
      active_scenarios: args.scenarios
    },
    runId,
    specId: SPEC_ID,
    parentEventId: startEvent.event_id
  });
  record(scoreEvent);

  // Step 5: build the packet.
  const packet = buildWatchlistRiskPacket({
    activeScenarioIds: args.scenarios,
    financialSensitivityRecords: inputs.financial,
    graph: inputs.graph,
    scoreBasis: SCORE_HEURISTIC_VERSION,
    scores,
    sources: inputs.sources,
    watchlistNodeIds: args.watchlist
  });
  const packetEvent = makeEvent({
    type: "tool.call.completed",
    actor,
    payload: {
      tool_name: "buildWatchlistRiskPacket",
      watched_nodes: packet.summary.watched_node_count,
      dependency_count: packet.summary.dependency_count,
      region_count: packet.summary.region_count,
      sensitive_link_count: packet.summary.sensitive_link_count,
      financial_record_count: packet.summary.financial_record_count
    },
    runId,
    specId: SPEC_ID,
    parentEventId: scoreEvent.event_id
  });
  record(packetEvent);

  // Step 6: packet-shape gate.
  const shapeGate = runPacketShapeGate(packet);
  const shapeGateEvent = makeEvent({
    type: shapeGate.passed ? "gate.check.passed" : "gate.check.failed",
    actor,
    payload: { gate_name: shapeGate.name, ...shapeGate.detail },
    runId,
    specId: SPEC_ID,
    parentEventId: packetEvent.event_id
  });
  record(shapeGateEvent);
  if (!shapeGate.passed) {
    return finalizeFailedRun(args, runId, startedAt, events, recordPath, canonicalInputs, heuristic, "packet_shape_failed");
  }

  // Step 7: write the output file.
  const output = formatRiskPacket(packet, args.format);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, output, "utf8");
  const writeEvent = makeEvent({
    type: "artifact.produced",
    actor,
    payload: {
      artifact_kind: "watchlist_risk_packet",
      artifact_path: relativeFromRepo(args.repoRoot, args.output),
      format: args.format,
      byte_count: output.length
    },
    runId,
    specId: SPEC_ID,
    parentEventId: shapeGateEvent.event_id
  });
  record(writeEvent);

  // Step 8: assemble the final Run record + emit terminal events.
  const finishedAt = nowIso();
  const finalEvidence = buildRunEvidenceFields({
    heuristicConfig: heuristic,
    inputs: canonicalInputs,
    repoPath: args.repoRoot,
    gateEvents: events
  });

  // Build the inputs URI list. The emitter records the PENDING
  // placeholder at first emit, NOT the git rev-parse HEAD result;
  // the finalizer (scripts/finalize_sandbox_ref.py) rewrites every
  // @PENDING/ token across the Run record after the data commit
  // lands. Writing the placeholder unconditionally is the systemic
  // fix for the sandbox_image_ref off-by-one bug: emitting the
  // pre-commit HEAD here would record the PARENT of the commit
  // that contains the sample. See DEC-FIN-006.
  //
  // finalEvidence.fields.sandbox_image_ref is left attached to the
  // gate.run.evidence_recorded ledger event so an auditor can see
  // which SHA the emitter observed at emit time; only the Run
  // record's authoritative sandbox_image_ref uses the placeholder.
  const sandboxRef = pendingSandboxImageRef();
  const sandboxSha = parseSandboxSha(sandboxRef);

  const run: RunRecord = {
    id: runId,
    spec_id: SPEC_ID,
    agent_id: RUNTIME_LABEL,
    runtime: RUNTIME_LABEL,
    // workspace_id is an identity string, not a file ref. Per
    // DEC-CDCP-014 + DEC-FIN-006 it carries the portable repo name.
    workspace_id: REPO_NAME,
    started_at: startedAt,
    finished_at: finishedAt,
    status: "done",
    inputs: canonicalInputs.map((entry) => ({
      kind: "dataset",
      ref: buildRepoUri(sandboxSha, entry.path)
    })),
    outputs: [
      {
        // The watchlist packet is a logical artifact (not strictly a
        // file ref). The artifact:// URI scheme covers logical ids.
        artifact_id: buildArtifactUri(`watchlist-packet@${runId}`),
        type: "watchlist_risk_packet"
      }
    ],
    prompt_snapshot_hash: finalEvidence.fields.prompt_snapshot_hash,
    tool_schemas_snapshot_hash: finalEvidence.fields.tool_schemas_snapshot_hash,
    sandbox_image_ref: sandboxRef
  };
  if (finalEvidence.fields.gate_results_summary !== undefined) {
    run.gate_results_summary = finalEvidence.fields.gate_results_summary;
  }

  const evidenceRecordedEvent = makeEvent({
    type: "gate.run.evidence_recorded",
    actor,
    payload: {
      run_id: runId,
      fields_populated: finalEvidence.populated,
      record_path: relativeFromRepo(args.repoRoot, recordPath),
      ledger_path: relativeFromRepo(args.repoRoot, ledgerPath)
    },
    runId,
    specId: SPEC_ID,
    parentEventId: writeEvent.event_id
  });
  record(evidenceRecordedEvent);

  if (args.emitEvidence) {
    emitRun(run, recordPath);
  }

  const donePayload: Record<string, unknown> = {
    status: "done",
    finished_at: finishedAt
  };
  if (run.gate_results_summary !== undefined) {
    // Clone so a downstream mutation of the event payload cannot reach
    // back into the Run record.
    donePayload.gate_results_summary = {
      gates_passed: [...run.gate_results_summary.gates_passed],
      gates_failed: [...run.gate_results_summary.gates_failed],
      all_passed: run.gate_results_summary.all_passed
    };
  }
  const doneEvent = makeEvent({
    type: "pipeline.done",
    actor,
    payload: donePayload,
    runId,
    specId: SPEC_ID,
    parentEventId: evidenceRecordedEvent.event_id,
    createdAt: finishedAt
  });
  record(doneEvent);

  console.log(
    `export_watchlist OK: run=${runId} watched=${packet.summary.watched_node_count} ` +
      `gates=${(run.gate_results_summary?.gates_passed ?? []).length}/0 ` +
      `output=${relativeFromRepo(args.repoRoot, args.output)} ` +
      `record=${relativeFromRepo(args.repoRoot, recordPath)}`
  );
  return 0;
}

function finalizeFailedRun(
  args: CliArgs,
  runId: string,
  startedAt: string,
  events: EmittedEvent[],
  recordPath: string,
  canonicalInputs: Array<{ path: string; content: string }>,
  heuristic: ReturnType<typeof heuristicConfig>,
  reason: string
): number {
  const finishedAt = nowIso();
  const finalEvidence = buildRunEvidenceFields({
    heuristicConfig: heuristic,
    inputs: canonicalInputs,
    repoPath: args.repoRoot,
    gateEvents: events
  });
  // Failure path uses the same PENDING placeholder strategy as the
  // success path so the finalizer can rewrite both shapes uniformly.
  // See DEC-FIN-006.
  const sandboxRef = pendingSandboxImageRef();
  const sandboxSha = parseSandboxSha(sandboxRef);

  const run: RunRecord = {
    id: runId,
    spec_id: SPEC_ID,
    agent_id: RUNTIME_LABEL,
    runtime: RUNTIME_LABEL,
    workspace_id: REPO_NAME,
    started_at: startedAt,
    finished_at: finishedAt,
    status: "failed",
    inputs: canonicalInputs.map((entry) => ({
      kind: "dataset",
      ref: buildRepoUri(sandboxSha, entry.path)
    })),
    prompt_snapshot_hash: finalEvidence.fields.prompt_snapshot_hash,
    tool_schemas_snapshot_hash: finalEvidence.fields.tool_schemas_snapshot_hash,
    sandbox_image_ref: sandboxRef
  };
  if (finalEvidence.fields.gate_results_summary !== undefined) {
    run.gate_results_summary = finalEvidence.fields.gate_results_summary;
  }

  const failedEvent = makeEvent({
    type: "gate.run.evidence_recorded",
    actor: { kind: "system", id: RUNTIME_LABEL },
    payload: { run_id: runId, fields_populated: finalEvidence.populated, failure_reason: reason },
    runId,
    specId: SPEC_ID,
    createdAt: finishedAt
  });
  events.push(failedEvent);
  if (args.emitEvidence) {
    emitEvent(failedEvent, resolve(args.repoRoot, "ops", "event-ledger", `${runId}.jsonl`));
    emitRun(run, recordPath);
  }
  console.error(`export_watchlist FAILED: ${reason} (run=${runId})`);
  return 1;
}

/**
 * Extract the SHA segment from a sandbox_image_ref URI.
 *
 * Accepts the new repo:// grammar
 * (`repo://chip-supply-chain-map@<sha>/`) and falls back to the
 * trailing-@<sha> shape from earlier rounds for during-migration
 * resilience. Returns `PENDING` if the URI is the placeholder shape
 * the emitter records when the finalizer has not run yet.
 */
function parseSandboxSha(sandboxImageRef: string): string {
  const repoUriMatch = /^repo:\/\/[a-z][a-z0-9-]*@([A-Za-z0-9]+)\//.exec(
    sandboxImageRef
  );
  if (repoUriMatch) {
    return repoUriMatch[1];
  }
  const atIdx = sandboxImageRef.lastIndexOf("@");
  if (atIdx >= 0) {
    return sandboxImageRef.slice(atIdx + 1);
  }
  return "PENDING";
}

function relativeFromRepo(repoRoot: string, absolutePath: string): string {
  const root = repoRoot.replace(/\\/g, "/");
  const target = absolutePath.replace(/\\/g, "/");
  if (target.startsWith(root + "/")) {
    return target.slice(root.length + 1);
  }
  return target;
}

// Avoid unused-import lint on execFileSync; it is re-exported below for the
// integration tests which call the helper directly.
export const __unused_execFileSync = execFileSync;

const exitCode = main(process.argv.slice(2));
process.exit(exitCode);
