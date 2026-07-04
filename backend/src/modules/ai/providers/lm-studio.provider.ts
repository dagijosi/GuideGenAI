import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  IAiProvider,
  AiMessage,
  AiCompletionOptions,
  AiCompletionResult,
} from '../../../common/interfaces/ai-provider.interface';
import { AiException } from '../../../common/exceptions/guidegen.exceptions';

interface LmStudioResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  model: string;
  usage?: {
    total_tokens: number;
  };
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

@Injectable()
export class LmStudioProvider implements IAiProvider {
  private readonly logger = new Logger(LmStudioProvider.name);
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('LM_STUDIO_BASE_URL', 'http://localhost:1234');
    this.defaultModel = this.configService.get<string>('LM_STUDIO_MODEL', 'qwen2.5-7b-instruct');
    // Default 3 minutes — configurable via LM_STUDIO_TIMEOUT_MS env var
    this.timeoutMs = parseInt(
      this.configService.get<string>('LM_STUDIO_TIMEOUT_MS', '180000'),
      10,
    );
  }

  async complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletionResult> {
    const model = options?.model ?? this.defaultModel;
    const temperature = options?.temperature ?? 0.3;
    const maxTokens =
      options?.maxTokens ??
      parseInt(this.configService.get<string>('LM_STUDIO_MAX_TOKENS', '2048'), 10);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        if (attempt > 1) {
          this.logger.warn(`Retrying AI request (attempt ${attempt}/${MAX_RETRIES + 1})...`);
          await this.delay(RETRY_DELAY_MS * (attempt - 1));
        }

        const response = await axios.post<LmStudioResponse>(
          `${this.baseUrl}/v1/chat/completions`,
          {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false,
          },
          { timeout: this.timeoutMs },
        );

        const content = response.data.choices[0]?.message?.content ?? '';
        return {
          content,
          model: response.data.model ?? model,
          tokensUsed: response.data.usage?.total_tokens,
        };
      } catch (error) {
        lastError = error as Error;
        const isTimeout = axios.isAxiosError(error) && error.code === 'ECONNABORTED';
        const isRetryable = isTimeout || (axios.isAxiosError(error) && (error.response?.status ?? 0) >= 500);

        if (!isRetryable || attempt > MAX_RETRIES) break;

        this.logger.warn(`AI request failed (attempt ${attempt}): ${lastError.message} — retrying`);
      }
    }

    const message = axios.isAxiosError(lastError)
      ? `LM Studio request failed: ${lastError!.message}`
      : `AI completion failed: ${lastError!.message}`;
    this.logger.error(message);
    throw new AiException(message);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/v1/models`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
