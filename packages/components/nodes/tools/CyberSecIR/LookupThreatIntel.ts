import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class LookupThreatIntel_Tools implements INode {
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
        this.label = 'Lookup Threat Intel'
        this.name = 'lookupThreatIntel'
        this.version = 1.0
        this.type = 'LookupThreatIntel'
        this.icon = 'threatintel.svg'
        this.category = 'Tools'
        this.description = '[IR] Query threat intelligence databases for IPs, hashes, or domains'
        this.baseClasses = [this.type, ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = []
    }

    async init(_nodeData: INodeData): Promise<any> {
        return new DynamicStructuredTool({
            name: 'lookupThreatIntel',
            description:
                'Query threat intelligence for an IP address, file hash, or domain name. Returns reputation score, known malware families, and C2 associations.',
            schema: z.object({
                indicator: z.string().describe('IP address, file hash (MD5/SHA256), or domain to look up'),
                indicator_type: z.enum(['ip', 'hash', 'domain']).describe('Type of indicator')
            }),
            func: async ({ indicator, indicator_type }) => {
                // Mock threat intel response
                const mockData: Record<string, any> = {
                    '45.33.32.156': {
                        reputation: 'malicious',
                        confidence: 95,
                        tags: ['C2', 'cobalt-strike', 'APT28'],
                        first_seen: '2024-11-01',
                        last_seen: '2026-05-22',
                        asn: 'AS63949 Akamai Technologies',
                        country: 'US',
                        verdict: 'Known Cobalt Strike C2 server associated with APT28 campaigns'
                    }
                }
                const result = mockData[indicator] ?? {
                    reputation: 'unknown',
                    confidence: 30,
                    tags: [],
                    verdict: `No threat intelligence found for ${indicator_type}: ${indicator}`
                }
                return JSON.stringify({ indicator, indicator_type, ...result }, null, 2)
            }
        })
    }
}

module.exports = { nodeClass: LookupThreatIntel_Tools }
