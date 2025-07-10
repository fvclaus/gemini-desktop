import { ChatSession } from './chat-session.interface';
import {
  AiMessage,
  Message,
  ToolRequestMessage,
  UserMessage,
  LoadingMessage,
  SystemErrorMessage,
  ToolDecisionMessage,
  ToolResultMessage,
} from './chat.service';
import { SettingsService } from './settings.service';
import { Profile, PersistedProfile } from './profile.interface';

export type SerializedAiMessage = Omit<AiMessage, 'model'> & { model: string };
export type SerializedToolRequestMessage = Omit<ToolRequestMessage, 'model'> & {
  model: string;
};

type SerializedMessage =
  | SerializedAiMessage
  | SerializedToolRequestMessage
  | UserMessage
  | LoadingMessage
  | SystemErrorMessage
  | ToolDecisionMessage
  | ToolResultMessage;

export interface SerializedChatSession {
  id: string;
  startTime: Date;
  messages: SerializedMessage[];
}

export function deserializeChatSession(
  session: SerializedChatSession,
  settingsService: SettingsService,
): ChatSession {
  const deserializedMessages = session.messages.map(
    (message: SerializedMessage) => {
      if (
        message.sender === 'ai' &&
        (message.type === 'message' || message.type === 'tool_request')
      ) {
        return {
          ...message,
          model: settingsService.getGeminiModel(message.model),
        } as AiMessage | ToolRequestMessage;
      }
      return message as Message;
    },
  );

  return {
    ...session,
    startTime: new Date(session.startTime),
    messages: deserializedMessages as [UserMessage, ...Message[]],
  };
}

export function deserializeProfile(
  profile: PersistedProfile,
  settingsService: SettingsService,
): Profile {
  return {
    ...profile,
    model: settingsService.getGeminiModel(profile.model),
  };
}
