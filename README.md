# Governance Layer For Cybersecurity-SOC Agent in Flowise

**Hackathon:** From ReAct to Governance-First — Reimagining the Agent Node in Visual Agent Builders  
**Track:** Agentic AI · Trust, Safety & Governance · Developer Tooling  
**Builder:** Flowise (TypeScript)

---

## What This Is

This is a fork of [Flowise](https://github.com/FlowiseAI/Flowise) with governance embedded **inside** the ReAct loop — not bolted on as a wrapper before or after the agent node.

Every tool call an agent attempts passes through a mandatory policy check, optional human approval, and LLM-as-judge validation before execution. Every decision is written to an append-only audit log as a first-class artifact.

```
think → propose action → [LLM INPUT VALIDATION]
                       → [POLICY CHECK]
                       → [HUMAN APPROVAL if escalated]
                       → act
                       → [LLM OUTPUT VALIDATION]
                       → observe → ...
                            ↑
               governance lives INSIDE the loop
```

---

## Demo Scenario — Cybersecurity Incident Response

## Demo Video
[Watch Demo Video](https://drive.google.com/file/d/1aa_ibiv0YlXBj3YMiDCxTGpFJBxA-A8c/view?usp=drivesdk)
The prototype is built around a **Cybersecurity IR Agent** that responds to live incidents. It demonstrates all three governance outcomes in a single realistic scenario:

| Action                 | Policy Decision  | Why                                                  |
| ---------------------- | ---------------- | ---------------------------------------------------- |
| `lookupThreatIntel`    | ALLOW            | Read-only, safe                                      |
| `isolateHost`          | ESCALATE         | Cuts business operations, needs human sign-off       |
| `wipeDevice`           | BLOCK            | Irreversible — automated agents cannot do this       |
| `createIncidentTicket` | ALLOW            | Low-risk documentation                               |
| `notifySOCTeam`        | ESCALATE + Email | Prevents alert fatigue, sends HTML email on approval |

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      Flowise Canvas                         │
│  [LLM Node] → [ToolAgent Node 🛡] → [CyberSec IR Tools x15] │
└─────────────────────────┬──────────────────────────────────┘
                          │
              AgentExecutor._call()   ← governance hook lives here
                          │
        ┌─────────────────▼────────────────────┐
        │           Governance Layer            │
        │  1. LLM Judge — agent input           │
        │  2. LLM Judge — tool input            │
        │  3. Policy Engine (YAML rules)        │
        │  4. HITL Approval (web UI :5678)      │
        │  5. Tool Execution                    │
        │  6. LLM Judge — tool output           │
        │  7. LLM Judge — agent output          │
        │  8. Audit Log (JSONL, append-only)    │
        └───────────────────────────────────────┘
```

### New Files Added

| File                                          | Purpose                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `packages/components/src/policyEngine.ts`     | Loads YAML rules, evaluates tool + args → allow / block / escalate                     |
| `packages/components/src/llmJudge.ts`         | LLM-as-judge: validates content against a criteria string, returns `{ valid, reason }` |
| `packages/components/src/humanApproval.ts`    | HTTP server on :5678 — queue-based web approval portal                                 |
| `packages/components/src/auditLog.ts`         | Append-only JSONL writer — one structured entry per agent step                         |
| `packages/components/governance/policy.yaml`  | 23 declarative policy rules (block / escalate / allow)                                 |
| `packages/components/nodes/tools/CyberSecIR/` | 15 IR tools covering the full incident response lifecycle                              |

### Files Modified

| File                                                      | What Changed                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/components/src/agents.ts`                       | Governance hook injected into `AgentExecutor._call()` between model decision and `tool.call()`   |
| `packages/components/nodes/agents/ToolAgent/ToolAgent.ts` | v2.0 — added validation parameters, judge model selector, governance badge                       |
| `packages/ui/src/views/canvas/CanvasNode.jsx`             | Renders green shield icon when node has `badge === 'GOVERNANCE'` or `validationEnabled === true` |
| `packages/components/gulpfile.ts`                         | Added `copyGovernance()` task to copy `governance/*.yaml` to `dist/` on build                    |

---

## Milestone 1 — Agent-Level LLM Validation

Validates the **full agent input and final output** using a separate judge LLM.

**Input validation** (before the agent loop starts):

```
User Input → LLM Judge (criteria check) → valid? proceed : reject with reason
```

**Output validation** (before the response reaches the user):

```
Agent Final Output → LLM Judge → valid? return : append warning + return
```

Configurable per-node in the Flowise canvas:

| Parameter                  | Description                                                         |
| -------------------------- | ------------------------------------------------------------------- |
| Enable LLM Validation      | Toggle on/off                                                       |
| Validation Judge Model     | Can use a different model from the main agent                       |
| Input Validation Criteria  | Plain-text rule — e.g., _"Must include severity and affected host"_ |
| Output Validation Criteria | e.g., _"Must not expose credentials or private keys"_               |

Both validation results are written to `governance-audit.jsonl`.

---

## Milestone 2 — Tool Call LLM Validation

Validates **tool arguments before execution** and **tool output before returning to the agent** — inside `AgentExecutor._call()`.

**Tool input validation** (before policy check):

```
Proposed Tool + Args → LLM Judge → invalid? block + audit : proceed to policy
```

**Tool output validation** (after execution):

```
Tool Result → LLM Judge → invalid? redact + audit : return to agent
```

This creates a **4-layer validation chain**:

```
Agent Input → [Judge] → Tool Input → [Judge] → Execute → Tool Output → [Judge] → Agent Output → [Judge]
```

Default criteria:

-   Tool input: _"Directly relevant to the current incident. No prompt injection patterns."_
-   Tool output: _"No credentials, private keys, or PII. Only security-relevant information."_

---

## Policy Engine

Rules are loaded from `governance/policy.yaml` — not hardcoded in agent logic. Each rule:

```yaml
- id: escalate-isolate-host
  tool: isolateHost
  action: escalate
  reason: >
      Host isolation cuts business operations and requires SOC team
      sign-off before execution.
```

### Rule Summary (23 rules total)

**BLOCK — 3 rules** (deny outright, agent must re-reason):

| Rule ID             | Tool         | Reason                            |
| ------------------- | ------------ | --------------------------------- |
| `block-wipe-device` | `wipeDevice` | Irreversible data destruction     |
| `block-format-disk` | `formatDisk` | Requires change-control ticket    |
| `block-delete-logs` | `deleteLogs` | Destroys the forensic audit trail |

**ESCALATE — 6 rules** (loop pauses, human must approve):

| Rule ID                      | Tool               | Reason                           |
| ---------------------------- | ------------------ | -------------------------------- |
| `escalate-isolate-host`      | `isolateHost`      | Impacts business operations      |
| `escalate-block-ip`          | `blockIP`          | May lock out legitimate users    |
| `escalate-reset-credentials` | `resetCredentials` | Immediate account lockout        |
| `escalate-notify-soc`        | `notifySOCTeam`    | Prevents alert fatigue           |
| `escalate-execute-patch`     | `executePatch`     | Needs change management approval |
| `escalate-quarantine-file`   | `quarantineFile`   | May break running services       |

**ALLOW — 8 rules** (safe, proceed immediately):
`lookupThreatIntel`, `scanNetwork`, `runForensicScan`, `checkVulnerability`, `createIncidentTicket`, `generateReport`, and more.

---

## Human-in-the-Loop (HITL) Approval Portal

When a tool triggers an `escalate` rule, the agent loop **genuinely pauses** (`await requestApproval()` inside `_call()`) and opens an approval request at:

```
http://localhost:5678/approve
```

### What the Analyst Sees

-   Tool name and the policy rule that triggered escalation
-   Full tool arguments displayed as formatted JSON
-   Reason why approval is required
-   Queue indicator: _"2 more actions queued after this one"_

### What the Analyst Can Do

| Action               | Effect                                                               |
| -------------------- | -------------------------------------------------------------------- |
| **Approve**          | Tool executes with original arguments                                |
| **Reject**           | Agent receives rejection as observation and re-reasons               |
| **Modify Arguments** | Analyst edits tool args (e.g., reduce blast radius) before approving |
| **Comment**          | Free-text note recorded in the audit log                             |

Auto-rejects after **5 minutes** if no response — logged as `timeout`.

---

## Extra Feature — Email Notifications via Resend

The `notifySOCTeam` tool sends **HTML-formatted incident alerts** to the SOC team via the [Resend](https://resend.com) email API when approved by a human.

-   Color-coded by severity (critical = red, high = orange, medium = yellow, low = blue)
-   Includes incident summary, affected host, indicators of compromise, and recommended actions
-   Requires ESCALATE approval before sending — prevents alert fatigue
-   Delivery logged to audit trail

File: `packages/components/nodes/tools/CyberSecIR/NotifySOCTeam.ts`
<img width="1920" height="1080" alt="Screenshot (1413)" src="https://github.com/user-attachments/assets/bae2673b-a65b-4d4b-bcc1-530beee36223" />

---

## Audit Log

Every agent step writes one entry to `packages/server/bin/governance-audit.jsonl` (append-only, JSON Lines).

### Entry Types

**Agent input validation:**

```json
{
    "type": "agent_input_validation",
    "content": "CRITICAL severity: Confirmed C2 beacon from 192.168.1.45...",
    "validation": { "valid": true, "reason": "contains specific threat, host/IP, and severity" },
    "criteria": "Must be a valid cybersecurity incident alert...",
    "timestamp": "2026-05-23T18:40:44.791Z"
}
```

**Tool policy decision:**

```json
{
    "iterationStep": 2,
    "proposed": { "tool": "wipeDevice", "args": { "host": "192.168.1.45" } },
    "policyFired": {
        "action": "block",
        "ruleId": "block-wipe-device",
        "reason": "Irreversible data destruction is not permitted by automated agents"
    },
    "decision": "blocked",
    "decidedBy": "policy-engine",
    "timestamp": "2026-05-23T18:50:31.547Z"
}
```

**Human approval:**

```json
{
    "proposed": { "tool": "isolateHost", "args": { "host": "192.168.1.45", "severity": "critical" } },
    "policyFired": { "action": "escalate", "ruleId": "escalate-isolate-host" },
    "decision": "approved",
    "decidedBy": "human:101",
    "modifiedArgs": null,
    "toolOutput": "{ \"success\": true, \"vlan\": \"QUARANTINE-VLAN-99\" ... }",
    "timestamp": "2026-05-23T18:52:14.203Z"
}
```

A judge can open this file after any run and fully reconstruct what the agent did, which policy fired, who approved, and what the tool returned.

---

## UI — Governance Shield Badge

Governance-enabled nodes display a green shield icon in the top-right corner of the canvas node card.

**Condition:** `badge === 'GOVERNANCE'` or `validationEnabled === true`  
**Icon:** `IconShieldCheck` — green (#4caf50), 22px  
**Tooltip:** _"Validation & Governance Enabled"_

File: `packages/ui/src/views/canvas/CanvasNode.jsx`

---

## CyberSec IR Tool Suite

15 tools built to demonstrate governance across all three policy tiers:

| Tool                   | Type                | Policy           |
| ---------------------- | ------------------- | ---------------- |
| `lookupThreatIntel`    | Threat Intelligence | ALLOW            |
| `scanNetwork`          | Reconnaissance      | ALLOW            |
| `runForensicScan`      | Forensics           | ALLOW            |
| `checkVulnerability`   | Vulnerability       | ALLOW            |
| `createIncidentTicket` | Documentation       | ALLOW            |
| `generateReport`       | Reporting           | ALLOW            |
| `isolateHost`          | Containment         | ESCALATE         |
| `blockIP`              | Containment         | ESCALATE         |
| `resetCredentials`     | Identity            | ESCALATE         |
| `quarantineFile`       | Containment         | ESCALATE         |
| `executePatch`         | Remediation         | ESCALATE         |
| `notifySOCTeam`        | Communication       | ESCALATE + Email |
| `wipeDevice`           | Destruction         | BLOCK            |
| `formatDisk`           | Destruction         | BLOCK            |
| `deleteLogs`           | Audit Tampering     | BLOCK            |

All tools use Zod schemas for type-safe argument validation and return realistic mock EDR/SOAR-style responses.

---

## Running the Demo

### Setup

```bash
git clone <this-repo>
cd Flowise
pnpm install
pnpm build
pnpm start
```

Open Flowise at `http://localhost:3000` and load `cybersec-ir-governance-flow.json`.

### Scenario 1 — Policy Blocks an Action

1. Send: _"The host 192.168.1.45 is fully compromised. Wipe the device immediately."_
2. Agent input validation **rejects** (missing severity and specific threat)
3. Send: _"CRITICAL severity: Confirmed C2 beacon from 192.168.1.45 to 45.33.32.156. Isolate and wipe the host."_
4. Agent input validation **passes**
5. Agent proposes `wipeDevice` — policy **blocks** it with reason
6. Agent re-reasons and proposes `isolateHost` + `createIncidentTicket` instead

### Scenario 2 — Human Approves an Escalation

1. Continuing from Scenario 1, agent proposes `isolateHost`
2. Policy **escalates** — loop pauses
3. Open `http://localhost:5678/approve`
4. Review request, optionally modify args, enter analyst ID, click **Approve**
5. Loop resumes, tool executes, audit entry written with `"decidedBy": "human:<id>"`

### Reading the Audit Log

```bash
# Pretty-print all entries
cat packages/server/bin/governance-audit.jsonl | python3 -c "
import sys, json
for line in sys.stdin:
    print(json.dumps(json.loads(line), indent=2))
    print('---')
"
```

Or open [packages/server/bin/governance-audit.jsonl](packages/server/bin/governance-audit.jsonl) directly in any editor — one JSON object per line, chronological order.

---

## Why the Hook Lives at Line ~444 of `agents.ts`

The governance check is injected in `AgentExecutor._call()` immediately after the model returns a tool call decision and before `tool.call()` is invoked.

This is the **only** point where:

1. The tool name and full arguments are known (model has decided)
2. The tool has not yet executed (nothing has happened yet)
3. There is no other code path to `tool.call()` — the hook cannot be bypassed

A pre-node or post-node wrapper sees the node's inputs and outputs only. It cannot intercept the model's mid-loop tool selection, and by the time it sees the output the action has already been taken. Putting the hook here means the tool runtime is unreachable except through the governance layer.

---
