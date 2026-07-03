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

@Injectable()
export class LmStudioProvider implements IAiProvider {
  private readonly logger = new Logger(LmStudioProvider.name);
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('LM_STUDIO_BASE_URL', 'http://localhost:1234');
    this.defaultModel = this.configService.get<string>(
      'LM_STUDIO_MODEL',
      'qwen2.5-7b-instruct',
    );
  }

  async complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletionResult> {
    const model = options?.model ?? this.defaultModel;
    const temperature = options?.temperature ?? 0.3;
    const maxTokens =
      options?.maxTokens ??
      parseInt(this.configService.get<string>('LM_STUDIO_MAX_TOKENS', '4096'), 10);

    try {
      const response = await axios.post<LmStudioResponse>(
        `${this.baseUrl}/v1/chat/completions`,
        {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        },
        { timeout: 120000 },
      );

      const content = response.data.choices[0]?.message?.content ?? '';
      return {
        content,
        model: response.data.model ?? model,
        tokensUsed: response.data.usage?.total_tokens,
      };
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? `LM Studio request failed: ${error.message}`
        : `AI completion failed: ${(error as Error).message}`;
      this.logger.error(message);
      throw new AiException(message);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/v1/models`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}
