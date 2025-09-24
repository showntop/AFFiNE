import { ToolSet } from 'ai';

import { createAgentListTool, createAgentRouterTool } from './agent-router';
import { createBlobReadTool } from './blob-read';
import { createCodeArtifactTool } from './code-artifact';
import { createConversationSummaryTool } from './conversation-summary';
import { createDocComposeTool } from './doc-compose';
import { createDocCreateTool, buildDocCreator } from './doc-create';
import { createDocEditTool } from './doc-edit';
import { createDocKeywordSearchTool } from './doc-keyword-search';
import { createDocReadTool } from './doc-read';
import { createDocSemanticSearchTool } from './doc-semantic-search';
import { createExaCrawlTool } from './exa-crawl';
import { createExaSearchTool } from './exa-search';
import { createFolderCreateTool, buildFolderCreator } from './folder-create';
import { createWorkflowCreateTool } from './workflow-create';
import { createSectionEditTool } from './section-edit';
import { createTagCreateTool } from './tag-create';

export interface CustomAITools extends ToolSet {
  agent_router: ReturnType<typeof createAgentRouterTool>;
  agent_list: ReturnType<typeof createAgentListTool>;
  blob_read: ReturnType<typeof createBlobReadTool>;
  code_artifact: ReturnType<typeof createCodeArtifactTool>;
  conversation_summary: ReturnType<typeof createConversationSummaryTool>;
  doc_compose: ReturnType<typeof createDocComposeTool>;
  doc_create: ReturnType<typeof createDocCreateTool>;
  doc_edit: ReturnType<typeof createDocEditTool>;
  doc_keyword_search: ReturnType<typeof createDocKeywordSearchTool>;
  doc_read: ReturnType<typeof createDocReadTool>;
  doc_semantic_search: ReturnType<typeof createDocSemanticSearchTool>;
  folder_create: ReturnType<typeof createFolderCreateTool>;
  workflow_create: ReturnType<typeof createWorkflowCreateTool>;
  section_edit: ReturnType<typeof createSectionEditTool>;
  tag_create: ReturnType<typeof createTagCreateTool>;
  web_crawl_exa: ReturnType<typeof createExaCrawlTool>;
  web_search_exa: ReturnType<typeof createExaSearchTool>;
}

export * from './agent-router';
export * from './blob-read';
export * from './code-artifact';
export * from './conversation-summary';
export * from './doc-compose';
export * from './doc-create';
export * from './doc-edit';
export * from './doc-keyword-search';
export * from './doc-read';
export * from './doc-semantic-search';
export * from './error';
export * from './exa-crawl';
export * from './exa-search';
export * from './folder-create';
export * from './workflow-create';
export * from './section-edit';
export * from './tag-create';
