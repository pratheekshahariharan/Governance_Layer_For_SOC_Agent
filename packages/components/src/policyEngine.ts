import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

export type PolicyAction = 'allow' | 'block' | 'escalate'

export interface PolicyRule {
    id: string
    tool: string
    action: PolicyAction
    reason: string
}

export interface PolicyResult {
    action: PolicyAction
    ruleId: string
    reason: string
}

let cachedRules: PolicyRule[] | null = null

function loadRules(): PolicyRule[] {
    if (cachedRules) return cachedRules

    const policyPath = path.join(__dirname, '..', 'governance', 'policy.yaml')
    try {
        const raw = fs.readFileSync(policyPath, 'utf8')
        const parsed = yaml.load(raw) as { rules: PolicyRule[] }
        cachedRules = parsed.rules ?? []
        return cachedRules
    } catch (e) {
        console.error('[policyEngine] Failed to load policy file, defaulting to allow-all:', e)
        return []
    }
}

/**
 * Evaluates a proposed tool call against the loaded policy rules.
 * Matching is exact by tool name (case-insensitive).
 * Falls back to 'allow' if no rule matches, so unrecognised tools are not silently blocked.
 */
export function evaluate(toolName: string, toolArgs: Record<string, any>, _context?: Record<string, any>): PolicyResult {
    const rules = loadRules()
    const match = rules.find((r) => r.tool.toLowerCase() === toolName.toLowerCase())

    if (match) {
        return { action: match.action, ruleId: match.id, reason: match.reason }
    }

    return {
        action: 'allow',
        ruleId: 'default-allow',
        reason: 'No policy rule matched. Defaulting to allow.'
    }
}

/** Clears the rule cache — useful in tests or after hot-reloading the policy file. */
export function clearCache(): void {
    cachedRules = null
}
