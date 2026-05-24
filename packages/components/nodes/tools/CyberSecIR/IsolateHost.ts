import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class IsolateHost_Tools implements INode {
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
        this.label = 'Isolate Host'
        this.name = 'isolateHost'
        this.version = 1.0
        this.type = 'IsolateHost'
        this.icon = 'isolate.svg'
        this.category = 'Tools'
        this.description = '[IR] ⚠️ ESCALATE — Isolate a compromised host from the network'
        this.baseClasses = [this.type, ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = []
    }

    async init(_nodeData: INodeData): Promise<any> {
        return new DynamicStructuredTool({
            name: 'isolateHost',
            description:
                'Isolate a compromised host from the network by blocking all traffic except management plane. REQUIRES HUMAN APPROVAL.',
            schema: z.object({
                host: z.string().describe('IP address or hostname to isolate'),
                severity: z.enum(['critical', 'high', 'medium']).describe('Incident severity justifying isolation'),
                reason: z.string().describe('Justification for isolating this host')
            }),
            func: async ({ host, severity, reason }) => {
                // Mock: in production this would call an EDR API (CrowdStrike, SentinelOne, etc.)
                return JSON.stringify(
                    {
                        success: true,
                        host,
                        severity,
                        action: 'isolated',
                        vlan: 'QUARANTINE-VLAN-99',
                        allowed_traffic: ['management-plane-only'],
                        reason,
                        executed_at: new Date().toISOString(),
                        note: 'Host successfully isolated. All inbound/outbound traffic blocked except management plane.'
                    },
                    null,
                    2
                )
            }
        })
    }
}

module.exports = { nodeClass: IsolateHost_Tools }
