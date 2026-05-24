import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class WipeDevice_Tools implements INode {
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
        this.label = 'Wipe Device'
        this.name = 'wipeDevice'
        this.version = 1.0
        this.type = 'WipeDevice'
        this.icon = 'wipe.svg'
        this.category = 'Tools'
        this.description = '[IR] 🚫 BLOCKED — Perform a full remote wipe of a device (irreversible)'
        this.baseClasses = [this.type, ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = []
    }

    async init(_nodeData: INodeData): Promise<any> {
        return new DynamicStructuredTool({
            name: 'wipeDevice',
            description:
                'Perform a full remote wipe of a device, erasing all data. THIS ACTION IS IRREVERSIBLE and is BLOCKED by governance policy.',
            schema: z.object({
                host: z.string().describe('Hostname or IP of the device to wipe'),
                confirmation_code: z.string().optional().describe('Confirmation code for the wipe operation')
            }),
            func: async ({ host }) => {
                // This tool is blocked by policy — this function should never be called.
                // If it somehow runs (policy bypassed), return a clear error.
                return JSON.stringify(
                    {
                        success: false,
                        host,
                        error: 'POLICY VIOLATION: wipeDevice is blocked by governance policy. This execution should not have reached the tool.',
                        executed_at: new Date().toISOString()
                    },
                    null,
                    2
                )
            }
        })
    }
}

module.exports = { nodeClass: WipeDevice_Tools }
