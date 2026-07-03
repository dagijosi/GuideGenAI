export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiCompletionResult {
  content: string;
  model: string;
  tokensUsed?: number;
}

export interface IAiProvider {
  complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletionResult>;
  isAvailable(): Promise<boolean>;
}
