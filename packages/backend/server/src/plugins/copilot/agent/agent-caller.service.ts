import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { z } from 'zod';

import { CopilotProviderFactory } from '../providers/factory';
import { PromptService } from '../prompt/service';
import { CopilotWorkflowService } from '../workflow/service';
import { CopilotProviderType, ModelOutputType } from '../providers/types';

// Agent 类型定义
export const AgentTypeSchema = z.enum([
  'assistant',      // 通用助手
  'novel',          // 小说创作
  'image',          // 图像处理
  'code',           // 代码开发
  'document',       // 文档处理
  'workflow',       // 工作流
]);

export type AgentType = z.infer<typeof AgentTypeSchema>;

// Agent 调用结果
export interface AgentCallResult {
  success: boolean;
  content?: string;
  agentType: AgentType;
  agentName: string;
  error?: string;
  metadata?: Record<string, any>;
}

// Agent 调用参数
export interface AgentCallParams {
  agentType: AgentType;
  agentName: string;
  content: string;
  userId: string;
  workspaceId?: string;
  sessionId?: string;
  additionalParams?: Record<string, any>;
}

@Injectable()
export class AgentCallerService {
  private readonly logger = new Logger(AgentCallerService.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly workflowService: CopilotWorkflowService,
    private readonly providerFactory: CopilotProviderFactory
  ) {}

