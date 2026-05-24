import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class ResetCredentials_Tools implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]

    constructor() {
        this.label = 'Reset Credentials'
        this.name = 'resetCredentials'
        this.version = 1.0
        this.type = 'ResetCredentials'
        this.icon = 'credentials.svg'
        this.category = 'Tools'
        this.description = '[IR] ⚠️ ESCALATE — Force-reset credentials for a compromised user account'
        this.baseClasses = [this.type, ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = []
    }

    async init(_nodeData: INodeData): Promise<any> {
        return new DynamicStructuredTool({
            name: 'resetCredentials',
            description: 'Force-reset the password for a user account and invalidate all active sessions. REQUIRES HUMAN APPROVAL.',
            schema: z.object({
                username: z.string().describe('Username or UPN of the account to reset'),
                reason: z.string().describe('Reason for credential reset'),
                notify_user: z.boolean().optional().describe('Whether to notify the user by email')
            }),
            func: async ({ username, reason, notify_user = true }) => {
                return JSON.stringify(
                    {
                        success: true,
                        username,
                        reason,
                        actions_taken: [
                            'Password reset and forced change on next login',
                            'All active SSO sessions invalidated',
                            'MFA tokens revoked',
                            notify_user ? 'User notified by email' : 'User NOT notified (silent reset)'
                        ],
                        executed_at: new Date().toISOString(),
                        note: `Credentials for ${username} have been reset. User must re-authenticate with new password.`
                    },
                    null,
                    2
                )
            }
        })
    }
}

module.exports = { nodeClass: ResetCredentials_Tools }
