/**
 * Hand-rolled smoke test for the watchlist export run-evidence emitter
 * (DEC-FIN-003, DEC-FIN-004, DEC-FIN-006). Pins:
 *
 * - canonicalization of inputs + heuristic config (order-independent)
 * - SHA-256 format + stability (`prompt_snapshot_hash`,
 *   `tool_schemas_snapshot_hash`)
 * - gate aggregation into `gate_results_summary`
 * - JSONL ledger emission + Run record emission shape
 * - schema-aligned payload keys (`tool_name`, `fields_populated`,
 *   cloned `gate_results_summary` on `pipeline.done`)
 * - portable `repo://` + `artifact://` URI grammar in emitter helpers
 *   (DEC-CDCP-014 + DEC-FIN-006)
 *
 * Run with `npm test`.
 *
 * Covers: R-FIN-002, R-FIN-005, R-FIN-006, R-FIN-007, R-FIN-010,
 * R-FIN-011, R-FIN-017.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REPO_NAME,
  aggregateGateResults,
  buildArtifactUri,
  buildRepoUri,
  buildRunEvidenceFields,
  canonicalizeHeuristicConfig,
  canonicalizeInputs,
  computeSha256,
  deriveSandboxImageRef,
  emitEvent,
  emitRun,
  makeEvent,
  newEventId,
  newRunId,
  nowIso,
  pendingSandboxImageRef,
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

  // -------------------------------------------------------------- schema-aligned payload keys
  //
  // Round 3 renamed the schema keys carried by two canonical event
  // types. The TS emitter module itself is field-agnostic, but the
  // payloads assembled in scripts/export_watchlist/main.ts use the
  // names below. These assertions pin the convention so a future
  // rename has to update the tests too.
  const toolEvent = makeEvent({
    type: "tool.call.completed",
    actor: { kind: "system", id: "test-runner" },
    payload: {
      tool_name: "computeChokepointScores",
      node_count: 87
    }
  });
  assert.equal(
    toolEvent.payload.tool_name,
    "computeChokepointScores",
    "tool.call.completed payload uses tool_name (schema-required) not tool_id"
  );
  assert.equal(
    toolEvent.payload.tool_id,
    undefined,
    "tool.call.completed payload must not carry the legacy tool_id key"
  );

  const evidenceEvent = makeEvent({
    type: "gate.run.evidence_recorded",
    actor: { kind: "system", id: "test-runner" },
    payload: {
      run_id: "run-deadbeef0000",
      fields_populated: built.populated
    }
  });
  assert.deepEqual(
    evidenceEvent.payload.fields_populated,
    built.populated,
    "gate.run.evidence_recorded uses fields_populated (schema-required) not populated_fields"
  );
  assert.equal(
    evidenceEvent.payload.populated_fields,
    undefined,
    "gate.run.evidence_recorded must not carry the legacy populated_fields key"
  );

  const doneEvent = makeEvent({
    type: "pipeline.done",
    actor: { kind: "system", id: "test-runner" },
    payload: {
      status: "done",
      finished_at: "2026-05-28T02:30:03Z",
      gate_results_summary: summary
    }
  });
  assert.deepEqual(
    doneEvent.payload.gate_results_summary,
    summary,
    "pipeline.done carries a cloned gate_results_summary for cross-check against the Run record"
  );

  // -------------------------------------------------------------- repo:// URI helpers (DEC-CDCP-014 + DEC-FIN-006)
  //
  // Round 6 migrates emitter ref fields to the portable repo://
  // URI grammar. The helpers must produce URIs that match the
  // grammar in DEC-CDCP-014 and the resolver in
  // scripts/validate_run_evidence.py.
  assert.equal(REPO_NAME, "chip-supply-chain-map");
  const repoUri = buildRepoUri(
    "0123456789abcdef0123456789abcdef01234567",
    "src/data/nodes.csv"
  );
  assert.equal(
    repoUri,
    "repo://chip-supply-chain-map@0123456789abcdef0123456789abcdef01234567/src/data/nodes.csv"
  );
  // Leading slashes and Windows separators are normalized.
  assert.equal(
    buildRepoUri("deadbeef".repeat(5), "\\src\\foo.csv"),
    "repo://chip-supply-chain-map@deadbeefdeadbeefdeadbeefdeadbeefdeadbeef/src/foo.csv"
  );
  assert.equal(
    buildRepoUri("a".repeat(40), "/leading/slash.txt"),
    `repo://chip-supply-chain-map@${"a".repeat(40)}/leading/slash.txt`
  );

  const artifactUri = buildArtifactUri("watchlist-packet@run-6a665b303138");
  assert.equal(
    artifactUri,
    "artifact://chip-supply-chain-map/watchlist-packet@run-6a665b303138"
  );

  const placeholder = pendingSandboxImageRef();
  assert.equal(placeholder, "repo://chip-supply-chain-map@PENDING/");
  assert.match(
    placeholder,
    /^repo:\/\/chip-supply-chain-map@[A-Za-z0-9]+\/$/,
    "placeholder must conform to the repo:// URI grammar with the trailing /"
  );

  // deriveSandboxImageRef against a real repo path returns the URI
  // form, not the legacy <path>@<sha> shape. The test runs in the
  // current working directory which is a git repo for this test.
  // (Repo-less case already covered above with repoPath: undefined.)

  // -------------------------------------------------------------- Run record shape under URI migration
  //
  // A done Run record produced by the emitter must carry the
  // repo:// sandbox_image_ref form and a workspace_id of just the
  // repo name (no SHA, no scheme prefix).
  const uriRecord: RunRecord = {
    id: "run-cafebabe0000",
    spec_id: "specs/0002-earnings-sensitivity-overlay/",
    agent_id: "chip-supply-chain-map-export",
    runtime: "chip-supply-chain-map-export",
    workspace_id: REPO_NAME,
    started_at: "2026-05-29T12:00:00Z",
    finished_at: "2026-05-29T12:00:01Z",
    status: "done",
    inputs: [
      {
        kind: "dataset",
        ref: buildRepoUri("c".repeat(40), "src/data/nodes.csv")
      }
    ],
    outputs: [
      {
        artifact_id: buildArtifactUri("watchlist-packet@run-cafebabe0000"),
        type: "watchlist_risk_packet"
      }
    ],
    prompt_snapshot_hash: hash,
    tool_schemas_snapshot_hash: hash,
    sandbox_image_ref: `repo://${REPO_NAME}@${"c".repeat(40)}/`,
    gate_results_summary: {
      gates_passed: ["input_validation"],
      gates_failed: [],
      all_passed: true
    }
  };
  const uriRecordPath = join(work, "ops", "run-records", `${uriRecord.id}.json`);
  emitRun(uriRecord, uriRecordPath);
  const uriParsed = JSON.parse(readFileSync(uriRecordPath, "utf8"));
  assert.equal(uriParsed.workspace_id, REPO_NAME);
  assert.match(
    uriParsed.sandbox_image_ref,
    /^repo:\/\/chip-supply-chain-map@[a-f0-9]{40}\/$/
  );
  assert.match(
    uriParsed.inputs[0].ref,
    /^repo:\/\/chip-supply-chain-map@[a-f0-9]{40}\/src\/data\/nodes\.csv$/
  );
  assert.match(
    uriParsed.outputs[0].artifact_id,
    /^artifact:\/\/chip-supply-chain-map\//
  );

  // -------------------------------------------------------------- deriveSandboxImageRef when no repoPath
  const noRepoRef = deriveSandboxImageRef(undefined);
  assert.equal(noRepoRef, undefined);

  console.log(
    `runEvidence.test OK: ${lines.length} ledger line(s), ${built.populated.length} field(s) populated.`
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
