import { flatten } from 'lodash'
import { Tool } from '@langchain/core/tools'
import { BaseMessage } from '@langchain/core/messages'
import { ChainValues } from '@langchain/core/utils/types'
import { RunnableSequence } from '@langchain/core/runnables'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ChatPromptTemplate, MessagesPlaceholder, HumanMessagePromptTemplate, PromptTemplate } from '@langchain/core/prompts'
import { formatToOpenAIToolMessages } from 'langchain/agents/format_scratchpad/openai_tools'
import { type ToolsAgentStep } from 'langchain/agents/openai/output_parser'
import {
    extractOutputFromArray,
    getBaseClasses,
    handleEscapeCharacters,
    removeInvalidImageMarkdown,
    transformBracesWithColon
} from '../../../src/utils'
import {
    FlowiseMemory,
    ICommonObject,
    INode,
    INodeData,
    INodeParams,
    IServerSideEventStreamer,
    IUsedTool,
    IVisionChatModal
} from '../../../src/Interface'
import { ConsoleCallbackHandler, CustomChainHandler, CustomStreamingHandler, additionalCallbacks } from '../../../src/handler'
import { AgentExecutor, ToolCallingAgentOutputParser } from '../../../src/agents'
import { Moderation, checkInputs, streamResponse } from '../../moderation/Moderation'
import { formatResponse } from '../../outputparsers/OutputParserHelpers'
import { addImagesToMessages, llmSupportsVision } from '../../../src/multiModalUtils'
import { validateWithLLM } from '../../../src/llmJudge'
import { appendAgentAuditEntry } from '../../../src/auditLog'

