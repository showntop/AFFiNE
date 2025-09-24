import {
  createOpenAICompatible,
  type OpenAICompatibleProvider as VercelOpenAICompatibleProvider,
} from '@ai-sdk/openai-compatible';
import {
  AISDKError,
  embedMany,
  generateObject,
  generateText,
  stepCountIs,
  streamText,
  Tool,
} from 'ai';
import { z } from 'zod';

import {
  CopilotPromptInvalid,
  CopilotProviderNotSupported,
  CopilotProviderSideError,
  metrics,
  UserFriendlyError,
} from '../../../base';
import { CopilotProvider } from './provider';
import type {
  CopilotChatOptions,
  CopilotChatTools,
  CopilotEmbeddingOptions,
  CopilotImageOptions,
  CopilotProviderModel,
  CopilotStructuredOptions,
  ModelConditions,
  PromptMessage,
  StreamObject,
} from './types';
import { CopilotProviderType, ModelInputType, ModelOutputType } from './types';
import {
  chatToGPTMessage,
  CitationParser,
  StreamObjectParser,
  TextStreamParser,
} from './utils';

export const DEFAULT_DIMENSIONS = 256;

export type OpenAICompatibleConfig = {
  apiKey: string;
  baseURL: string;
  providerName?: string;
  oldApiStyle?: boolean;
};

const ModelListSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
});

const ImageResponseSchema = z.union([
  z.object({
    data: z.array(z.object({ b64_json: z.string() })),
  }),
  z.object({
    error: z.object({
      message: z.string(),
      type: z.string().nullish(),
      param: z.any().nullish(),
      code: z.union([z.string(), z.number()]).nullish(),
    }),
  }),
]);

const LogProbsSchema = z.array(
  z.object({
    token: z.string(),
    logprob: z.number(),
    top_logprobs: z.array(
      z.object({
        token: z.string(),
        logprob: z.number(),
      })
    ),
  })
);

export class OpenAICompatibleProvider extends CopilotProvider<OpenAICompatibleConfig> {
  readonly type = CopilotProviderType.OpenAICompatible;

