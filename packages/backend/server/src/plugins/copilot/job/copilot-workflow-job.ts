import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { JobQueue, OnJob } from '../../../base';
import { Models } from '../../../models';
import { CopilotWorkflowService } from '../workflow/service';

declare global {
  interface Jobs {
    'copilot.workflow.execute': {
      userId: string;
      workspaceId: string;
      workflowName: string;
      content: string;
      sessionId?: string;
      additionalParams?: Record<string, any>;
    };
  }
}

@Injectable()
export class CopilotWorkflowJob {
  private readonly logger = new Logger(CopilotWorkflowJob.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly models: Models,
    private readonly jobQueue: JobQueue
  ) {
    this.logger.debug('CopilotWorkflowJob initialized');
    // models 和 jobQueue 可能在未来的功能中使用
  }

  @OnJob('copilot.workflow.execute')
  async executeWorkflow(job: Jobs['copilot.workflow.execute']) {
    const { userId, workspaceId, workflowName, content, sessionId, additionalParams } = job;

    try {
      this.logger.log(`Starting workflow execution: ${workflowName} for user ${userId}, workspace ${workspaceId} with content ${content}`);
      
      // 获取工作流服务
      const workflowService = this.moduleRef.get(CopilotWorkflowService, { strict: false });
      if (!workflowService) {
        throw new Error('Workflow service not available');
      }

      // 根据工作流类型创建相应的文件夹结构
      const folderStructure = await this.createWorkflowFolderStructure(workspaceId, workflowName, content);
      
      // 准备工作流参数
      const params = {
        content,
        originalIdea: content,
        userId,
        workspaceId,
        sessionId: sessionId || '',
        folderStructure: JSON.stringify(folderStructure),
        ...additionalParams,
      };

      // 运行工作流
      const results: string[] = [];
      for await (const result of workflowService.runGraph(params, workflowName, {
        user: userId,
        workspace: workspaceId,
        session: sessionId,
      })) {
        if (result.status === 'EmitContent' && 'content' in result) {
          results.push(result.content);
        }
        this.logger.debug(`Workflow ${workflowName} step completed: ${result.status}`);
      }

      this.logger.log(`Workflow ${workflowName} completed for user ${userId}`);
      return { success: true, results, folderStructure };
    } catch (error) {
      this.logger.error(`Failed to execute workflow ${workflowName} for user ${userId}:`, error);
      throw error;
    }
  }

  private async createWorkflowFolderStructure(workspaceId: string, workflowName: string, content: string) {
    const timestamp = new Date().toISOString().split('T')[0];
    const title = this.extractTitle(content);
    
    // 记录工作空间ID用于后续的文件夹创建
    this.logger.debug(`Creating folder structure for workspace: ${workspaceId}, workflow: ${workflowName}`);
    
    // 根据工作流类型创建不同的文件夹结构
    switch (workflowName) {
      case 'novel':
        return this.createNovelFolderStructure(title, timestamp);
      case 'presentation':
        return this.createPresentationFolderStructure(title, timestamp);
      case 'document':
        return this.createDocumentFolderStructure(title, timestamp);
      default:
        return this.createGenericFolderStructure(workflowName, title, timestamp);
    }
  }

  private createNovelFolderStructure(title: string, timestamp: string) {
    return {
      mainFolder: {
        id: `novel_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${title} - 小说创作`,
        path: `/novels/${title}`,
      },
      subFolders: [
        { id: `research_${timestamp}`, name: '市场调研', path: `/novels/${title}/research` },
        { id: `worldbuilding_${timestamp}`, name: '世界观设定', path: `/novels/${title}/worldbuilding` },
        { id: `characters_${timestamp}`, name: '人物设定', path: `/novels/${title}/characters` },
        { id: `plot_${timestamp}`, name: '情节设计', path: `/novels/${title}/plot` },
        { id: `outline_${timestamp}`, name: '大纲', path: `/novels/${title}/outline` },
        { id: `chapters_${timestamp}`, name: '章节内容', path: `/novels/${title}/chapters` },
        { id: `review_${timestamp}`, name: '审稿修改', path: `/novels/${title}/review` },
      ],
    };
  }

  private createPresentationFolderStructure(title: string, timestamp: string) {
    return {
      mainFolder: {
        id: `presentation_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${title} - 演示文稿`,
        path: `/presentations/${title}`,
      },
      subFolders: [
        { id: `research_${timestamp}`, name: '资料收集', path: `/presentations/${title}/research` },
        { id: `outline_${timestamp}`, name: '大纲设计', path: `/presentations/${title}/outline` },
        { id: `slides_${timestamp}`, name: '幻灯片', path: `/presentations/${title}/slides` },
        { id: `notes_${timestamp}`, name: '演讲笔记', path: `/presentations/${title}/notes` },
      ],
    };
  }

  private createDocumentFolderStructure(title: string, timestamp: string) {
    return {
      mainFolder: {
        id: `document_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${title} - 文档创作`,
        path: `/documents/${title}`,
      },
      subFolders: [
        { id: `research_${timestamp}`, name: '资料收集', path: `/documents/${title}/research` },
        { id: `draft_${timestamp}`, name: '草稿', path: `/documents/${title}/draft` },
        { id: `review_${timestamp}`, name: '审阅修改', path: `/documents/${title}/review` },
        { id: `final_${timestamp}`, name: '最终版本', path: `/documents/${title}/final` },
      ],
    };
  }

  private createGenericFolderStructure(workflowName: string, title: string, timestamp: string) {
    return {
      mainFolder: {
        id: `${workflowName}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${title} - ${workflowName}工作流`,
        path: `/${workflowName}s/${title}`,
      },
      subFolders: [
        { id: `input_${timestamp}`, name: '输入材料', path: `/${workflowName}s/${title}/input` },
        { id: `process_${timestamp}`, name: '处理过程', path: `/${workflowName}s/${title}/process` },
        { id: `output_${timestamp}`, name: '输出结果', path: `/${workflowName}s/${title}/output` },
      ],
    };
  }

  private extractTitle(content: string): string {
    // 简单的标题提取逻辑
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim();
    if (firstLine && firstLine.length > 0 && firstLine.length < 50) {
      return firstLine.replace(/[^\w\s\u4e00-\u9fff]/g, '').trim();
    }
    return `工作流_${new Date().toISOString().split('T')[0]}`;
  }
}