class ToolAgent_Agents implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    badge: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]
    sessionId?: string

    constructor(fields?: { sessionId?: string }) {
        this.label = 'Tool Agent'
        this.name = 'toolAgent'
        this.version = 2.0
        this.type = 'AgentExecutor'
        this.category = 'Agents'
        this.icon = 'toolAgent.png'
        this.badge = 'GOVERNANCE'
        this.description = `Agent that uses Function Calling to pick the tools and args to call`
        this.baseClasses = [this.type, ...getBaseClasses(AgentExecutor)]
        this.inputs = [
            {
                label: 'Tools',
                name: 'tools',
                type: 'Tool',
                list: true
            },
            {
                label: 'Memory',
                name: 'memory',
                type: 'BaseChatMemory'
            },
            {
                label: 'Tool Calling Chat Model',
                name: 'model',
                type: 'BaseChatModel',
                description:
                    'Only compatible with models that are capable of function calling: ChatOpenAI, ChatMistral, ChatAnthropic, ChatGoogleGenerativeAI, ChatVertexAI, GroqChat'
            },
            {
                label: 'Chat Prompt Template',
                name: 'chatPromptTemplate',
                type: 'ChatPromptTemplate',
                description: 'Override existing prompt with Chat Prompt Template. Human Message must includes {input} variable',
                optional: true
            },
            {
                label: 'System Message',
                name: 'systemMessage',
                type: 'string',
                default: `You are a helpful AI assistant.`,
                description: 'If Chat Prompt Template is provided, this will be ignored',
                rows: 4,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Input Moderation',
                description: 'Detect text that could generate harmful output and prevent it from being sent to the language model',
                name: 'inputModeration',
                type: 'Moderation',
                optional: true,
                list: true
            },
            {
                label: 'Max Iterations',
                name: 'maxIterations',
                type: 'number',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Enable Detailed Streaming',
                name: 'enableDetailedStreaming',
                type: 'boolean',
                default: false,
                description: 'Stream detailed intermediate steps during agent execution',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Enable LLM Validation',
                name: 'validationEnabled',
                type: 'boolean',
                default: false,
                description: 'Validate agent input and output using an LLM-as-judge before and after execution',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Validation Judge Model',
                name: 'validationModel',
                type: 'BaseChatModel',
                description: 'The LLM used as a judge to validate inputs and outputs',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Input Validation Criteria',
                name: 'inputValidationCriteria',
                type: 'string',
                rows: 3,
                default:
                    'Must be a valid cybersecurity incident alert containing a specific threat, affected host or IP, and severity level.',
                description: 'Criteria the agent input must satisfy. Checked by the judge LLM before the agent runs.',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Output Validation Criteria',
                name: 'outputValidationCriteria',
                type: 'string',
                rows: 3,
                default:
                    'Response must not expose raw credentials, private keys, or internal hostnames. Must include a clear recommended action.',
                description: 'Criteria the agent output must satisfy. Checked by the judge LLM after the agent finishes.',
                optional: true,
                additionalParams: true
            }
        ]
        this.sessionId = fields?.sessionId
    }

    async init(nodeData: INodeData, input: string, options: ICommonObject): Promise<any> {
        return prepareAgent(nodeData, options, { sessionId: this.sessionId, chatId: options.chatId, input })
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<string | ICommonObject> {
        const memory = nodeData.inputs?.memory as FlowiseMemory
        const moderations = nodeData.inputs?.inputModeration as Moderation[]
        const enableDetailedStreaming = nodeData.inputs?.enableDetailedStreaming as boolean
        const validationEnabled = nodeData.inputs?.validationEnabled as boolean
        const validationModel = nodeData.inputs?.validationModel as BaseChatModel | undefined
        const inputValidationCriteria = (nodeData.inputs?.inputValidationCriteria as string) || ''
        const outputValidationCriteria = (nodeData.inputs?.outputValidationCriteria as string) || ''

        const shouldStreamResponse = options.shouldStreamResponse
        const sseStreamer: IServerSideEventStreamer = options.sseStreamer as IServerSideEventStreamer
        const chatId = options.chatId

        if (moderations && moderations.length > 0) {
            try {
                // Use the output of the moderation chain as input for the OpenAI Function Agent
                input = await checkInputs(moderations, input)
            } catch (e) {
                await new Promise((resolve) => setTimeout(resolve, 500))
                if (shouldStreamResponse) {
                    streamResponse(sseStreamer, chatId, e.message)
                }
                return formatResponse(e.message)
            }
        }

        // ── Milestone 1: Agent-level INPUT validation (LLM-as-judge) ──────────
        if (validationEnabled && validationModel && inputValidationCriteria) {
            const inputCheck = await validateWithLLM(input, inputValidationCriteria, validationModel)
            appendAgentAuditEntry({
                sessionId: this.sessionId,
                chatId,
                type: 'agent_input_validation',
                content: input,
                validation: inputCheck,
                criteria: inputValidationCriteria
            })
            if (!inputCheck.valid) {
                const msg = `[INPUT VALIDATION FAILED] ${inputCheck.reason}`
                if (shouldStreamResponse) streamResponse(sseStreamer, chatId, msg)
                return formatResponse(msg)
            }
        }

        const executor = await prepareAgent(nodeData, options, {
            sessionId: this.sessionId,
            chatId: options.chatId,
            input,
            judgeModel: validationEnabled && validationModel ? validationModel : undefined
        })

        const loggerHandler = new ConsoleCallbackHandler(options.logger)
        const callbacks = await additionalCallbacks(nodeData, options)

        // Add custom streaming handler if detailed streaming is enabled
        let customStreamingHandler = null

        if (enableDetailedStreaming && shouldStreamResponse) {
            customStreamingHandler = new CustomStreamingHandler(sseStreamer, chatId)
        }

        let res: ChainValues = {}
        let sourceDocuments: ICommonObject[] = []
        let usedTools: IUsedTool[] = []
        let artifacts = []

        if (shouldStreamResponse) {
            const handler = new CustomChainHandler(sseStreamer, chatId)
            const allCallbacks = [loggerHandler, handler, ...callbacks]

            // Add detailed streaming handler if enabled
            if (enableDetailedStreaming && customStreamingHandler) {
                allCallbacks.push(customStreamingHandler)
            }

            res = await executor.invoke({ input }, { callbacks: allCallbacks })
            if (res.sourceDocuments) {
                if (sseStreamer) {
                    sseStreamer.streamSourceDocumentsEvent(chatId, flatten(res.sourceDocuments))
                }
                sourceDocuments = res.sourceDocuments
            }
            if (res.usedTools) {
                if (sseStreamer) {
                    sseStreamer.streamUsedToolsEvent(chatId, flatten(res.usedTools))
                }
                usedTools = res.usedTools
            }
            if (res.artifacts) {
                if (sseStreamer) {
                    sseStreamer.streamArtifactsEvent(chatId, flatten(res.artifacts))
                }
                artifacts = res.artifacts
            }
            // If the tool is set to returnDirect, stream the output to the client
            if (res.usedTools && res.usedTools.length) {
                let inputTools = nodeData.inputs?.tools
                inputTools = flatten(inputTools)
                for (const tool of res.usedTools) {
                    const inputTool = inputTools.find((inputTool: Tool) => inputTool.name === tool.tool)
                    if (inputTool && inputTool.returnDirect && shouldStreamResponse) {
                        sseStreamer.streamTokenEvent(chatId, tool.toolOutput)
                    }
                }
            }
        } else {
            const allCallbacks = [loggerHandler, ...callbacks]

            // Add detailed streaming handler if enabled
            if (enableDetailedStreaming && customStreamingHandler) {
                allCallbacks.push(customStreamingHandler)
            }

            res = await executor.invoke({ input }, { callbacks: allCallbacks })
            if (res.sourceDocuments) {
                sourceDocuments = res.sourceDocuments
            }
            if (res.usedTools) {
                usedTools = res.usedTools
            }
            if (res.artifacts) {
                artifacts = res.artifacts
            }
        }

        let output = res?.output
        output = extractOutputFromArray(res?.output)
        output = removeInvalidImageMarkdown(output)

        // ── Milestone 1: Agent-level OUTPUT validation (LLM-as-judge) ─────────
        if (validationEnabled && validationModel && outputValidationCriteria) {
            const outputCheck = await validateWithLLM(output, outputValidationCriteria, validationModel)
            appendAgentAuditEntry({
                sessionId: this.sessionId,
                chatId,
                type: 'agent_output_validation',
                content: output,
                validation: outputCheck,
                criteria: outputValidationCriteria
            })
            if (!outputCheck.valid) {
                output += `\n\n[OUTPUT VALIDATION WARNING] ${outputCheck.reason}`
            }
        }

        // Claude 3 Opus tends to spit out <thinking>..</thinking> as well, discard that in final output
        // https://docs.anthropic.com/en/docs/build-with-claude/tool-use#chain-of-thought
        const regexPattern: RegExp = /<thinking>[\s\S]*?<\/thinking>/
        const matches: RegExpMatchArray | null = output.match(regexPattern)
        if (matches) {
            for (const match of matches) {
                output = output.replace(match, '')
            }
        }

        await memory.addChatMessages(
            [
                {
                    text: input,
                    type: 'userMessage'
                },
                {
                    text: output,
                    type: 'apiMessage'
                }
            ],
            this.sessionId
        )

        let finalRes = output

        if (sourceDocuments.length || usedTools.length || artifacts.length) {
            const finalRes: ICommonObject = { text: output }
            if (sourceDocuments.length) {
                finalRes.sourceDocuments = flatten(sourceDocuments)
            }
            if (usedTools.length) {
                finalRes.usedTools = usedTools
            }
            if (artifacts.length) {
                finalRes.artifacts = artifacts
            }
            return finalRes
        }

        return finalRes
    }
}

