import { Logger } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';

import { JobQueue } from '../../../base';
import type { CopilotChatOptions } from '../providers';
import { toolError } from './error';

const logger = new Logger('WorkflowCreateTool');

export const buildWorkflowCreator = (jobQueue: JobQueue) => {
  const createWorkflow = async (
    options: CopilotChatOptions,
    workflowName: string,
    content: string,
    additionalParams?: Record<string, any>
  ) => {
    if (!options?.user || !options?.workspace) {
      logger.warn('Missing user or workspace in options');
      return;
    }

    const userId = options.user;
    const workspaceId = options.workspace;
    const sessionId = options.session;

    logger.debug(`Creating workflow task for user ${userId}, workflow: ${workflowName}`);
    try {
      // 创建异步任务
      const job = await jobQueue.add('copilot.workflow.execute', {
        userId,
        workspaceId,
        workflowName,
        content,
        sessionId,
        additionalParams: additionalParams || {},
      });

      // 生成任务链接 - 使用更合适的路径
      const taskLink = `/workspace/${workspaceId}/copilot/sessions/${sessionId || workflowName}/tasks/${job.id}`;
      
      // 生成任务ID
      const taskId = `${workflowName}_${job.id}`;

      logger.log(`Workflow task created: ${taskId} for user ${userId}, workflow: ${workflowName}`);

      return {
        success: true,
        taskId,
        jobId: job.id,
        taskLink,
        workflowName,
        status: 'pending',
        message: `${workflowName} workflow task has been created and is starting in the background`,
        details: {
          userId,
          workspaceId,
          workflowName,
          content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          createdAt: new Date().toISOString(),
          additionalParams: additionalParams || {},
        },
      };
    } catch (err: any) {
      logger.error(`Failed to create workflow task for user ${userId}, workflow: ${workflowName}`, err);
      throw err;
    }
  };
  return createWorkflow;
};

export const createWorkflowCreateTool = (
  createWorkflow: (
    workflowName: string,
    content: string,
    additionalParams?: Record<string, any>
  ) => Promise<object | undefined>
) => {
  return tool({
    description:
      'Create an async task for workflow execution. This tool creates a background task to execute various workflows step by step.',
    inputSchema: z.object({
      workflowName: z.string().describe('The name of the workflow to execute (e.g., novel, presentation, etc.)'),
      content: z.string().describe('The input content and requirements for the workflow'),
      additionalParams: z.record(z.any()).optional().describe('Additional parameters for the workflow'),
    }),
    execute: async ({ workflowName, content, additionalParams }) => {
      try {
        const result = await createWorkflow(workflowName, content, additionalParams);
        if (!result) {
          return toolError('Workflow Task Creation Failed', 'Missing user or workspace information');
        }
        return { ...result };
      } catch (err: any) {
        logger.error(`Failed to create workflow task for workflow: ${workflowName}`, err);
        return toolError('Workflow Task Creation Failed', err.message);
      }
    },
  });
};