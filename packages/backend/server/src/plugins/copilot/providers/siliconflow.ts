import {
  createOpenAI,
  type OpenAIProvider as VercelOpenAIProvider,
} from '@ai-sdk/openai';
import { AISDKError, generateText, stepCountIs, streamText } from 'ai';

import {
  CopilotProviderSideError,
  metrics,
  UserFriendlyError,
} from '../../../base';
import { CopilotProvider } from './provider';
import {
  CopilotChatOptions,
  CopilotProviderType,
  ModelConditions,
  ModelInputType,
  ModelOutputType,
  PromptMessage,
  StreamObject,
} from './types';
import { chatToGPTMessage, StreamObjectParser } from './utils';

export type SiliconFlowConfig = {
  apiKey: string;
  baseURL?: string;
};

export class SiliconFlowProvider extends CopilotProvider<SiliconFlowConfig> {
  readonly type = CopilotProviderType.SiliconFlow;

  readonly models = [
    {
      name: 'Qwen2.5-7B-Instruct',
      id: 'Qwen/Qwen2.5-7B-Instruct',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text],
          defaultForOutputType: true,
        },
      ],
    },
    {
      name: 'Qwen2.5-14B-Instruct',
      id: 'Qwen/Qwen2.5-14B-Instruct',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text],
        },
      ],
    },
    {
      name: 'Qwen2.5-32B-Instruct',
      id: 'Qwen/Qwen2.5-32B-Instruct',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text],
        },
      ],
    },
    {
      name: 'Qwen2.5-72B-Instruct',
      id: 'Qwen/Qwen2.5-72B-Instruct',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Qwen2.5-110B-Instruct',
      id: 'Qwen/Qwen2.5-110B-Instruct',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'DeepSeek-V3.1',
      id: 'deepseek-ai/DeepSeek-V3.1',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'DeepSeek-Coder-V2-Instruct',
      id: 'deepseek-ai/DeepSeek-Coder-V2-Instruct',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text],
        },
      ],
    },
    {
      name: 'Yi-34B-200K',
      id: '01-ai/Yi-34B-200K',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text],
        },
      ],
    },
    {
      name: 'ChatGLM3-6B',
      id: 'THUDM/ChatGLM3-6B',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text],
        },
      ],
    },
    {
      name: 'Baichuan2-13B-Chat',
      id: 'baichuan-inc/Baichuan2-13B-Chat',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text],
        },
      ],
    },
    {
      name: 'GLM-4-9B-0414',
      id: 'THUDM/GLM-4-9B-0414',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
  ];

  #instance!: VercelOpenAIProvider;

  override configured(): boolean {
    return !!this.config.apiKey;
  }

  protected override setup() {
    super.setup();
    if (this.configured()) {
      this.#instance = createOpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL || 'https://api.siliconflow.cn/v1',
      });
    }
  }

  private handleError(e: any) {
    if (e instanceof UserFriendlyError) {
      return e;
    } else if (e instanceof AISDKError) {
      this.logger.error('Throw error from ai sdk:', e);
      return new CopilotProviderSideError({
        provider: this.type,
        kind: e.name || 'unknown',
        message: e.message,
      });
    } else {
      return new CopilotProviderSideError({
        provider: this.type,
        kind: 'unexpected_response',
        message: e?.message || 'Unexpected SiliconFlow response',
      });
    }
  }

  async text(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): Promise<string> {
    const fullCond = {
      ...cond,
      outputType: ModelOutputType.Text,
    };
    await this.checkParams({ messages, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai.counter('chat_text_calls').add(1, { model: model.id });

      const [system, msgs] = await chatToGPTMessage(messages);
      this.logger.log('=== 发送给模型的消息 ===');
      this.logger.log(`模型: ${model.id}`);
      this.logger.log(`系统提示: ${system}`);
      this.logger.log('消息列表:');
      msgs.forEach((msg, index) => {
        this.logger.log(`消息 ${index + 1} (${msg.role}):`);
        this.logger.log(msg.content);
      });
      const result = await generateText({
        model: this.#instance.chat(model.id),
        system,
        messages: msgs,
        temperature: options.temperature ?? 0,
        maxOutputTokens: options.maxTokens ?? 4096,
        topP: options.topP ?? 1,
        frequencyPenalty: options.frequencyPenalty ?? 0,
        presencePenalty: options.presencePenalty ?? 0,
        tools: await this.getTools(options, model.id),
      });
      this.logger.log('=== 模型回复 ===');
      this.logger.log("result content:", result.content);
      this.logger.log("result text:", result.text);
      this.logger.log("result response:", result.response);
      this.logger.log("result:", result);

      metrics.ai.counter('chat_text_tokens').add(1, { model: model.id });
      return result.text;
    } catch (e) {
      metrics.ai.counter('chat_text_errors').add(1, { model: model.id });
      throw this.handleError(e);
    }
  }

  async *streamText(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): AsyncIterable<string> {
    const fullCond = {
      ...cond,
      outputType: ModelOutputType.Text,
    };
    await this.checkParams({ messages, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai.counter('chat_text_stream_calls').add(1, { model: model.id });

      const [system, msgs] = await chatToGPTMessage(messages);

      const result = streamText({
        model: this.#instance.chat(model.id),
        system,
        messages: msgs,
        temperature: options.temperature ?? 0,
        maxOutputTokens: options.maxTokens ?? 4096,
        topP: options.topP ?? 1,
        frequencyPenalty: options.frequencyPenalty ?? 0,
        presencePenalty: options.presencePenalty ?? 0,
        tools: await this.getTools(options, model.id),
        providerOptions: {
          openai: {
            // 强制使用 chat/completions 端点而不是 responses 端点
            endpoint: '/chat/completions',
          },
        },
      });

      for await (const chunk of result.textStream) {
        yield chunk;
      }

      metrics.ai.counter('chat_text_stream_tokens').add(1, { model: model.id });
    } catch (e) {
      metrics.ai.counter('chat_text_stream_errors').add(1, { model: model.id });
      throw this.handleError(e);
    }
  }

  override async *streamObject(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): AsyncIterable<StreamObject> {
    const fullCond = { ...cond, outputType: ModelOutputType.Object };
    await this.checkParams({ cond: fullCond, messages, options });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai
        .counter('chat_object_stream_calls')
        .add(1, { model: model.id });
      const fullStream = await this.getFullStream(model, messages, options);
      const parser = new StreamObjectParser();
      for await (const chunk of fullStream) {
        const result = parser.parse(chunk);
        if (result) {
          yield result;
        }
        if (options.signal?.aborted) {
          await fullStream.cancel();
          break;
        }
      }
    } catch (e: any) {
      metrics.ai
        .counter('chat_object_stream_errors')
        .add(1, { model: model.id });
      throw this.handleError(e);
    }
  }

  private async getFullStream(
    model: any,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ) {
    const [system, msgs] = await chatToGPTMessage(messages);
    const { fullStream } = streamText({
      model: this.#instance.chat(model.id),
      system,
      messages: msgs,
      frequencyPenalty: options.frequencyPenalty ?? 0,
      presencePenalty: options.presencePenalty ?? 0,
      temperature: options.temperature ?? 0,
      maxOutputTokens: options.maxTokens ?? 4096,
      topP: options.topP ?? 1,
      tools: await this.getTools(options, model.id),
      stopWhen: stepCountIs(this.MAX_STEPS),
      abortSignal: options.signal,
      providerOptions: {
        openai: {
          // 强制使用 chat/completions 端点而不是 responses 端点
          endpoint: '/chat/completions',
        },
      },
    });
    return fullStream;
  }

  override async refreshOnlineModels() {
    if (!this.configured()) return;

    try {
      // 硅基流动的模型列表可以通过 API 获取
      // 这里先使用静态列表，后续可以根据需要添加动态获取功能
      this.onlineModelList = this.models.map(m => m.id);
      this.logger.log(
        `SiliconFlow online models refreshed: ${this.onlineModelList.length} models`
      );
    } catch (e) {
      this.logger.error('Failed to refresh SiliconFlow online models', e);
    }
  }
}
