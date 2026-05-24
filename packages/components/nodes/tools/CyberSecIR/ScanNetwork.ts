import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class ScanNetwork_Tools implements INode {
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
        this.label = 'Scan Network'
        this.name = 'scanNetwork'
        this.version = 1.0
        this.type = 'ScanNetwork'
        this.icon = 'scan.svg'
        this.category = 'Tools'
        this.description = '[IR] Run a passive network scan to identify open ports and active connections on a host'
        this.baseClasses = [this.type, ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = []
    }

    async init(_nodeData: INodeData): Promise<any> {
        return new DynamicStructuredTool({
            name: 'scanNetwork',
            description: 'Perform a network scan of a host to identify open ports, services, and suspicious outbound connections.',
            schema: z.object({
                host: z.string().describe('IP address or hostname to scan'),
                scan_type: z.enum(['quick', 'full', 'stealth']).optional().describe('Scan intensity')
            }),
            func: async ({ host, scan_type = 'quick' }) => {
                const mockResult = {
                    host,
                    scan_type,
                    open_ports: [22, 80, 443, 4444],
                    suspicious_connections: [
                        { remote_ip: '45.33.32.156', remote_port: 443, protocol: 'TCP', bytes_sent: 184320, status: 'ESTABLISHED' }
                    ],
                    services: {
                        22: 'SSH OpenSSH_8.9',
                        80: 'HTTP nginx/1.24',
                        443: 'HTTPS nginx/1.24',
                        4444: 'UNKNOWN - possible reverse shell'
                    },
                    scan_duration_ms: 1240,
                    timestamp: new Date().toISOString()
                }
                return JSON.stringify(mockResult, null, 2)
            }
        })
    }
}

module.exports = { nodeClass: ScanNetwork_Tools }
