import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class CreateIncidentTicket_Tools implements INode {
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
        this.label = 'Create Incident Ticket'
        this.name = 'createIncidentTicket'
        this.version = 1.0
        this.type = 'CreateIncidentTicket'
        this.icon = 'ticket.svg'
        this.category = 'Tools'
        this.description = '[IR] Create a security incident ticket in the ticketing system'
        this.baseClasses = [this.type, ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = []
    }

    async init(_nodeData: INodeData): Promise<any> {
        return new DynamicStructuredTool({
            name: 'createIncidentTicket',
            description: 'Create a new security incident ticket with title, severity, affected host, and description.',
            schema: z.object({
                title: z.string().describe('Short ticket title'),
                severity: z.enum(['critical', 'high', 'medium', 'low']).describe('Incident severity'),
                affected_host: z.string().describe('Hostname or IP of affected system'),
                description: z.string().describe('Full incident description and initial findings'),
                assignee: z.string().optional().describe('Analyst to assign the ticket to')
            }),
            func: async ({ title, severity, affected_host, description, assignee = 'soc-team' }) => {
                const ticketId = `INC-${Date.now().toString().slice(-6)}`
                const ticket = {
                    ticket_id: ticketId,
                    title,
                    severity,
                    affected_host,
                    description,
                    assignee,
                    status: 'open',
                    created_at: new Date().toISOString()
                }
                // Persist to a local file for demo purposes
                const ticketsFile = path.join(process.cwd(), 'incident-tickets.jsonl')
                fs.appendFileSync(ticketsFile, JSON.stringify(ticket) + '\n', 'utf8')
                return JSON.stringify(
                    { success: true, ticket_id: ticketId, message: `Ticket ${ticketId} created and assigned to ${assignee}` },
                    null,
                    2
                )
            }
        })
    }
}

module.exports = { nodeClass: CreateIncidentTicket_Tools }
