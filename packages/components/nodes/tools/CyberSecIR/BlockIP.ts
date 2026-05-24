import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class BlockIP_Tools implements INode {
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
        this.label = 'Block IP'
        this.name = 'blockIP'
        this.version = 1.0
        this.type = 'BlockIP'
        this.icon = 'blockip.svg'
        this.category = 'Tools'
        this.description = '[IR] ⚠️ ESCALATE — Add an IP address to the firewall blocklist'
        this.baseClasses = [this.type, ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = []
    }

    async init(_nodeData: INodeData): Promise<any> {
        return new DynamicStructuredTool({
            name: 'blockIP',
            description: 'Add an IP address to the perimeter firewall deny list to block all traffic. REQUIRES HUMAN APPROVAL.',
            schema: z.object({
                ip_address: z.string().describe('IP address to block'),
                direction: z.enum(['inbound', 'outbound', 'both']).describe('Traffic direction to block'),
                reason: z.string().describe('Reason for blocking this IP')
            }),
            func: async ({ ip_address, direction, reason }) => {
                return JSON.stringify(
                    {
                        success: true,
                        ip_address,
                        direction,
                        reason,
                        firewall_rule_id: `FW-DENY-${Date.now().toString().slice(-6)}`,
                        applied_to: ['perimeter-fw-01', 'perimeter-fw-02'],
                        executed_at: new Date().toISOString(),
                        note: `IP ${ip_address} successfully blocked (${direction}) on all perimeter firewalls.`
                    },
                    null,
                    2
                )
            }
        })
    }
}

module.exports = { nodeClass: BlockIP_Tools }
