import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  aggregateGateResults,
  buildRunEvidenceFields,
  canonicalizeHeuristicConfig,
  canonicalizeInputs,
  computeSha256,
  emitEvent,
  emitRun,
  makeEvent,
  newEventId,
  newRunId,
  nowIso,
  type EmittedEvent,
  type RunRecord
} from "./runEvidence";

// ----------------------------------------------------------------- helpers

const work = mkdtempSync(join(tmpdir(), "chip-run-evidence-"));
try {
  // -------------------------------------------------------------- canonicalization

  const inputsA = [
    { path: "nodes.csv", content: "id,name\ntsmc,TSMC\n" },
    { path: "edges.csv", content: "source,target\nasml,tsmc\n" }
  ];
  const inputsB = [
    // Same content, reversed order. The canonicalizer must sort.
    { path: "edges.csv", content: "source,target\nasml,tsmc\n" },
    { path: "nodes.csv", content: "id,name\ntsmc,TSMC\n" }
  ];
  assert.equal(
    canonicalizeInputs(inputsA),
    canonicalizeInputs(inputsB),
    "input canonicalization must be order-independent"
  );
  const inputsC = [
    { path: "nodes.csv", content: "id,name\ntsmc,TSMC\n" },
    { path: "edges.csv", content: "source,target\nasml,intel\n" }
  ];
  assert.notEqual(
    canonicalizeInputs(inputsA),
    canonicalizeInputs(inputsC),
    "different input content must produce different canonical strings"
  );

  const cfgA = { strengthWeight: { critical: 4, high: 3 }, version: 1 };
  const cfgB = { version: 1, strengthWeight: { high: 3, critical: 4 } };
  assert.equal(
    canonicalizeHeuristicConfig(cfgA),
    canonicalizeHeuristicConfig(cfgB),
    "heuristic config canonicalization must be key-order independent"
  );

  // -------------------------------------------------------------- SHA-256 format

  const hash = computeSha256("hello chip-supply-chain-map");
  assert.match(hash, /^[a-f0-9]{64}$/, "sha256 must be lowercase hex 64 chars");
  assert.equal(
    computeSha256("hello chip-supply-chain-map"),
    hash,
    "sha256 must be stable across calls"
  );

  // -------------------------------------------------------------- gate aggregation

  const passedEvent: EmittedEvent = {
    event_id: newEventId(),
    type: "gate.check.passed",
    created_at: nowIso(),
    actor: { kind: "system", id: "test" },
    payload: { gate_name: "input_validation" }
  };
  const failedEvent: EmittedEvent = {
    event_id: newEventId(),
    type: "gate.check.failed",
    created_at: nowIso(),
    actor: { kind: "system", id: "test" },
    payload: { gate_name: "schema_shape" }
  };
  const summary = aggregateGateResults([passedEvent, failedEvent]);
  assert.deepEqual(summary, {
    gates_passed: ["input_validation"],
    gates_failed: ["schema_shape"],
    all_passed: false
  });
  const empty = aggregateGateResults([]);
  assert.equal(empty, undefined, "empty event list yields undefined summary");
  const onlyPassed = aggregateGateResults([passedEvent]);
  assert.equal(onlyPassed?.all_passed, true);

  // -------------------------------------------------------------- event factory

  const evt = makeEvent({
    type: "pipeline.start",
    actor: { kind: "system", id: "test-runner" },
    payload: { trigger: "test" },
    runId: "run-deadbeef0000",
    specId: "specs/0002-earnings-sensitivity-overlay/"
  });
  assert.match(evt.event_id, /^[0-9a-f-]{36}$/);
  assert.equal(evt.type, "pipeline.start");
  assert.equal(evt.run_id, "run-deadbeef0000");
  assert.equal(evt.spec_id, "specs/0002-earnings-sensitivity-overlay/");
  assert.equal(evt.actor.kind, "system");
  assert.match(evt.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

  // -------------------------------------------------------------- JSONL emission

  const ledgerPath = join(work, "ops", "event-ledger", "run-test.jsonl");
  emitEvent(evt, ledgerPath);
  emitEvent(passedEvent, ledgerPath);
  const lines = readFileSync(ledgerPath, "utf8").split("\n").filter((l) => l);
  assert.equal(lines.length, 2, "ledger must hold both events");
  for (const line of lines) {
    const parsed = JSON.parse(line);
    assert.ok(parsed.event_id, "each line must carry event_id");
    assert.ok(parsed.type, "each line must carry type");
  }

  // -------------------------------------------------------------- Run record emission

  const runId = newRunId();
  assert.match(runId, /^run-[0-9a-f]{12}$/);
  const record: RunRecord = {
    id: runId,
    spec_id: "specs/0002-earnings-sensitivity-overlay/",
    agent_id: "chip-supply-chain-map-export",
    runtime: "chip-supply-chain-map-export",
    workspace_id: "/tmp/test-workspace",
    started_at: "2026-05-27T12:00:00Z",
    finished_at: "2026-05-27T12:00:01Z",
    status: "done",
    inputs: [{ kind: "dataset", ref: "src/data/nodes.csv" }],
    prompt_snapshot_hash: hash,
    tool_schemas_snapshot_hash: hash,
    sandbox_image_ref: "/tmp/test-workspace@deadbeef",
    gate_results_summary: {
      gates_passed: ["input_validation"],
      gates_failed: [],
      all_passed: true
    }
  };
  const recordPath = join(work, "ops", "run-records", `${runId}.json`);
  emitRun(record, recordPath);
  const parsedRecord = JSON.parse(readFileSync(recordPath, "utf8"));
  assert.equal(parsedRecord.id, runId);
  assert.equal(parsedRecord.status, "done");
  assert.deepEqual(parsedRecord.gate_results_summary, record.gate_results_summary);

  // -------------------------------------------------------------- buildRunEvidenceFields

  const built = buildRunEvidenceFields({
    heuristicConfig: cfgA,
    inputs: inputsA,
    repoPath: undefined,
    gateEvents: [passedEvent]
  });
  assert.match(built.fields.prompt_snapshot_hash, /^[a-f0-9]{64}$/);
  assert.match(built.fields.tool_schemas_snapshot_hash, /^[a-f0-9]{64}$/);
  assert.equal(built.fields.sandbox_image_ref, undefined, "missing repo path omits sandbox ref");
  assert.deepEqual(built.fields.gate_results_summary?.gates_passed, ["input_validation"]);
  assert.ok(built.populated.includes("prompt_snapshot_hash"));
  assert.ok(built.populated.includes("tool_schemas_snapshot_hash"));
  assert.ok(built.populated.includes("gate_results_summary"));
  assert.ok(!built.populated.includes("sandbox_image_ref"));

  // -------------------------------------------------------------- stability across runs

  const built2 = buildRunEvidenceFields({
    heuristicConfig: cfgB,
    inputs: inputsB,
    repoPath: undefined,
    gateEvents: [passedEvent]
  });
  assert.equal(
    built.fields.prompt_snapshot_hash,
    built2.fields.prompt_snapshot_hash,
    "same canonical config must produce identical prompt hash"
  );
  assert.equal(
    built.fields.tool_schemas_snapshot_hash,
    built2.fields.tool_schemas_snapshot_hash,
    "same canonical inputs must produce identical tool-surface hash"
  );

  console.log(
    `runEvidence.test OK: ${lines.length} ledger line(s), ${built.populated.length} field(s) populated.`
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
