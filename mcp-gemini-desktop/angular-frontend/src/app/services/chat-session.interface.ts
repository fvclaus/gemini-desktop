import { Message, UserMessage } from './chat.service';

export interface ChatSession {
  id: string;
  startTime: Date;
  messages: [UserMessage, ...Message[]];
}
