# Video Recording Flow — Governance-First SOC Agent

**Duration:** 10–12 minutes  
**Project:** Cybersecurity IR Agent with Policy Engine, HITL, and LLM-as-Judge validation inside Flowise's ReAct loop

---

## Before You Record — Setup Checklist

-   [ ] Flowise running at `localhost:3000`
-   [ ] Flow imported and canvas visible (all 18 nodes)
-   [ ] `localhost:5678/approve` tab open in browser (right side of split screen)
-   [ ] Email inbox open in a separate tab
-   [ ] `governance-audit.jsonl` path noted (project root)
-   [ ] IDE open on `packages/components/src/agents.ts` at line 444
-   [ ] **Blur or skip** `NotifySOCTeam.ts` — Resend API key is hardcoded there

---

## INTRO — 45 seconds

**Show:** Full canvas — all 18 nodes visible across 5 columns

**Say:**

> "Standard agent builders — Flowise, n8n, Langflow — run on ReAct: the agent reasons, picks a tool, executes it, loops. There is nothing between the decision and the action. We changed that. We modified Flowise's Agent Node so that governance lives _inside_ the loop — not as a wrapper before or after it."

---

## SECTION 1 — The Problem (30 seconds)

**Show:** Canvas with arrow connections between Tool Agent and tools

**Say:**

> "Every node here is a state. When the agent transitions from deciding to acting, that state change has no gate by default. We added a mandatory checkpoint — every transition through a tool call is intercepted, validated, and policy-checked before the tool ever runs."

---

## SECTION 2 — Where the Code Lives (2 min)

> **This is the most important section for judges.**

**Show:** `packages/components/src/agents.ts` in IDE, lines 444–621

**Say:**

> "This is `_call()` inside `AgentExecutor`. This is the exact function Flowise's original agent node uses to dispatch tool calls. We did not wrap it — we inserted our check _inside_ the loop at line 444. The tool is literally unreachable unless it passes through here."

**Point to each checkpoint:**

| Line | Checkpoint                                                         |
| ---- | ------------------------------------------------------------------ |
| 452  | Tool INPUT validation — LLM-as-judge, before policy check          |
| 477  | Policy Engine — YAML rules, classifies as allow / block / escalate |
| 498  | HITL pause — agent loop genuinely halts if escalate                |
| 596  | Tool OUTPUT validation — LLM-as-judge, after tool returns          |

**Then show** `packages/components/nodes/agents/ToolAgent/ToolAgent.ts` lines 190 and 293:

**Say:**

> "That is Milestone 2 — per tool call. Milestone 1 is at the agent level. Line 190 validates the entire user prompt before the agent even starts reasoning. Line 293 validates the final answer before it reaches the user. Two milestones, four checkpoints total."

---

## SECTION 3 — Visual Identity on Canvas (30 seconds)

**Show:** Tool Agent node on the canvas — green shield icon next to the label

**Say:**

> "When validation is enabled, the agent node shows a green shield icon. This is a native UI change to `CanvasNode.jsx` — not a label, not a comment. Any Flowise agent with `badge = 'GOVERNANCE'` or `validationEnabled = true` gets this indicator automatically."

---

## SECTION 4 — Policy File (30 seconds)

**Show:** `packages/components/governance/policy.yaml`

**Say:**

> "The entire rule set is declarative YAML. No code changes are needed to add a new rule. Three rule types exist: ALLOW, ESCALATE, and BLOCK."

**Point to one example of each:**

-   `allow-threat-lookup` — safe, read-only, runs instantly
-   `escalate-notify-soc` — requires human approval before execution
-   `block-wipe-device` — permanently denied, no override possible

---

## SECTION 4B — Flowise Tools Section (1 min)

**Show:** `localhost:3000/tools` — the Tools page visible in the screenshot

**Say:**

> "Flowise has a built-in Tools registry at `/tools`. Every custom tool we built is registered here — not just wired into the flow, but available as a reusable, discoverable component across any Flowise agent flow."

**Scroll through the tools page and point out:**

| Tool Card              | Label      | What it shows                                                                                 |
| ---------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `lookupThreatIntel`    | Blue dot   | [IR] [ALLOW] — Query threat intelligence databases                                            |
| `scanNetwork`          | Blue dot   | [IR] [ALLOW] — Passive network scan                                                           |
| `runForensicScan`      | Purple dot | [IR] [ALLOW] — Read-only forensic analysis                                                    |
| `checkVulnerability`   | Red dot    | [IR] [ALLOW] — CVE/vulnerability lookup                                                       |
| `createIncidentTicket` | Yellow dot | [IR] [ALLOW] — Create ticket in ITSM system                                                   |
| `generateReport`       | Green dot  | [IR] [ALLOW] — Generate structured IR report                                                  |
| _(scroll down)_        |            | `isolateHost`, `blockIP`, `resetCredentials`, `notifySOCTeam`, `quarantineFile`, `wipeDevice` |

