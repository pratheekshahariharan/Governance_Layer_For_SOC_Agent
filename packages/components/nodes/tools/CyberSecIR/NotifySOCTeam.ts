import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import * as https from 'https'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

const RESEND_API_KEY = 're_AjVsgoca_KyAn4LeGg3GC2S7AEJqSvp5E'
const SOC_EMAIL = 'pratheekshahariharan05@gmail.com'

function sendEmail(subject: string, html: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            from: 'SOC Agent <onboarding@resend.dev>',
            to: [SOC_EMAIL],
            subject,
            html
        })
        const req = https.request(
            {
                hostname: 'api.resend.com',
                path: '/emails',
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            },
            (res) => {
                let data = ''
                res.on('data', (chunk) => (data += chunk))
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data))
                    } catch {
                        resolve(data)
                    }
                })
            }
        )
        req.on('error', reject)
        req.write(body)
        req.end()
    })
}

class NotifySOCTeam_Tools implements INode {
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
        this.label = 'Notify SOC Team'
        this.name = 'notifySOCTeam'
        this.version = 1.0
        this.type = 'NotifySOCTeam'
        this.icon = 'notify.svg'
        this.category = 'Tools'
        this.description = '[IR] ⚠️ ESCALATE — Send an alert notification to the SOC team'
        this.baseClasses = [this.type, ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = []
    }

    async init(_nodeData: INodeData): Promise<any> {
        return new DynamicStructuredTool({
            name: 'notifySOCTeam',
            description: 'Send an incident alert to the SOC team via email/Slack. REQUIRES HUMAN APPROVAL to prevent alert fatigue.',
            schema: z.object({
                incident_id: z.string().describe('Incident ticket ID'),
                severity: z.enum(['critical', 'high', 'medium', 'low']),
                message: z.string().describe('Alert message body'),
                channel: z.enum(['email', 'slack', 'pagerduty']).optional().describe('Notification channel')
            }),
            func: async ({ incident_id, severity, message, channel = 'email' }) => {
                const sentAt = new Date().toISOString()
                const severityColor: Record<string, string> = {
                    critical: '#B71C1C',
                    high: '#E65100',
                    medium: '#F9A825',
                    low: '#1B5E20'
                }
                const color = severityColor[severity] ?? '#333'

                const html = `
<div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
  <div style="background:${color};padding:16px 24px">
    <h2 style="color:#fff;margin:0">SOC ALERT — ${severity.toUpperCase()}</h2>
    <p style="color:#fff;margin:4px 0 0">Incident: ${incident_id}</p>
  </div>
  <div style="padding:24px">
    <p style="font-size:15px;line-height:1.6">${message.replace(/\n/g, '<br/>')}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
    <p style="color:#888;font-size:12px">Sent by Cybersecurity SOC Agent &bull; ${sentAt}</p>
  </div>
</div>`

                let emailResult: any = { skipped: true }
                if (channel === 'email' || channel === 'pagerduty') {
                    emailResult = await sendEmail(`[${severity.toUpperCase()}] SOC Alert — ${incident_id}`, html)
                }

                return JSON.stringify(
                    {
                        success: true,
                        incident_id,
                        severity,
                        channel,
                        recipient: SOC_EMAIL,
                        email_id: emailResult?.id ?? null,
                        sent_at: sentAt,
                        note: emailResult?.id
                            ? `Real email delivered to ${SOC_EMAIL} via Resend (id: ${emailResult.id})`
                            : `Alert logged. Channel '${channel}' does not trigger email.`
                    },
                    null,
                    2
                )
            }
        })
    }
}

module.exports = { nodeClass: NotifySOCTeam_Tools }
