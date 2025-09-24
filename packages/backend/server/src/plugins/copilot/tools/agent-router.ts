import { tool } from 'ai';
import { z } from 'zod';

import { AgentCallerService, AgentType } from '../agent/agent-caller.service';

export function createAgentRouterTool(agentCaller: AgentCallerService, options?: any) {
  return tool({
    description: 'Route user query to the most appropriate specialized agent for processing',
    inputSchema: z.object({
      agentType: z.enum(['assistant', 'novel', 'image', 'code', 'document', 'workflow']).describe('The type of agent to route to'),
      agentName: z.string().describe('The specific agent name to call'),
      userQuery: z.string().describe('The original user query to process'),
      reasoning: z.string().optional().describe('Brief explanation of why this agent was chosen'),
    }),
    execute: async ({ agentType, agentName, userQuery, reasoning }) => {
      try {
        // 调用指定的 agent
        const result = await agentCaller.callAgent({
          agentType: agentType as AgentType,
          agentName,
          content: userQuery,
          userId: options?.user || 'system',
          workspaceId: options?.workspace,
          sessionId: options?.session,
        });

        if (result.success) {
          return {
            success: true,
            content: result.content,
            agentType: result.agentType,
            agentName: result.agentName,
            reasoning: reasoning || `Successfully routed to ${agentType}/${agentName}`,
            metadata: result.metadata,
          };
        } else {
          return {
            success: false,
            error: result.error || 'Agent call failed',
            agentType: result.agentType,
            agentName: result.agentName,
            reasoning: reasoning || `Failed to route to ${agentType}/${agentName}`,
          };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          agentType,
          agentName,
          reasoning: reasoning || `Error routing to ${agentType}/${agentName}`,
        };
      }
    },
  });
}

export function createAgentListTool(agentCaller: AgentCallerService) {
  return tool({
    description: 'Get list of available agents for routing decisions',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const agents = await agentCaller.getAvailableAgents();
        return {
          success: true,
          agents,
          totalAgents: Object.values(agents).flat().length,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get agent list',
        };
      }
    },
  });
}