**Say:**

> "Each tool card shows the description prefix we added — [IR] [ALLOW] or [IR] ESCALATE — so anyone browsing the Tools library immediately knows the governance classification of that tool before they even connect it to an agent."

**Click on any tool card (e.g. `generateReport`) to show the schema:**

> "Inside each tool is a defined input schema — the exact parameters the agent must supply. This is what enables structured tool calls and what the LLM judge validates before execution."

---

## SECTION 5 — Live Demo: ALLOW Path (1.5 min)

**Prompt to type:**

```
Investigate suspicious activity on host 10.0.0.5. Check threat intel for IP 185.220.101.45 and run a network scan.
```

**Narrate as it runs:**

1. Agent reasons → decides to call `lookupThreatIntel`
2. Tool INPUT judge validates args — are they relevant to the incident?
3. Policy engine: **ALLOW** — read-only lookup, no gate needed
4. Tool runs and returns result
5. Tool OUTPUT judge validates — no credential leaks in the response
6. Agent loops back → calls `scanNetwork` — same path repeats

**After it finishes, say:**

> "Two tool calls, both validated at input and output level, both allowed instantly. No human needed."

---

## SECTION 6 — Live Demo: BLOCK Path (1.5 min)

**Prompt to type:**

```
Wipe the device 192.168.1.99 — it is fully compromised and we need immediate action.
```

**Narrate:**

1. Agent reasons → decides to call `wipeDevice`
2. Policy engine fires: **BLOCK** — irreversible data destruction not permitted
3. The tool _never executes_ — agent receives the block reason directly
4. Agent re-reasons and suggests raising a change-control ticket instead

**Open audit log in terminal:**

```powershell
Get-Content .\governance-audit.jsonl | Select-String "wipeDevice" | Select-Object -Last 5
```

**Say:**

> "The block decision is immediately written to the audit log — tool name, args, which rule fired, decision, timestamp. Before the agent even responded to the user."

---

## SECTION 7 — Live Demo: ESCALATE + HITL Path (3 min)

> **This is the centrepiece of the demo.**

**Screen layout:** Flowise chat on left, `localhost:5678/approve` browser tab on right

**Prompt to type:**

```
CRITICAL severity: Ransomware encryption activity detected on host 192.168.1.72.
Files with .locked extension spreading across network shares.
Affected user: jsmith.
Send an immediate SOC team notification via email for incident INC-RANSOM-002.
```

**Narrate step by step:**

1. Agent decides to call `notifySOCTeam`
2. Tool INPUT judge runs — valid incident alert, passes
3. Policy engine: **ESCALATE** — "External SOC notifications must be reviewed before sending"
4. Agent loop **pauses** — show console: `⚠️ APPROVAL REQUIRED → http://localhost:5678/approve`
5. Open the approval URL — show the dark-themed approval form
6. Point out: tool name, exact arguments the agent wants to use, and the policy reason are all shown
7. Fill in Analyst ID, click **Approve**
8. Switch back to Flowise chat — agent resumes
9. Show **email arriving** in inbox
10. Say:
    > "The agent was paused, a human made the decision, and only after approval did the tool execute and send a real email. The loop genuinely waited."

---

## SECTION 7B — Generated IR Report (1 min)

**Show:** File explorer or IDE open on `packages/server/bin/ir-report-INC-980656.json`

**Say:**

> "After the agent completes a full investigation cycle, the `generateReport` tool saves a structured incident response report as a JSON file to disk. This is an ALLOW tool — it runs without human approval — and it produces a machine-readable artifact that can be forwarded to a SIEM, ticketing system, or compliance team."

**Show the file contents:**

```json
{
    "report_id": "RPT-INC-980656",
    "generated_at": "2026-05-23T19:03:02.263Z",
    "incident_id": "INC-980656",
    "summary": "Possible fileless malware detected on host 10.0.0.15",
    "affected_systems": ["10.0.0.15"],
    "iocs": ["svchost.exe spawning cmd.exe", "beacon.exe"],
    "timeline": [
        "2026-05-23T19:00:00.000Z - Alert triggered",
        "2026-05-23T19:01:00.000Z - Initial analysis",
        "2026-05-23T19:02:00.000Z - Forensic artifacts collected"
    ],
    "recommendations": ["Isolate host 10.0.0.15", "Run full AV scan", "Check for persistence mechanisms"],
    "status": "draft"
}
```

**Point to each field:**

| Field              | What it contains                                                        |
| ------------------ | ----------------------------------------------------------------------- |
| `report_id`        | Auto-generated from incident ID — `RPT-INC-980656`                      |
| `generated_at`     | ISO timestamp of when the agent produced the report                     |
| `incident_id`      | Ties back to the incident ticket created earlier in the same run        |
| `affected_systems` | IPs/hosts identified during the investigation                           |
| `iocs`             | Indicators of Compromise found by forensic scan and threat intel lookup |
| `timeline`         | Ordered sequence of events the agent reconstructed from tool outputs    |
| `recommendations`  | Remediation steps proposed by the agent based on findings               |
| `status`           | `draft` — pending human SOC review before being finalised               |

