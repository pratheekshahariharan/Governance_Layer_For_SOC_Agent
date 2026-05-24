/**
 * Seed script — registers all 12 CyberSecIR tools into the Flowise Tools section.
 * Run: node seed-cybersec-tools.js
 * Requires Flowise server running on PORT (default 3000).
 */

const http = require('http')

const PORT = process.env.PORT || 3000
const BASE_URL = `http://localhost:${PORT}`

const tools = [
    // ── ALLOW tools ─────────────────────────────────────────────────────────
    {
        name: 'lookupThreatIntel',
        description:
            '[IR] [ALLOW] Query threat intelligence databases for IPs, hashes, or domains. Returns threat score, classification, tags, and associated malware.',
        color: '#2196F3',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                ioc: { type: 'string', description: 'Indicator of Compromise — IP address, domain, file hash, or URL' },
                ioc_type: { type: 'string', description: 'Type of IOC: ip | domain | hash | url' }
            },
            required: ['ioc', 'ioc_type']
        }),
        func: `const result = {
  success: true,
  ioc,
  ioc_type,
  threat_score: 95,
  classification: 'Malicious',
  tags: ['C2', 'APT28', 'Cobalt Strike'],
  first_seen: '2024-01-15',
  last_seen: new Date().toISOString().split('T')[0],
  associated_malware: ['CobaltStrike.Beacon', 'Emotet'],
  geo_location: { country: 'RU', city: 'Moscow' },
  reports: ['https://attack.mitre.org/groups/G0007/'],
  note: 'Known C2 server associated with APT28 campaigns. High confidence.'
};
return JSON.stringify(result, null, 2);`
    },
    {
        name: 'scanNetwork',
        description: '[IR] [ALLOW] Passive network scan to identify active hosts and open ports in a subnet. No changes to systems.',
        color: '#2196F3',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                target: { type: 'string', description: 'Target subnet or IP range (e.g. 192.168.1.0/24)' },
                scan_type: { type: 'string', description: 'Scan type: quick | full | stealth' }
            },
            required: ['target', 'scan_type']
        }),
        func: `const result = {
  success: true,
  target,
  scan_type,
  hosts_found: 12,
  suspicious_hosts: [
    { ip: '192.168.1.45', open_ports: [4444, 8080, 443], flags: ['unusual_port_4444', 'high_outbound'] },
    { ip: '192.168.1.72', open_ports: [22, 3389], flags: ['rdp_exposed'] }
  ],
  scan_duration_ms: 4200,
  completed_at: new Date().toISOString()
};
return JSON.stringify(result, null, 2);`
    },
    {
        name: 'runForensicScan',
        description:
            '[IR] [ALLOW] Read-only forensic analysis — collects running processes, registry keys, file hashes, and network connections from a host.',
        color: '#9C27B0',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                host: { type: 'string', description: 'Target host IP or hostname' },
                scan_depth: { type: 'string', description: 'Depth: quick | standard | deep' }
            },
            required: ['host', 'scan_depth']
        }),
        func: `const result = {
  success: true,
  host,
  scan_depth,
  findings: {
    suspicious_processes: [
      { pid: 4821, name: 'beacon.exe', path: 'C:\\\\Windows\\\\Temp\\\\beacon.exe', signed: false, parent: 'svchost.exe' }
    ],
    registry_persistence: ['HKCU\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run\\\\Updater'],
    network_connections: [
      { pid: 4821, remote_ip: '45.33.32.156', port: 443, protocol: 'TCP', state: 'ESTABLISHED' }
    ],
    iocs: ['45.33.32.156', 'beacon.exe', 'a3f1b2c4d5e6f789']
  },
  completed_at: new Date().toISOString()
};
return JSON.stringify(result, null, 2);`
    },
    {
        name: 'checkVulnerability',
        description: '[IR] [ALLOW] Check CVEs and known vulnerabilities for a host or service version. Read-only lookup.',
        color: '#FF5722',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                target: { type: 'string', description: 'Target host IP or hostname' },
                service: { type: 'string', description: 'Service and version (e.g. Apache 2.4.49, OpenSSH 7.2)' }
            },
            required: ['target', 'service']
        }),
        func: `const result = {
  success: true,
  target,
  service,
  vulnerabilities: [
    { cve: 'CVE-2021-41773', severity: 'CRITICAL', cvss: 9.8, description: 'Path traversal and RCE in Apache 2.4.49', patch: 'Upgrade to 2.4.51+' },
    { cve: 'CVE-2021-42013', severity: 'CRITICAL', cvss: 9.8, description: 'RCE via mod_cgi in Apache 2.4.49-50', patch: 'Upgrade to 2.4.51+' }
  ],
  patch_available: true,
  risk_rating: 'CRITICAL',
  recommendation: 'Immediate patching required. Actively exploited in the wild.'
};
return JSON.stringify(result, null, 2);`
    },
    {
        name: 'createIncidentTicket',
        description: '[IR] [ALLOW] Create an incident ticket in the ITSM system and assign it to the SOC team.',
        color: '#FF9800',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Incident title' },
                description: { type: 'string', description: 'Detailed incident description' },
                severity: { type: 'string', description: 'Severity: critical | high | medium | low' },
                affected_host: { type: 'string', description: 'Affected host IP or hostname' },
                assignee: { type: 'string', description: 'Team or analyst to assign to' }
            },
            required: ['title', 'description', 'severity', 'affected_host', 'assignee']
        }),
        func: `const ticketId = 'INC-' + Math.floor(Math.random() * 900000 + 100000);
const result = {
  success: true,
  ticket_id: ticketId,
  title,
  severity,
  affected_host,
  assignee,
  status: 'OPEN',
  created_at: new Date().toISOString(),
  message: 'Ticket ' + ticketId + ' created and assigned to ' + assignee
};
return JSON.stringify(result, null, 2);`
    },
    {
        name: 'generateReport',
        description: '[IR] [ALLOW] Generate a structured incident report with timeline, IOCs, affected systems, and recommendations.',
        color: '#4CAF50',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                incident_id: { type: 'string', description: 'Incident ID (e.g. INC-001)' },
                summary: { type: 'string', description: 'Executive summary of the incident' },
                affected_systems: { type: 'string', description: 'Comma-separated list of affected systems' },
                iocs: { type: 'string', description: 'Comma-separated list of IOCs' },
                recommendations: { type: 'string', description: 'Recommended remediation actions' }
            },
            required: ['incident_id', 'summary']
        }),
        func: `const reportId = 'RPT-' + incident_id;
const result = {
  success: true,
  report_id: reportId,
  incident_id,
  summary,
  affected_systems: affected_systems ? affected_systems.split(',').map(s => s.trim()) : [],
  iocs: iocs ? iocs.split(',').map(s => s.trim()) : [],
  recommendations: recommendations ? recommendations.split(',').map(s => s.trim()) : [],
  generated_at: new Date().toISOString(),
  format: 'JSON',
  message: 'Report ' + reportId + ' generated successfully.'
};
return JSON.stringify(result, null, 2);`
    },

    // ── ESCALATE tools ───────────────────────────────────────────────────────
    {
        name: 'isolateHost',
        description: '[IR] [ESCALATE] ⚠️ Isolate a host from the network by placing it in a quarantine VLAN. Requires human approval.',
        color: '#F44336',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                host: { type: 'string', description: 'Host IP or hostname to isolate' },
                reason: { type: 'string', description: 'Reason for isolation' },
                severity: { type: 'string', description: 'Incident severity: critical | high | medium' }
            },
            required: ['host', 'reason', 'severity']
        }),
        func: `const result = {
  success: true,
  host,
  severity,
  action: 'isolated',
  vlan: 'QUARANTINE-VLAN-99',
  allowed_traffic: ['management-plane-only'],
  reason,
  executed_at: new Date().toISOString(),
  note: 'Host successfully isolated. All inbound/outbound traffic blocked except management plane.'
};
return JSON.stringify(result, null, 2);`
    },
    {
        name: 'blockIP',
        description: '[IR] [ESCALATE] ⚠️ Block an IP address at the perimeter firewall. Requires human approval.',
        color: '#F44336',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                ip: { type: 'string', description: 'IP address to block' },
                reason: { type: 'string', description: 'Reason for blocking' },
                direction: { type: 'string', description: 'Direction: inbound | outbound | both' }
            },
            required: ['ip', 'reason', 'direction']
        }),
        func: `const ruleId = 'FW-BLOCK-' + Date.now();
const result = {
  success: true,
  rule_id: ruleId,
  blocked_ip: ip,
  direction,
  reason,
  firewall: 'perimeter-fw-01',
  applied_at: new Date().toISOString(),
  note: 'Firewall rule ' + ruleId + ' applied. IP ' + ip + ' blocked ' + direction + '.'
};
return JSON.stringify(result, null, 2);`
    },
    {
        name: 'resetCredentials',
        description: '[IR] [ESCALATE] ⚠️ Force-reset credentials for a compromised account. Requires human approval.',
        color: '#FF9800',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                username: { type: 'string', description: 'Username or email of the compromised account' },
                reason: { type: 'string', description: 'Reason for credential reset' },
                notify_user: { type: 'string', description: 'Notify the user by email: true | false' }
            },
            required: ['username', 'reason']
        }),
        func: `const result = {
  success: true,
  username,
  action: 'credentials_reset',
  sessions_invalidated: true,
  mfa_tokens_revoked: true,
  temporary_password_sent: notify_user === 'true',
  reason,
  executed_at: new Date().toISOString(),
  note: 'All active sessions terminated. Temporary password sent to registered email.'
};
return JSON.stringify(result, null, 2);`
    },
    {
        name: 'notifySOCTeam',
        description: '[IR] [ESCALATE] ⚠️ Send an alert to the SOC team via email and Slack. Requires human approval.',
        color: '#2196F3',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                message: { type: 'string', description: 'Alert message content' },
                severity: { type: 'string', description: 'Severity: critical | high | medium | low' },
                incident_id: { type: 'string', description: 'Associated incident ID' },
                channel: { type: 'string', description: 'Notification channel: email | slack | both' }
            },
            required: ['message', 'severity', 'incident_id', 'channel']
        }),
        func: `const result = {
  success: true,
  incident_id,
  severity,
  channel,
  recipients: ['soc-team@company.com', '#soc-alerts (Slack)'],
  message_preview: message.substring(0, 100),
  sent_at: new Date().toISOString(),
  note: 'Alert sent to SOC team via ' + channel + '.'
};
return JSON.stringify(result, null, 2);`
    },
    {
        name: 'quarantineFile',
        description: '[IR] [ESCALATE] ⚠️ Move a malicious file to an isolated quarantine directory. Requires human approval.',
        color: '#FF9800',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                host: { type: 'string', description: 'Host where the file resides' },
                file_path: { type: 'string', description: 'Full path to the malicious file' },
                reason: { type: 'string', description: 'Reason for quarantining' }
            },
            required: ['host', 'file_path', 'reason']
        }),
        func: `const fileName = file_path.split('\\\\').pop() || file_path.split('/').pop();
const quarantinePath = 'C:\\\\Quarantine\\\\' + Date.now() + '_' + fileName;
const result = {
  success: true,
  host,
  original_path: file_path,
  quarantine_path: quarantinePath,
  reason,
  file_hash_sha256: 'a3f1b2c4d5e6f7890123456789abcdef0123456789abcdef0123456789abcdef',
  executed_at: new Date().toISOString(),
  note: 'File moved to quarantine. Original location is now inaccessible.'
};
return JSON.stringify(result, null, 2);`
    },

    // ── BLOCK tool ───────────────────────────────────────────────────────────
    {
        name: 'wipeDevice',
        description:
            '[IR] [BLOCK] 🚫 BLOCKED BY POLICY — Wipe all data from a device. This action is permanently blocked by the governance policy engine.',
        color: '#B71C1C',
        iconSrc: '',
        schema: JSON.stringify({
            type: 'object',
            properties: {
                host: { type: 'string', description: 'Host to wipe' },
                reason: { type: 'string', description: 'Reason for wiping' },
                wipe_type: { type: 'string', description: 'Wipe type: quick | secure | dod7' }
            },
            required: ['host', 'reason', 'wipe_type']
        }),
        func: `return JSON.stringify({
  success: false,
  blocked: true,
  policy_rule: 'block-wipe-device',
  message: 'BLOCKED BY GOVERNANCE POLICY: Irreversible data destruction is not permitted by automated agents. Raise a change-control ticket.',
  host,
  reason
}, null, 2);`
    }
]