  /**
   * 调用指定的 agent
   */
  async callAgent(params: AgentCallParams): Promise<AgentCallResult> {
    const { agentType, agentName, content, userId, workspaceId, sessionId, additionalParams } = params;
    
    this.logger.log(`Calling agent: ${agentType}/${agentName} for user: ${userId}`);

    try {
      switch (agentType) {
        case 'assistant':
          return await this.callAssistantAgent(agentName, content, userId, workspaceId, sessionId, additionalParams);
        
        case 'novel':
          return await this.callNovelAgent(agentName, content, userId, workspaceId, sessionId, additionalParams);
        
        case 'image':
          return await this.callImageAgent(agentName, content, userId, workspaceId, sessionId, additionalParams);
        
        case 'code':
          return await this.callCodeAgent(agentName, content, userId, workspaceId, sessionId, additionalParams);
        
        case 'document':
          return await this.callDocumentAgent(agentName, content, userId, workspaceId, sessionId, additionalParams);
        
        case 'workflow':
          return await this.callWorkflowAgent(agentName, content, userId, workspaceId, sessionId, additionalParams);
        
        default:
          throw new Error(`Unknown agent type: ${agentType}`);
      }
    } catch (error) {
      this.logger.error(`Failed to call agent ${agentType}/${agentName}:`, error);
      return {
        success: false,
        agentType,
        agentName,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 调用通用助手 agent
   */
  private async callAssistantAgent(
    agentName: string,
    content: string,
    _userId: string,
    _workspaceId?: string,
    _sessionId?: string,
    additionalParams?: Record<string, any>
  ): Promise<AgentCallResult> {
    const promptService = this.moduleRef.get(PromptService, { strict: false });
    const prompt = await promptService.get(agentName);
    if (!prompt) {
      throw new Error(`Prompt not found: ${agentName}`);
    }

    const provider = await this.providerFactory.getProvider({
      outputType: ModelOutputType.Text,
      modelId: prompt.model,
    });

    if (!provider) {
      throw new Error(`No provider available for model: ${prompt.model}`);
    }

    const message = { role: 'user' as const, content };
    const finalMessage = [...prompt.finish({}), message];
    const config = { 
      ...prompt.config, 
      ...additionalParams,
      user: _userId,
      workspace: _workspaceId,
      session: _sessionId
    };

    const result = await provider.text(
      { modelId: prompt.model },
      finalMessage,
      config
    );

    return {
      success: true,
      content: result,
      agentType: 'assistant',
      agentName,
      metadata: { model: prompt.model },
    };
  }

  /**
   * 调用小说创作 agent
   */
  private async callNovelAgent(
    agentName: string,
    content: string,
    userId: string,
    workspaceId?: string,
    sessionId?: string,
    additionalParams?: Record<string, any>
  ): Promise<AgentCallResult> {
    // 检查是否是 workflow
    if (agentName.startsWith('workflow:novel')) {
      return await this.callWorkflowAgent(agentName, content, userId, workspaceId, sessionId, additionalParams);
    }

    // 调用小说相关的 prompt
    return await this.callAssistantAgent(agentName, content, userId, workspaceId, sessionId, additionalParams);
  }

  /**
   * 调用图像处理 agent
   */
  private async callImageAgent(
    agentName: string,
    content: string,
    userId: string,
    workspaceId?: string,
    sessionId?: string,
    additionalParams?: Record<string, any>
  ): Promise<AgentCallResult> {
    return await this.callAssistantAgent(agentName, content, userId, workspaceId, sessionId, additionalParams);
  }

  /**
   * 调用代码开发 agent
   */
  private async callCodeAgent(
    agentName: string,
    content: string,
    userId: string,
    workspaceId?: string,
    sessionId?: string,
    additionalParams?: Record<string, any>
  ): Promise<AgentCallResult> {
    return await this.callAssistantAgent(agentName, content, userId, workspaceId, sessionId, additionalParams);
  }

  /**
   * 调用文档处理 agent
   */
  private async callDocumentAgent(
    agentName: string,
    content: string,
    userId: string,
    workspaceId?: string,
    sessionId?: string,
    additionalParams?: Record<string, any>
  ): Promise<AgentCallResult> {
    return await this.callAssistantAgent(agentName, content, userId, workspaceId, sessionId, additionalParams);
  }

  /**
   * 调用工作流 agent
   */
  private async callWorkflowAgent(
    agentName: string,
    content: string,
    userId: string,
    workspaceId?: string,
    sessionId?: string,
    additionalParams?: Record<string, any>
  ): Promise<AgentCallResult> {
    // 提取 workflow 名称
    const workflowName = agentName.replace('workflow:', '');
    
    // 准备参数
    const params = {
      content,
      ...additionalParams,
    };

    // 运行 workflow
    const results: string[] = [];
    for await (const result of this.workflowService.runGraph(params, workflowName, {
      user: userId,
      workspace: workspaceId,
      session: sessionId,
      ...additionalParams,
    })) {
      if (result.status === 'EmitContent' && 'content' in result) {
        results.push(result.content);
      }
    }

    return {
      success: true,
      content: results.join('\n'),
      agentType: 'workflow',
      agentName,
      metadata: { workflowName },
    };
  }

  /**
   * 获取可用的 agent 列表
   */
  async getAvailableAgents(): Promise<Record<AgentType, string[]>> {
    const agents: Record<AgentType, string[]> = {
      assistant: [],
      novel: [],
      image: [],
      code: [],
      document: [],
      workflow: [],
    };

    try {
      // 获取所有 prompts
      const promptService = this.moduleRef.get(PromptService, { strict: false });
      const allPrompts = await promptService.list();
      
      for (const prompt of allPrompts) {
        const name = prompt.name;
        
        // 分类 prompts
        if (name.includes('Novel') || name.includes('novel')) {
          agents.novel.push(name);
        } else if (name.includes('image') || name.includes('Image')) {
          agents.image.push(name);
        } else if (name.includes('Code') || name.includes('code') || name.includes('Artifact')) {
          agents.code.push(name);
        } else if (name.includes('workflow:')) {
          agents.workflow.push(name);
        } else if (name.includes('Improve') || name.includes('writing') || name.includes('document')) {
          agents.document.push(name);
        } else {
          agents.assistant.push(name);
        }
      }
    } catch (error) {
      this.logger.error('Failed to get available agents:', error);
    }

    return agents;
  }
}
