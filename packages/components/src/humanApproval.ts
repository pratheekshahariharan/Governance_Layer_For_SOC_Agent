import * as http from 'http'
import * as url from 'url'

export interface ApprovalRequest {
    tool: string
    args: Record<string, any>
    reason: string
    sessionId?: string
    chatId?: string
}

export interface ApprovalResponse {
    approved: boolean
    analyst: string
    modifiedArgs?: Record<string, any> | null
    comment?: string
}

interface PendingApproval {
    request: ApprovalRequest
    resolve: (resp: ApprovalResponse) => void
}

const HITL_PORT = 5678
let server: http.Server | null = null

// Queue-based: each requestApproval enqueues; the server processes one at a time.
const approvalQueue: PendingApproval[] = []
let activeApproval: PendingApproval | null = null

function dequeueNext(): void {
    if (activeApproval || approvalQueue.length === 0) return
    activeApproval = approvalQueue.shift()!
    console.log(`\n[humanApproval] ⚠️  APPROVAL REQUIRED for tool: ${activeApproval.request.tool}`)
    console.log(`[humanApproval] Open http://localhost:${HITL_PORT}/approve to respond\n`)
}

function ensureServerRunning(): void {
    if (server) return

    server = http.createServer((req, res) => {
        const parsed = url.parse(req.url ?? '', true)

        // Serve the approval form
        if (req.method === 'GET' && parsed.pathname === '/approve') {
            if (!activeApproval) {
                const queued = approvalQueue.length
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end(`<h2 style="font-family:monospace;color:#8b949e">No active approval. ${queued} queued.</h2>`)
                return
            }
            const { tool, args, reason } = activeApproval.request
            const argsJson = JSON.stringify(args, null, 2)
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`<!DOCTYPE html>
<html>
<head>
  <title>SOC Approval Required</title>
  <style>
    body { font-family: monospace; max-width: 700px; margin: 40px auto; background: #0d1117; color: #c9d1d9; padding: 20px; }
    h2 { color: #f85149; }
    .box { background: #161b22; border: 1px solid #30363d; padding: 16px; border-radius: 6px; margin: 12px 0; }
    .label { color: #8b949e; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
    .value { color: #e6edf3; font-size: 14px; }
    .reason { color: #f0883e; }
    .queue { color: #8b949e; font-size: 12px; margin-bottom: 16px; }
    textarea { width: 100%; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; padding: 8px; border-radius: 4px; font-family: monospace; }
    input[type=text] { width: 100%; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; padding: 8px; border-radius: 4px; font-family: monospace; box-sizing: border-box; }
    .btn { padding: 10px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; margin: 4px; }
    .approve { background: #238636; color: white; }
    .reject  { background: #b91c1c; color: white; }
  </style>
</head>
<body>
  <h2>&#9888; SOC Approval Required</h2>
  <p class="queue">${approvalQueue.length} more action(s) queued after this one</p>
  <div class="box">
    <div class="label">Tool</div>
    <div class="value">${tool}</div>
  </div>
  <div class="box">
    <div class="label">Arguments</div>
    <pre class="value">${argsJson}</pre>
  </div>
  <div class="box">
    <div class="label">Why approval is needed</div>
    <div class="reason">${reason}</div>
  </div>

  <form method="POST" action="/approve">
    <div class="box">
      <div class="label">Analyst ID</div>
      <input type="text" name="analyst" placeholder="your-name" required />
    </div>
    <div class="box">
      <div class="label">Modified Args (optional — leave blank to use original)</div>
      <textarea name="modifiedArgs" rows="5" placeholder='{"key": "value"}'></textarea>
    </div>
    <div class="box">
      <div class="label">Comment (optional)</div>
      <input type="text" name="comment" placeholder="Reason for decision" />
    </div>
    <button class="btn approve" name="decision" value="approve">&#10003; Approve</button>
    <button class="btn reject"  name="decision" value="reject">&#10007; Reject</button>
  </form>
</body>
</html>`)
            return
        }

        // Handle form submission
        if (req.method === 'POST' && parsed.pathname === '/approve') {
            let body = ''
            req.on('data', (chunk) => {
                body += chunk
            })
            req.on('end', () => {
                if (!activeApproval) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' })
                    res.end('No active approval found.')
                    return
                }

                const params = new URLSearchParams(body)
                const decision = params.get('decision')
                const analyst = params.get('analyst') ?? 'unknown'
                const comment = params.get('comment') ?? ''
                const modifiedArgsRaw = params.get('modifiedArgs') ?? ''

                let modifiedArgs: Record<string, any> | null = null
                if (modifiedArgsRaw.trim()) {
                    try {
                        modifiedArgs = JSON.parse(modifiedArgsRaw)
                    } catch {
                        /* ignore invalid JSON */
                    }
                }

                const approved = decision === 'approve'
                const current = activeApproval
                activeApproval = null

                // Resolve this approval, then pull next from queue
                current.resolve({ approved, analyst, modifiedArgs, comment })
                dequeueNext()

                const remaining = approvalQueue.length + (activeApproval ? 1 : 0)
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end(`<!DOCTYPE html>
<html>
<head><title>Decision Recorded</title>
<style>body{font-family:monospace;max-width:500px;margin:60px auto;background:#0d1117;color:#c9d1d9;text-align:center;}</style>
</head>
<body>
  <h2 style="color:${approved ? '#3fb950' : '#f85149'}">${approved ? '✓ Approved' : '✗ Rejected'}</h2>
  <p>Decision recorded. The agent loop will now resume.</p>
  ${
      remaining > 0
          ? `<p style="color:#f0883e">⚠️ ${remaining} more approval(s) pending — <a href="/approve" style="color:#58a6ff">review next</a></p>`
          : ''
  }
  <p style="color:#8b949e">${remaining === 0 ? 'You can close this tab.' : 'Click the link above to review the next action.'}</p>
</body>
</html>`)
            })
            return
        }

        res.writeHead(404)
        res.end()
    })

    server.listen(HITL_PORT, () => {
        console.log(`[humanApproval] HITL approval server listening at http://localhost:${HITL_PORT}/approve`)
    })
}

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Queues an approval request and pauses until a human approves or rejects.
 * Auto-rejects after APPROVAL_TIMEOUT_MS if no human responds.
 * Multiple concurrent ESCALATE tools are serialised — each waits its turn.
 */
export function requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    ensureServerRunning()

    return new Promise<ApprovalResponse>((resolve) => {
        let timer: ReturnType<typeof setTimeout> | null = null

        const resolveOnce = (resp: ApprovalResponse) => {
            if (timer) {
                clearTimeout(timer)
                timer = null
            }
            resolve(resp)
        }

        timer = setTimeout(() => {
            // Remove from queue if still waiting, or clear active if it's this one
            const idx = approvalQueue.findIndex((p) => p.resolve === resolveOnce)
            if (idx !== -1) approvalQueue.splice(idx, 1)
            if (activeApproval?.resolve === resolveOnce) {
                activeApproval = null
                dequeueNext()
            }
            console.warn(`[humanApproval] ⏰ Approval timed out for tool: ${request.tool} — auto-rejecting`)
            resolveOnce({ approved: false, analyst: 'timeout', comment: 'No human response within 5 minutes. Action auto-rejected.' })
        }, APPROVAL_TIMEOUT_MS)

        approvalQueue.push({ request, resolve: resolveOnce })
        dequeueNext()
    })
}