const prepareAgent = async (
    nodeData: INodeData,
    options: ICommonObject,
    flowObj: { sessionId?: string; chatId?: string; input?: string; judgeModel?: BaseChatModel }
) => {
    const model = nodeData.inputs?.model as BaseChatModel
    const maxIterations = nodeData.inputs?.maxIterations as string
    const memory = nodeData.inputs?.memory as FlowiseMemory
    let systemMessage = nodeData.inputs?.systemMessage as string
    let tools = nodeData.inputs?.tools
    tools = flatten(tools)
    const memoryKey = memory.memoryKey ? memory.memoryKey : 'chat_history'
    const inputKey = memory.inputKey ? memory.inputKey : 'input'
    const prependMessages = options?.prependMessages

    systemMessage = transformBracesWithColon(systemMessage)

    let prompt = ChatPromptTemplate.fromMessages([
        ['system', systemMessage],
        new MessagesPlaceholder(memoryKey),
        ['human', `{${inputKey}}`],
        new MessagesPlaceholder('agent_scratchpad')
    ])

    let promptVariables = {}
    const chatPromptTemplate = nodeData.inputs?.chatPromptTemplate as ChatPromptTemplate
    if (chatPromptTemplate && chatPromptTemplate.promptMessages.length) {
        const humanPrompt = chatPromptTemplate.promptMessages[chatPromptTemplate.promptMessages.length - 1]
        const messages = [
            ...chatPromptTemplate.promptMessages.slice(0, -1),
            new MessagesPlaceholder(memoryKey),
            humanPrompt,
            new MessagesPlaceholder('agent_scratchpad')
        ]
        prompt = ChatPromptTemplate.fromMessages(messages)
        if ((chatPromptTemplate as any).promptValues) {
            const promptValuesRaw = (chatPromptTemplate as any).promptValues
            const promptValues = handleEscapeCharacters(promptValuesRaw, true)
            for (const val in promptValues) {
                promptVariables = {
                    ...promptVariables,
                    [val]: () => {
                        return promptValues[val]
                    }
                }
            }
        }
    }

    if (llmSupportsVision(model)) {
        const visionChatModel = model as IVisionChatModal
        const messageContent = await addImagesToMessages(nodeData, options, model.multiModalOption)

        if (messageContent?.length) {
            visionChatModel.setVisionModel()

            // Pop the `agent_scratchpad` MessagePlaceHolder
            let messagePlaceholder = prompt.promptMessages.pop() as MessagesPlaceholder
            if (prompt.promptMessages.at(-1) instanceof HumanMessagePromptTemplate) {
                const lastMessage = prompt.promptMessages.pop() as HumanMessagePromptTemplate
                const template = (lastMessage.prompt as PromptTemplate).template as string
                const msg = HumanMessagePromptTemplate.fromTemplate([
                    ...messageContent,
                    {
                        text: template
                    }
                ])
                msg.inputVariables = lastMessage.inputVariables
                prompt.promptMessages.push(msg)
            }

            // Add the `agent_scratchpad` MessagePlaceHolder back
            prompt.promptMessages.push(messagePlaceholder)
        } else {
            visionChatModel.revertToOriginalModel()
        }
    }

    if (model.bindTools === undefined) {
        throw new Error(`This agent requires that the "bindTools()" method be implemented on the input model.`)
    }

    const modelWithTools = model.bindTools(tools)

    const runnableAgent = RunnableSequence.from([
        {
            [inputKey]: (i: { input: string; steps: ToolsAgentStep[] }) => i.input,
            agent_scratchpad: (i: { input: string; steps: ToolsAgentStep[] }) => formatToOpenAIToolMessages(i.steps),
            [memoryKey]: async (_: { input: string; steps: ToolsAgentStep[] }) => {
                const messages = (await memory.getChatMessages(flowObj?.sessionId, true, prependMessages)) as BaseMessage[]
                return messages ?? []
            },
            ...promptVariables
        },
        prompt,
        modelWithTools,
        new ToolCallingAgentOutputParser()
    ])

    const executor = AgentExecutor.fromAgentAndTools({
        agent: runnableAgent,
        tools,
        sessionId: flowObj?.sessionId,
        chatId: flowObj?.chatId,
        input: flowObj?.input,
        verbose: process.env.DEBUG === 'true',
        maxIterations: maxIterations ? parseFloat(maxIterations) : undefined,
        judgeModel: flowObj?.judgeModel
    })

    return executor
}

module.exports = { nodeClass: ToolAgent_Agents }