async function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body)
        const options = {
            hostname: 'localhost',
            port: PORT,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }
        const req = http.request(options, (res) => {
            let raw = ''
            res.on('data', (chunk) => (raw += chunk))
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(raw) })
                } catch {
                    resolve({ status: res.statusCode, body: raw })
                }
            })
        })
        req.on('error', reject)
        req.write(data)
        req.end()
    })
}

async function getAll() {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${PORT}/api/v1/tools`, (res) => {
            let raw = ''
            res.on('data', (chunk) => (raw += chunk))
            res.on('end', () => {
                try {
                    resolve(JSON.parse(raw))
                } catch {
                    resolve([])
                }
            })
        }).on('error', reject)
    })
}

async function seed() {
    console.log(`\n🔧 Seeding CyberSecIR tools into Flowise at http://localhost:${PORT}\n`)

    // Fetch existing tools to avoid duplicates
    const existing = await getAll()
    const existingNames = new Set((existing || []).map((t) => t.name))
    console.log(`Found ${existingNames.size} existing tool(s): ${[...existingNames].join(', ') || 'none'}\n`)

    let created = 0
    let skipped = 0

    for (const tool of tools) {
        if (existingNames.has(tool.name)) {
            console.log(`  ⏭  Skipping  ${tool.name} (already exists)`)
            skipped++
            continue
        }
        try {
            const res = await post('/api/v1/tools', tool)
            if (res.status === 200 || res.status === 201) {
                console.log(`  ✅ Created   ${tool.name}`)
                created++
            } else {
                console.log(`  ❌ Failed    ${tool.name} — HTTP ${res.status}: ${JSON.stringify(res.body).substring(0, 120)}`)
            }
        } catch (e) {
            console.log(`  ❌ Error     ${tool.name} — ${e.message}`)
        }
    }

    console.log(`\n Done. Created: ${created}  Skipped: ${skipped}  Total: ${tools.length}\n`)
    console.log(`  Open http://localhost:${PORT}/tools to see them.\n`)
}

seed().catch(console.error)
