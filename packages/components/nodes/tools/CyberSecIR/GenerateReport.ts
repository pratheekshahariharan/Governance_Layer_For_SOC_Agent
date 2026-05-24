import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class GenerateReport_Tools implements INode {
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
        this.label = 'Generate IR Report'
        this.name = 'generateReport'
        this.version = 1.0
        this.type = 'GenerateReport'
        this.icon = 'report.svg'
        this.category = 'Tools'
        this.description = '[IR] Compile and save a structured incident response report'
        this.baseClasses = [this.type, ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = []
    }

    async init(_nodeData: INodeData): Promise<any> {
        return new DynamicStructuredTool({
            name: 'generateReport',
            description:
                'Generate a structured incident response report summarising findings, timeline, IOCs, and recommended remediation steps.',
            schema: z.object({
                incident_id: z.string().describe('Incident or ticket ID'),
                summary: z.string().describe('Executive summary of the incident'),
                affected_systems: z.array(z.string()).describe('List of affected hosts/IPs'),
                iocs: z.array(z.string()).describe('Indicators of compromise found'),
                timeline: z.array(z.string()).describe('Ordered list of events'),
                recommendations: z.array(z.string()).describe('Remediation steps')
            }),
            func: async ({ incident_id, summary, affected_systems, iocs, timeline, recommendations }) => {
                const report = {
                    report_id: `RPT-${incident_id}`,
                    generated_at: new Date().toISOString(),
                    incident_id,
                    summary,
                    affected_systems,
                    iocs,
                    timeline,
                    recommendations,
                    status: 'draft'
                }
                const reportFile = path.join(process.cwd(), `ir-report-${incident_id}.json`)
                fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8')
                return JSON.stringify({ success: true, report_id: report.report_id, saved_to: reportFile }, null, 2)
            }
        })
    }
}

module.exports = { nodeClass: GenerateReport_Tools }
