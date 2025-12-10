import {
  createOpenAICompatible,
  OpenAICompatibleProvider as VercelOpenAICompatibleProvider,
} from '@ai-sdk/openai-compatible';
import {
  AISDKError,
  embedMany,
  experimental_generateImage as generateImage,
  generateObject,
  generateText,
  stepCountIs,
  streamText,
} from 'ai';
import { z } from 'zod';

import {
  CopilotPromptInvalid,
  CopilotProviderNotSupported,
  CopilotProviderSideError,
  metrics,
  UserFriendlyError,
} from '../../../base';
import type { OpenAIConfig } from './openai';
import { CopilotProvider } from './provider';
import type {
  CopilotChatOptions,
  CopilotEmbeddingOptions,
  CopilotImageOptions,
  CopilotProviderModel,
  CopilotStructuredOptions,
  ModelConditions,
  ModelInputType,
  ModelOutputType,
  PromptMessage,
  StreamObject,
} from './types';
import { CopilotProviderType } from './types';
import {
  chatToGPTMessage,
  StreamObjectParser,
  TextStreamParser,
} from './utils';

export type GenericOpenAIConfig = OpenAIConfig & {
  /**
   * 手动声明模型与能力的映射，便于在未能自动探测模型列表时进行匹配。
   */
  models?: CopilotProviderModel[];
};

const DEFAULT_DIMENSIONS = 256;

const ModelListSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
});

export class GenericOpenAIProvider extends CopilotProvider<GenericOpenAIConfig> {
  readonly type = CopilotProviderType.GenericOpenAI;

  protected override readonly _models = [];

  override get models() {
    return this.config.models?.length ? this.config.models : [];
  }

  #instance!: VercelOpenAICompatibleProvider;

  override configured(): boolean {
    return !!this.config.apiKey && !!this.config.baseURL;
  }

