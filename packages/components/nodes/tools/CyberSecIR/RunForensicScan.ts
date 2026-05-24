import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class RunForensicScan_Tools implements INode {
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
        this.label = 'Run Forensic Scan'
        this.name = 'runForensicScan'
        this.version = 1.0
        this.type = 'RunForensicScan'
        this.icon = 'forensic.svg'
        this.category = 'Tools'
        this.description = '[IR] Collect forensic artifacts from a host: running processes, loaded modules, persistence mechanisms'
        this.baseClasses = [this.type, ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = []
    }

    async init(_nodeData: INodeData): Promise<any> {
        return new DynamicStructuredTool({
            name: 'runForensicScan',
            description:
                'Collect forensic artifacts from a host including running processes, loaded DLLs, registry run keys, and scheduled tasks.',
            schema: z.object({
                host: z.string().describe('Host to collect forensic artifacts from'),
                artifact_types: z.array(z.enum(['processes', 'modules', 'persistence', 'network', 'files'])).optional()
            }),
            func: async ({ host, artifact_types = ['processes', 'persistence', 'network'] }) => {
                const mockResult = {
                    host,
                    artifact_types,
                    processes: [
                        { pid: 4821, name: 'svchost.exe', path: 'C:\\Windows\\System32\\svchost.exe', parent_pid: 532, status: 'normal' },
                        {
                            pid: 9312,
                            name: 'beacon.exe',
                            path: 'C:\\Users\\jsmith\\AppData\\Roaming\\beacon.exe',
                            parent_pid: 4821,
                            status: 'SUSPICIOUS - unsigned binary in user appdata'
                        }
                    ],
                    persistence: [
                        {
                            type: 'registry_run',
                            key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
                            value: 'updater',
                            data: 'C:\\Users\\jsmith\\AppData\\Roaming\\beacon.exe',
                            status: 'SUSPICIOUS'
                        }
                    ],
                    ioc_summary: 'Found unsigned binary beacon.exe with registry persistence. Consistent with Cobalt Strike beacon.',
                    timestamp: new Date().toISOString()
                }
                return JSON.stringify(mockResult, null, 2)
            }
        })
    }
}

module.exports = { nodeClass: RunForensicScan_Tools }
