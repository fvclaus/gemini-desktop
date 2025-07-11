import { z } from 'zod';
import { AbstractGeminiModel } from './models';

export const AbstractGeminiModelSchema = z.string().transform((modelName) => {
  return AbstractGeminiModel.forModel(modelName);
});

const GeminiUsageMetadataSchema = z.object({
  cachedContentTokenCount: z.number().optional(),
  candidatesTokenCount: z.number().optional(),
  promptTokenCount: z.number().optional(),
  thoughtsTokenCount: z.number().optional(),
  toolUsePromptTokenCount: z.number().optional(),
  totalTokenCount: z.number().optional(),
});

const AiMessageSchema = z.object({
  id: z.string(),
  sender: z.literal('ai'),
  type: z.literal('message'),
  text: z.string(),
  htmlContent: z.string(),
  timestamp: z.preprocess((arg) => new Date(arg as string), z.date()),
  usageMetadata: GeminiUsageMetadataSchema.optional(),
  model: AbstractGeminiModelSchema,
});

export type AiMessage = z.infer<typeof AiMessageSchema>;

const ToolRequestMessageSchema = z.object({
  id: z.string(),
  sender: z.literal('ai'),
  type: z.literal('tool_request'),
  tools: z.array(
    z.object({
      serverName: z.string(),
      toolName: z.string(),
      args: z.record(z.unknown()).optional(),
    }),
  ),
  showRequestedTools: z.boolean().optional(),
  timestamp: z.preprocess((arg) => new Date(arg as string), z.date()),
  usageMetadata: GeminiUsageMetadataSchema.optional(),
  model: AbstractGeminiModelSchema,
});

export type ToolRequestMessage = z.infer<typeof ToolRequestMessageSchema>;

const UserMessageSchema = z.object({
  id: z.string(),
  sender: z.literal('user'),
  type: z.literal('message'),
  text: z.string(),
  timestamp: z.preprocess((arg) => new Date(arg as string), z.date()),
});

export type UserMessage = z.infer<typeof UserMessageSchema>;

const LoadingMessageSchema = z.object({
  id: z.string(),
  sender: z.literal('ai'),
  type: z.literal('loading'),
  timestamp: z.preprocess((arg) => new Date(arg as string), z.date()),
});

export type LoadingMessage = z.infer<typeof LoadingMessageSchema>;

const SystemErrorMessageSchema = z.object({
  id: z.string(),
  sender: z.literal('system'),
  type: z.literal('error'),
  text: z.string(),
  details: z.string().optional(),
  showDetails: z.boolean().optional(),
  timestamp: z.preprocess((arg) => new Date(arg as string), z.date()),
});

export type SystemErrorMessage = z.infer<typeof SystemErrorMessageSchema>;

const ToolDecisionMessageSchema = z.object({
  id: z.string(),
  sender: z.literal('user'),
  type: z.literal('tool_decision'),
  approval: z.union([z.literal('approved'), z.literal('rejected')]),
  timestamp: z.preprocess((arg) => new Date(arg as string), z.date()),
});

export type ToolDecisionMessage = z.infer<typeof ToolDecisionMessageSchema>;

const ToolResultMessageSchema = z.object({
  id: z.string(),
  sender: z.literal('system'),
  type: z.literal('tool_result'),
  tool: z.object({
    name: z.string(),
    args: z.record(z.unknown()).optional(),
  }),
  result: z.record(z.unknown()),
  showToolResults: z.boolean().optional(),
  timestamp: z.preprocess((arg) => new Date(arg as string), z.date()),
});

export type ToolResultMessage = z.infer<typeof ToolResultMessageSchema>;

export const MessageSchema = z.union([
  UserMessageSchema,
  LoadingMessageSchema,
  SystemErrorMessageSchema,
  AiMessageSchema,
  ToolRequestMessageSchema,
  ToolResultMessageSchema,
  ToolDecisionMessageSchema,
]);

export type Message = z.infer<typeof MessageSchema>;
