import * as fs from 'fs'
import * as path from 'path'

export interface AuditEntry {
    timestamp: string
    sessionId?: string
    chatId?: string
    iterationStep: number
    proposed: {
        tool: string
        args: Record<string, any>
    }
    policyFired: {
        ruleId: string
        action: 'allow' | 'block' | 'escalate'
        reason: string
    }
    decision: 'allowed' | 'blocked' | 'approved' | 'rejected' | 'modified'
    decidedBy: string
    modifiedArgs?: Record<string, any> | null
    inputValidation?: { valid: boolean; reason?: string }
    outputValidation?: { valid: boolean; reason?: string }
    toolOutput?: string
    agentInputValidation?: { valid: boolean; reason?: string }
    agentOutputValidation?: { valid: boolean; reason?: string }
}

const LOG_FILE = path.join(process.cwd(), 'governance-audit.jsonl')

export function appendAuditEntry(entry: AuditEntry): void {
    try {
        const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n'
        fs.appendFileSync(LOG_FILE, line, 'utf8')
    } catch (e) {
        console.error('[auditLog] Failed to write audit entry:', e)
    }
}

export function appendAgentAuditEntry(entry: {
    timestamp?: string
    sessionId?: string
    chatId?: string
    type: 'agent_input_validation' | 'agent_output_validation'
    content: string
    validation: { valid: boolean; reason?: string }
    criteria: string
}): void {
    try {
        const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n'
        fs.appendFileSync(LOG_FILE, line, 'utf8')
    } catch (e) {
        console.error('[auditLog] Failed to write agent audit entry:', e)
    }
}