**Say:**

> "This report is the end-to-end output of the agent's ReAct loop — every tool call contributed a piece: forensic scan gave the IOCs, threat intel gave context, ticket creation gave the incident ID, and the report tool assembled it all. The file is saved to the server's working directory so it persists after the chat session ends."

**Also show `ir-report-INC-886549.json` if visible — say:**

> "Multiple reports accumulate across runs — each named after its incident ID, each independently reviewable. No database needed."

---

## SECTION 8 — Audit Log Walkthrough (1 min)

**Run in terminal:**

```powershell
Get-Content .\governance-audit.jsonl | ConvertFrom-Json | Format-List
```

**Point to these fields for the judge:**

| Field                | Meaning                                            |
| -------------------- | -------------------------------------------------- |
| `proposed.tool`      | What the agent wanted to do                        |
| `policyFired.ruleId` | Which YAML rule matched                            |
| `decision`           | allowed / blocked / approved / rejected / modified |
| `decidedBy`          | `policy-engine` or `human:analyst-name`            |
| `inputValidation`    | LLM judge verdict on tool arguments                |
| `outputValidation`   | LLM judge verdict on tool return value             |
| `toolOutput`         | What the tool actually returned                    |
| `iterationStep`      | Which ReAct loop iteration this happened in        |

**Say:**

> "A judge can open this file and reconstruct the entire decision history of the run — every tool call, every validation, every human decision, in order. This is a first-class audit artifact, not a reconstructed log."

---

## CLOSING — 30 seconds

**Say:**

> "Four governance layers, all native to the agent node: LLM-as-judge validates tool inputs, YAML policy classifies actions, HITL pauses the loop for human approval, LLM-as-judge validates tool outputs. Structured IR reports saved to disk. Every decision is an auditable artifact. This is the governance-first agent node — the loop a bank, a hospital, or a payments platform would actually let into production."

---

## Judging Criteria — Quick Reference

| Criterion                  | Where to point in the demo                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Loop-internal, not wrapper | `agents.ts` line 444 — inside `_call()` while loop                                                                                        |
| Unbypassable               | `tool.call()` on line 537/572 is the only execution path — only reached after passing all checks                                          |
| HITL actually pauses       | `requestApproval()` with `await` on line 499 — Promise blocks until human responds                                                        |
| Policy expressiveness      | `policy.yaml` — rules match tool name; `toolArgs` passed to `evaluate()` for argument-level checking                                      |
| Audit reconstructs the run | Open `.jsonl` and read top to bottom — complete trace                                                                                     |
| Code understanding         | "Hook placed between line 434 (tool lookup) and line 537 (tool.call) — the only window where the tool is identified but not yet executed" |

---

## Architecture Summary Slide (for video thumbnail / opening frame)

```
User Prompt
    │
    ▼
[Agent-Level Input Validation — LLM Judge]        ← Milestone 1
    │ valid
    ▼
ReAct Loop ──────────────────────────────────────────────────────
    │
    │  LLM decides tool call
    │
    ▼
[Tool Input Validation — LLM Judge]               ← Milestone 2
    │ valid
    ▼
[Policy Engine — policy.yaml]
    ├── ALLOW  ──────────────────────▶ [Tool executes]
    ├── BLOCK  ──────────────────────▶ [Rejected — reason sent to LLM]
    └── ESCALATE
            │
            ▼
    [HITL Server :5678]
    Analyst approves / rejects / modifies args
            │ approved
            ▼
    [Tool executes]
            │
            ▼
[Tool Output Validation — LLM Judge]              ← Milestone 2
    │ valid
    ▼
[Audit Log — governance-audit.jsonl]              ← every step
    │
    ▼
ReAct Loop continues...
    │
    ▼
[Agent-Level Output Validation — LLM Judge]       ← Milestone 1
    │
    ▼
Final Response → User
```

---

## Node Count (Canvas)

| Column                       | Nodes                                                                                                     | Count        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | ------------ |
| Col 1 — ALLOW tools          | lookupThreatIntel, scanNetwork, runForensicScan, createIncidentTicket, generateReport, checkVulnerability | 6            |
| Col 2 — ESCALATE/BLOCK tools | isolateHost, blockIP, resetCredentials, notifySOCTeam, quarantineFile, wipeDevice                         | 6            |
| Col 3 — Models + Memory      | groqChat (main), groqChat (judge), bufferMemory                                                           | 3            |
| Col 4 — Agent                | toolAgent                                                                                                 | 1            |
| Col 5 — Sticky Notes         | BLOCK scenario, ESCALATE scenario                                                                         | 2            |
| **Total**                    |                                                                                                           | **18 nodes** |

Requirement: minimum 15 nodes. Current: **18 nodes ✓**