  protected override setup() {
    super.setup();
    if (!this.configured()) {
      return;
    }

    this.#instance = createOpenAICompatible({
      name: this.type,
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL || '',
    });
  }

  override async refreshOnlineModels() {
    try {
      const baseUrl = this.config.baseURL;
      if (this.config.apiKey && baseUrl && !this.onlineModelList.length) {
        const { data } = await fetch(`${baseUrl}/models`, {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        })
          .then(r => r.json())
          .then(r => ModelListSchema.parse(r));
        this.onlineModelList = data.map(model => model.id);
      }
    } catch (e) {
      this.logger.error('Failed to fetch available models', e);
    }
  }

  private handleError(e: any, model: string) {
    if (e instanceof UserFriendlyError) {
      return e;
    } else if (e instanceof AISDKError) {
      return new CopilotProviderSideError({
        provider: this.type,
        kind: e.name || 'unknown',
        message: e.message,
      });
    } else {
      return new CopilotProviderSideError({
        provider: this.type,
        kind: 'unexpected_response',
        message: e?.message || `Unexpected ${this.type} response`,
      });
    }
  }

  async text(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): Promise<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Text };
    await this.checkParams({ messages, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai.counter('chat_text_calls').add(1, { model: model.id });

      const [system, msgs] = await chatToGPTMessage(messages);
      const modelInstance = this.#instance(model.id);

      const { text } = await generateText({
        model: modelInstance,
        system,
        messages: msgs,
        temperature: options.temperature ?? 0,
        maxOutputTokens: options.maxTokens ?? 4096,
        providerOptions: {
          openai: this.getOpenAIOptions(options),
        },
        tools: await this.getTools(options, model.id),
        stopWhen: stepCountIs(this.MAX_STEPS),
        abortSignal: options.signal,
      });

      return text.trim();
    } catch (e: any) {
      metrics.ai.counter('chat_text_errors').add(1, { model: model.id });
      throw this.handleError(e, model.id);
    }
  }

  async *streamText(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): AsyncIterable<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Text };
    await this.checkParams({ messages, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai.counter('chat_text_stream_calls').add(1, { model: model.id });
      const fullStream = await this.getFullStream(model.id, messages, options);
      const textParser = new TextStreamParser();

      for await (const chunk of fullStream) {
        switch (chunk.type) {
          case 'text-delta': {
            yield textParser.parse(chunk);
            break;
          }
          case 'finish': {
            yield textParser.end();
            break;
          }
          default: {
            yield textParser.parse(chunk);
            break;
          }
        }

        if (options.signal?.aborted) {
          await fullStream.cancel();
          break;
        }
      }
    } catch (e: any) {
      metrics.ai.counter('chat_text_stream_errors').add(1, { model: model.id });
      throw this.handleError(e, model.id);
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
      const fullStream = await this.getFullStream(model.id, messages, options);
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
      throw this.handleError(e, model.id);
    }
  }

  override async structure(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotStructuredOptions = {}
  ): Promise<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Structured };
    await this.checkParams({ messages, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai.counter('chat_text_calls').add(1, { model: model.id });

      const [system, msgs, schema] = await chatToGPTMessage(messages);
      if (!schema) {
        throw new CopilotPromptInvalid('Schema is required');
      }

      const modelInstance = this.#instance(model.id);

      const { object } = await generateObject({
        model: modelInstance,
        system,
        messages: msgs,
        temperature: options.temperature ?? 0,
        maxOutputTokens: options.maxTokens ?? 4096,
        maxRetries: options.maxRetries ?? 3,
        schema,
        providerOptions: {
          openai: options.user ? { user: options.user } : {},
        },
        abortSignal: options.signal,
      });

      return JSON.stringify(object);
    } catch (e: any) {
      metrics.ai.counter('chat_text_errors').add(1, { model: model.id });
      throw this.handleError(e, model.id);
    }
  }

  override async *streamImages(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotImageOptions = {}
  ) {
    const fullCond = { ...cond, outputType: ModelOutputType.Image };
    await this.checkParams({ messages, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    if (!('image' in this.#instance)) {
      throw new CopilotProviderNotSupported({
        provider: this.type,
        kind: 'image',
      });
    }

    metrics.ai
      .counter('generate_images_stream_calls')
      .add(1, { model: model.id });

    const { content: prompt } = [...messages].pop() || {};
    if (!prompt) throw new CopilotPromptInvalid('Prompt is required');

    try {
      const modelInstance = this.#instance.image(model.id);
      const result = await generateImage({
        model: modelInstance,
        prompt,
        providerOptions: {
          openai: options.quality ? { quality: options.quality } : {},
        },
      });

      const imageUrls = result.images.map(
        image => `data:image/png;base64,${image.base64}`
      );

      for (const imageUrl of imageUrls) {
        yield imageUrl;
        if (options.signal?.aborted) {
          break;
        }
      }
      return;
    } catch (e: any) {
      metrics.ai.counter('generate_images_errors').add(1, { model: model.id });
      throw this.handleError(e, model.id);
    }
  }

  override async embedding(
    cond: ModelConditions,
    messages: string | string[],
    options: CopilotEmbeddingOptions = { dimensions: DEFAULT_DIMENSIONS }
  ): Promise<number[][]> {
    messages = Array.isArray(messages) ? messages : [messages];
    const fullCond = { ...cond, outputType: ModelOutputType.Embedding };
    await this.checkParams({ embeddings: messages, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    if (!('embedding' in this.#instance)) {
      throw new CopilotProviderNotSupported({
        provider: this.type,
        kind: 'embedding',
      });
    }

    try {
      metrics.ai
        .counter('generate_embedding_calls')
        .add(1, { model: model.id });

      const modelInstance = this.#instance.embedding(model.id);

      const { embeddings } = await embedMany({
        model: modelInstance,
        values: messages,
        providerOptions: {
          openai: {
            dimensions: options.dimensions || DEFAULT_DIMENSIONS,
          },
        },
      });

      return embeddings.filter(v => v && Array.isArray(v));
    } catch (e: any) {
      metrics.ai
        .counter('generate_embedding_errors')
        .add(1, { model: model.id });
      throw this.handleError(e, model.id);
    }
  }

  private async getFullStream(
    modelId: string,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ) {
    const [system, msgs] = await chatToGPTMessage(messages);
    const modelInstance = this.#instance(modelId);
    const { fullStream } = streamText({
      model: modelInstance,
      system,
      messages: msgs,
      frequencyPenalty: options.frequencyPenalty ?? 0,
      presencePenalty: options.presencePenalty ?? 0,
      temperature: options.temperature ?? 0,
      maxOutputTokens: options.maxTokens ?? 4096,
      providerOptions: {
        openai: this.getOpenAIOptions(options),
      },
      tools: await this.getTools(options, modelId),
      stopWhen: stepCountIs(this.MAX_STEPS),
      abortSignal: options.signal,
    });
    return fullStream;
  }

  private getOpenAIOptions(options: CopilotChatOptions) {
    const result: Record<string, string> = {};
    if (options?.user) {
      result.user = options.user;
    }
    return result;
  }
}
