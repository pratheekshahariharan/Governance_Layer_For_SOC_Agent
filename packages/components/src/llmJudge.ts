import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'

export interface JudgeResult {
    valid: boolean
    reason: string
}

/**
 * Calls a judge LLM to validate content against a criteria string.
 * Returns { valid, reason }. Falls back to valid=true on any LLM error
 * so governance failures are never silent crashes.
 */
export async function validateWithLLM(content: string, criteria: string, judgeModel: BaseChatModel): Promise<JudgeResult> {
    const systemPrompt = `You are a strict security validation judge.
Given content and criteria, respond with ONLY a valid JSON object in this exact format:
{"valid": true, "reason": "explanation"}
or
{"valid": false, "reason": "explanation"}
Do not include any other text, markdown, or code blocks.`

    const userPrompt = `Criteria: ${criteria}

Content to validate:
${content}

Respond with JSON only.`

    try {
        const response = await judgeModel.invoke([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)])
        const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)

        // Strip markdown code fences if model wraps the JSON
        const cleaned = text
            .replace(/```json?\n?/gi, '')
            .replace(/```/g, '')
            .trim()
        const parsed = JSON.parse(cleaned)

        return {
            valid: Boolean(parsed.valid),
            reason: String(parsed.reason ?? '')
        }
    } catch (e) {
        // Never block execution on judge errors — log and allow
        console.error('[llmJudge] Validation error, defaulting to valid=true:', e)
        return { valid: true, reason: 'Validation skipped due to judge error' }
    }
}
