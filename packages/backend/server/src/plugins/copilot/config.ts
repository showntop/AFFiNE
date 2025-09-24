import {
  defineModuleConfig,
  StorageJSONSchema,
  StorageProviderConfig,
} from '../../base';
import { CopilotPromptScenario } from './prompt/prompts';
import {
  AnthropicOfficialConfig,
  AnthropicVertexConfig,
} from './providers/anthropic';
import type { FalConfig } from './providers/fal';
import { GeminiGenerativeConfig, GeminiVertexConfig } from './providers/gemini';
import { MorphConfig } from './providers/morph';
import { OpenAIConfig } from './providers/openai';
import { PerplexityConfig } from './providers/perplexity';
import { VertexSchema } from './providers/types';
declare global {
  interface AppConfigSchema {
    copilot: {
      enabled: boolean;
      unsplash: ConfigItem<{
        key: string;
      }>;
      exa: ConfigItem<{
        key: string;
      }>;
      storage: ConfigItem<StorageProviderConfig>;
      scenarios: ConfigItem<CopilotPromptScenario>;
      providers: {
        openai: ConfigItem<OpenAIConfig>;
        fal: ConfigItem<FalConfig>;
        gemini: ConfigItem<GeminiGenerativeConfig>;
        geminiVertex: ConfigItem<GeminiVertexConfig>;
        perplexity: ConfigItem<PerplexityConfig>;
        anthropic: ConfigItem<AnthropicOfficialConfig>;
        anthropicVertex: ConfigItem<AnthropicVertexConfig>;
        morph: ConfigItem<MorphConfig>;
      };
    };
  }
}

defineModuleConfig('copilot', {
  enabled: {
    desc: 'Whether to enable the copilot plugin. <br> Document: <a href="https://docs.affine.pro/self-host-affine/administer/ai" target="_blank">https://docs.affine.pro/self-host-affine/administer/ai</a>',
    default: false,
  },
  scenarios: {
    desc: 'Use custom models in scenarios and override default settings.',
    default: {
      override_enabled: false,
      scenarios: {
        audio_transcribing: 'gemini-2.5-flash',
        chat: 'gemini-2.5-flash',
        embedding: 'gemini-embedding-001',
        image: 'gpt-image-1',
        rerank: 'gpt-4.1',
        coding: 'claude-sonnet-4@20250514',
        complex_text_generation: 'gpt-4o-2024-08-06',
        quick_decision_making: 'gpt-5-mini',
        quick_text_generation: 'gemini-2.5-flash',
        polish_and_summarize: 'gemini-2.5-flash',
      },
    },
  },
  'providers.openai': {
    desc: 'The config for the openai provider.',
    default: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    },
    link: 'https://github.com/openai/openai-node',
  },
  'providers.fal': {
    desc: 'The config for the fal provider.',
    default: {
      apiKey: process.env.FAL_API_KEY ?? '',
    },
  },
  'providers.gemini': {
    desc: 'The config for the gemini provider.',
    default: {
      apiKey: process.env.GEMINI_API_KEY ?? '',
      baseURL:
        process.env.GEMINI_BASE_URL ??
        'https://generativelanguage.googleapis.com/v1beta',
    },
  },
  'providers.geminiVertex': {
    desc: 'The config for the gemini provider in Google Vertex AI.',
    default: {},
    schema: VertexSchema,
  },
  'providers.perplexity': {
    desc: 'The config for the perplexity provider.',
    default: {
      apiKey: process.env.PERPLEXITY_API_KEY ?? '',
    },
  },
  'providers.anthropic': {
    desc: 'The config for the anthropic provider.',
    default: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      baseURL: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1',
    },
  },
  'providers.anthropicVertex': {
    desc: 'The config for the anthropic provider in Google Vertex AI.',
    default: {},
    schema: VertexSchema,
  },
  'providers.morph': {
    desc: 'The config for the morph provider.',
    default: {},
  },
  unsplash: {
    desc: 'The config for the unsplash key.',
    default: {
      key: process.env.UNSPLASH_API_KEY ?? '',
    },
  },
  exa: {
    desc: 'The config for the exa web search key.',
    default: {
      key: process.env.EXA_API_KEY ?? '',
    },
  },
  storage: {
    desc: 'The config for the storage provider.',
    default: {
      provider: 'fs',
      bucket: 'copilot',
      config: {
        path: '~/.affine/storage',
      },
    },
    schema: StorageJSONSchema,
  },
});
