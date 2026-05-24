import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class QuarantineFile_Tools implements INode {
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
        this.label = 'Quarantine File'
        this.name = 'quarantineFile'
        this.version = 1.0
        this.type = 'QuarantineFile'
        this.icon = 'quarantine.svg'
        this.category = 'Tools'
        this.description = '[IR] ⚠️ ESCALATE — Move a suspicious file to quarantine on a remote host'
        this.baseClasses = [this.type, ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = []
    }

    async init(_nodeData: INodeData): Promise<any> {
        return new DynamicStructuredTool({
            name: 'quarantineFile',
            description: 'Move a suspicious file to an isolated quarantine directory, preventing execution. REQUIRES HUMAN APPROVAL.',
            schema: z.object({
                host: z.string().describe('Host where the file resides'),
                file_path: z.string().describe('Full path to the file to quarantine'),
                reason: z.string().describe('Reason for quarantining the file')
            }),
            func: async ({ host, file_path, reason }) => {
                const quarantinePath = `C:\\Quarantine\\${Date.now()}_${file_path.split('\\').pop()}`
                return JSON.stringify(
                    {
                        success: true,
                        host,
                        original_path: file_path,
                        quarantine_path: quarantinePath,
                        reason,
                        file_hash_sha256: 'a3f1b2c4d5e6f7890123456789abcdef0123456789abcdef0123456789abcdef',
                        executed_at: new Date().toISOString(),
                        note: `File moved to quarantine. Original location is now inaccessible.`
                    },
                    null,
                    2
                )
            }
        })
    }
}

module.exports = { nodeClass: QuarantineFile_Tools }
