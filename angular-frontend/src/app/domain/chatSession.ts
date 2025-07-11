import { z } from 'zod';
import { Message, UserMessage } from './messages';
import { MessageSchema } from './messages';

const ChatSessionSchema = z.object({
  id: z.string(),
  startTime: z.preprocess((arg) => new Date(arg as string), z.date()),
  messages: z
    .array(MessageSchema)
    .transform((messages) => messages as [UserMessage, ...Message[]]),
});

export type ChatSession = z.infer<typeof ChatSessionSchema>;

export function deserializeChatSessions(sessionsJson: string): ChatSession[] {
  const parsedSessions: unknown[] = JSON.parse(sessionsJson);
  const validSessions: ChatSession[] = [];

  parsedSessions.forEach((s) => {
    const result = ChatSessionSchema.safeParse(s);
    if (result.success) {
      validSessions.push(result.data);
    } else {
      console.error(
        'Error parsing chat session from localStorage:',
        result.error,
      );
    }
  });
  return validSessions;
}

export function serializeChatSessions(sessions: ChatSession[]): string {
  const serializableSessions = sessions.map((session) => {
    const serializableMessages = session.messages.map((message) => {
      if (
        (message.sender === 'ai' && message.type === 'message') ||
        message.type === 'tool_request'
      ) {
        return {
          ...message,
          model: message.model.name, // Serialize model object to its name
        };
      }
      return message;
    });
    return { ...session, messages: serializableMessages };
  });
  return JSON.stringify(serializableSessions);
}