  readonly models = [
    {
      name: 'Gemini 2.5 Pro',
      id: 'gemini-2.5-pro',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object, ModelOutputType.Structured],
        },
      ],
    },
    {
      name: 'Gemini 2.5 Flash',
      id: 'gemini-2.5-flash',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object, ModelOutputType.Structured],
        },
      ],
    },
    // DeepSeek 模型
    {
      name: 'DeepSeek-V3.1',
      id: 'deepseek-chat',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
          defaultForOutputType: true,
        },
      ],
    },
    {
      name: 'DeepSeek-Coder-V2',
      id: 'deepseek-coder',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'DeepSeek-V2.5',
      id: 'deepseek-v2.5',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    // GLM 模型
    {
      name: 'GLM-4-9B',
      id: 'glm-4-9b',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'GLM-4-FLASH',
      id: 'glm-4-flash',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'GLM-4V-9B',
      id: 'glm-4v-9b',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    // Kimi 模型
    {
      name: 'Kimi-K2',
      id: 'kimi-k2',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Kimi-K2.5',
      id: 'kimi-k2.5',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    // Qwen 模型
    {
      name: 'Qwen2.5-7B-Instruct',
      id: 'qwen2.5-7b-instruct',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Qwen2.5-14B-Instruct',
      id: 'qwen2.5-14b-instruct',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Qwen2.5-32B-Instruct',
      id: 'qwen2.5-32b-instruct',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Qwen2.5-72B-Instruct',
      id: 'qwen2.5-72b-instruct',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Qwen2.5-110B-Instruct',
      id: 'qwen2.5-110b-instruct',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    // Yi 模型
    {
      name: 'Yi-34B-200K',
      id: 'yi-34b-200k',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Yi-1.5-9B-Chat',
      id: 'yi-1.5-9b-chat',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    // Baichuan 模型
    {
      name: 'Baichuan2-13B-Chat',
      id: 'baichuan2-13b-chat',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Baichuan2-7B-Chat',
      id: 'baichuan2-7b-chat',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    // ChatGLM 模型
    {
      name: 'ChatGLM3-6B',
      id: 'chatglm3-6b',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'ChatGLM4-9B',
      id: 'chatglm4-9b',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    // Embedding 模型
    {
      id: 'text-embedding-3-large',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Embedding],
          defaultForOutputType: true,
        },
      ],
    },
    {
      id: 'text-embedding-3-small',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Embedding],
        },
      ],
    },
    {
      id: 'text-embedding-ada-002',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Embedding],
        },
      ],
    },
    // 图像生成模型
    {
      id: 'dall-e-3',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Image],
        },
      ],
    },
    {
      id: 'dall-e-2',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Image],
        },
      ],
    },
  ];

  #instance!: VercelOpenAICompatibleProvider;

  override configured(): boolean {
    return !!(this.config.apiKey && this.config.baseURL);
  }

  protected override setup() {
    super.setup();
    if (this.configured()) {
      this.#instance = createOpenAICompatible({
        name: this.config.providerName || 'openai-compatible',
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        // 添加请求拦截器来记录和清理请求体
        fetch: async (url, options) => {
          if (options?.body) {
            try {
              let body = options.body;
              let bodyString = '';
              
              // 如果是字符串，解析为对象
              if (typeof body === 'string') {
                bodyString = body;
                body = JSON.parse(body);
              } else {
                bodyString = JSON.stringify(body);
              }
              
              // 清理请求体中的 $schema 字段
              const cleanedBody = this.removeSchemaFields(body);
              const cleanedBodyString = JSON.stringify(cleanedBody);
              
              // 记录清理前后的请求体
              this.logger.log('Original Request Body:', bodyString);
              this.logger.log('Cleaned Request Body:', cleanedBodyString);
              
              // 使用清理后的请求体
              options.body = cleanedBodyString;
            } catch (e) {
              this.logger.debug('Failed to parse/clean request body:', e);
            }
          }
          return fetch(url, options);
        },
      });
    }
  }

  private handleError(
    e: any,
    model: string,
    options: CopilotImageOptions = {}
  ) {
    if (e instanceof UserFriendlyError) {
      return e;
    } else if (e instanceof AISDKError) {
      if (e.message.includes('safety') || e.message.includes('risk')) {
        metrics.ai
          .counter('chat_text_risk_errors')
          .add(1, { model, user: options.user || undefined });
      }

      return new CopilotProviderSideError({
        provider: this.type,
        kind: e.name || 'unknown',
        message: e.message,
      });
    } else {
      return new CopilotProviderSideError({
        provider: this.type,
        kind: 'unexpected_response',
        message: e?.message || 'Unexpected OpenAI compatible response',
      });
    }
  }

  override async refreshOnlineModels() {
    try {
      if (this.config.apiKey && this.config.baseURL && !this.onlineModelList.length) {
        const { data } = await fetch(`${this.config.baseURL}/models`, {
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

  override getProviderSpecificTools(
    toolName: CopilotChatTools,
    _model: string
  ): [string, Tool?] | undefined {
    if (toolName === 'webSearch') {
      // 大多数兼容模型不支持 web search，但可以返回 doc_edit 工具
      return ['doc_edit', undefined];
    } else if (toolName === 'docEdit') {
      return ['doc_edit', undefined];
    }
    return;
  }


  // 递归移除对象中的 $schema 和其他不兼容字段
  private removeSchemaFields(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeSchemaFields(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // 移除 $schema 和 additionalProperties 字段，因为 OpenAI 兼容 API 不支持
        if (key === '$schema' || key === 'additionalProperties') {
          continue;
        }
        cleaned[key] = this.removeSchemaFields(value);
      }
      return cleaned;
    }
    
    return obj;
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
      const tools = await this.getTools(options, model.id);
      
      // 打印工具信息用于调试
      this.logger.log('Tools for OpenAI Compatible API (text):', JSON.stringify(tools, null, 2));

      const { text } = await generateText({
        model: this.#instance(model.id),
        system,
        messages: msgs,
        temperature: options.temperature ?? 0,
        maxOutputTokens: options.maxTokens ?? 4096,
        topP: options.topP ?? 1,
        frequencyPenalty: options.frequencyPenalty ?? 0,
        presencePenalty: options.presencePenalty ?? 0,
        tools,
        stopWhen: stepCountIs(this.MAX_STEPS),
        abortSignal: options.signal,
      });

      return text.trim();
    } catch (e: any) {
      metrics.ai.counter('chat_text_errors').add(1, { model: model.id });
      throw this.handleError(e, model.id, options);
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
      const fullStream = await this.getFullStream(model, messages, options);
      const citationParser = new CitationParser();
      const textParser = new TextStreamParser();
      for await (const chunk of fullStream) {
        switch (chunk.type) {
          case 'text-delta': {
            let result = textParser.parse(chunk);
            result = citationParser.parse(result);
            yield result;
            break;
          }
          case 'finish': {
            const footnotes = textParser.end();
            const result =
              citationParser.end() + (footnotes.length ? '\n' + footnotes : '');
            yield result;
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
      throw this.handleError(e, model.id, options);
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
      throw this.handleError(e, model.id, options);
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

      const { object } = await generateObject({
        model: this.#instance(model.id),
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
      throw this.handleError(e, model.id, options);
    }
  }

  override async rerank(
    cond: ModelConditions,
    chunkMessages: PromptMessage[][],
    options: CopilotChatOptions = {}
  ): Promise<number[]> {
    const fullCond = { ...cond, outputType: ModelOutputType.Text };
    await this.checkParams({ messages: [], cond: fullCond, options });
    const model = this.selectModel(fullCond);

    const scores = await Promise.all(
      chunkMessages.map(async messages => {
        const [system, msgs] = await chatToGPTMessage(messages);

        const result = await generateText({
          model: this.#instance(model.id),
          system,
          messages: msgs,
          temperature: 0,
          maxOutputTokens: 16,
          providerOptions: {
            openai: {
              logprobs: 16,
            },
          },
          abortSignal: options.signal,
        });

        const topMap: Record<string, number> = LogProbsSchema.parse(
          result.providerMetadata?.openai?.logprobs
        )[0].top_logprobs.reduce<Record<string, number>>(
          (acc, { token, logprob }) => ({ ...acc, [token]: logprob }),
          {}
        );

        const findLogProb = (token: string): number => {
          return [...'_:. "-\t,(=_"'.split('').map(c => c + token), token]
            .flatMap(v => [v, v.toLowerCase(), v.toUpperCase()])
            .reduce<number>(
              (best, key) =>
                (topMap[key] ?? Number.NEGATIVE_INFINITY) > best
                  ? topMap[key]
                  : best,
              Number.NEGATIVE_INFINITY
            );
        };

        const logYes = findLogProb('Yes');
        const logNo = findLogProb('No');

        const pYes = Math.exp(logYes);
        const pNo = Math.exp(logNo);
        const prob = pYes + pNo === 0 ? 0 : pYes / (pYes + pNo);

        return prob;
      })
    );

    return scores;
  }

  private async getFullStream(
    model: CopilotProviderModel,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ) {
    const [system, msgs] = await chatToGPTMessage(messages);
    const tools = await this.getTools(options, model.id);
    
    // 打印工具信息用于调试
    this.logger.log('Tools for OpenAI Compatible API:', JSON.stringify(tools, null, 2));
    
    const { fullStream } = streamText({
      model: this.#instance(model.id),
      system,
      messages: msgs,
      frequencyPenalty: options.frequencyPenalty ?? 0,
      presencePenalty: options.presencePenalty ?? 0,
      temperature: options.temperature ?? 0,
      maxOutputTokens: options.maxTokens ?? 4096,
      topP: options.topP ?? 1,
      tools,
      stopWhen: stepCountIs(this.MAX_STEPS),
      abortSignal: options.signal,
    });
    return fullStream;
  }

  // ====== text to image ======
  private async *generateImageWithAttachments(
    model: string,
    prompt: string,
    attachments: NonNullable<PromptMessage['attachments']>
  ): AsyncGenerator<string> {
    const form = new FormData();
    form.set('model', model);
    form.set('prompt', prompt);
    form.set('output_format', 'webp');

    for (const [idx, entry] of attachments.entries()) {
      const url = typeof entry === 'string' ? entry : entry.attachment;
      const resp = await fetch(url);
      if (resp.ok) {
        const type = resp.headers.get('content-type');
        if (type && type.startsWith('image/')) {
          const buffer = new Uint8Array(await resp.arrayBuffer());
          const file = new File([buffer], `${idx}.png`, { type });
          form.append('image[]', file);
        }
      }
    }

    if (!form.getAll('image[]').length) {
      throw new CopilotPromptInvalid(
        'No valid image attachments found. Please attach images.'
      );
    }

    const url = `${this.config.baseURL}/images/edits`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      throw new Error(`OpenAI Compatible API error ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const imageResponse = ImageResponseSchema.safeParse(json);
    if (imageResponse.success) {
      const data = imageResponse.data;
      if ('error' in data) {
        throw new Error(data.error.message);
      } else {
        for (const image of data.data) {
          yield `data:image/webp;base64,${image.b64_json}`;
        }
      }
    } else {
      throw new Error(imageResponse.error.message);
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

    metrics.ai
      .counter('generate_images_stream_calls')
      .add(1, { model: model.id });

    const { content: prompt, attachments } = [...messages].pop() || {};
    if (!prompt) throw new CopilotPromptInvalid('Prompt is required');

    try {
      if (attachments && attachments.length > 0) {
        yield* this.generateImageWithAttachments(model.id, prompt, attachments);
      } else {
        // 对于兼容的 API，可能需要使用不同的图像生成端点
        throw new CopilotProviderNotSupported({
          provider: this.type,
          kind: 'image',
        });
      }
      return;
    } catch (e: any) {
      metrics.ai.counter('generate_images_errors').add(1, { model: model.id });
      throw this.handleError(e, model.id, options);
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

    try {
      metrics.ai
        .counter('generate_embedding_calls')
        .add(1, { model: model.id });

      const { embeddings } = await embedMany({
        model: this.#instance(model.id),
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
      throw this.handleError(e, model.id, options);
    }
  }
}
