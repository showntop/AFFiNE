import { Logger } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';
import { Doc, encodeStateAsUpdate, applyUpdate, Array as YArray, Map as YMap, Text as YText } from 'yjs';

import { AccessController } from '../../../core/permission';
import { Action } from '../../../core/permission/types';
import { DocModel } from '../../../models/doc';
import { PgWorkspaceDocStorageAdapter } from '../../../core/doc/adapters/workspace';
import { EventBus } from '../../../base';
import type { PromptService } from '../prompt';
import type { CopilotProviderFactory, CopilotChatOptions } from '../providers';
import { toolError } from './error';

const logger = new Logger('DocCreateTool');

/**
 * 初始化文档的 BlockSuite 结构
 * 创建必要的块结构，使文档能够正常打开
 */
function initDocStructure(yjsDoc: Doc, title: string, content?: string) {
  logger.log(`[DocCreateTool] Initializing doc structure for title: "${title}"`);
  
  // 创建页面根块
  const pageBlockId = `page_${Date.now()}`;
  const surfaceId = `surface_${Date.now()}`;
  const noteId = `note_${Date.now()}`;
  const paragraphId = `paragraph_${Date.now()}`;
  
  logger.log(`[DocCreateTool] Created IDs - pageBlockId: ${pageBlockId}, surfaceId: ${surfaceId}, noteId: ${noteId}, paragraphId: ${paragraphId}`);
  
  // 获取 blocks map
  const blocks = yjsDoc.getMap('blocks');
  
  // 创建页面根块 - 使用正确的 sys: 字段
  const pageBlock = new YMap();
  pageBlock.set('sys:id', pageBlockId);
  pageBlock.set('sys:flavour', 'affine:page');
  pageBlock.set('sys:version', 2);
  pageBlock.set('sys:children', new YArray());
  
  // 设置页面块的 props - 使用真正的 Y.Text 对象
  const titleYText = new YText();
  titleYText.insert(0, title);
  pageBlock.set('prop:title', titleYText);
  
  // 创建 surface 块
  const surfaceBlock = new YMap();
  surfaceBlock.set('sys:id', surfaceId);
  surfaceBlock.set('sys:flavour', 'affine:surface');
  surfaceBlock.set('sys:version', 5);
  surfaceBlock.set('sys:children', new YArray());
  
  // 设置 surface 块的 props - 使用正确的 Boxed 结构
  const elementsYMap = new YMap();
  const boxedElements = new YMap();
  boxedElements.set('type', '$blocksuite:internal:native$');
  boxedElements.set('value', elementsYMap);
  surfaceBlock.set('prop:elements', boxedElements);
  
  // 创建 note 块
  const noteChildren = new YArray<string>();
  const noteBlock = new YMap();
  noteBlock.set('sys:id', noteId);
  noteBlock.set('sys:flavour', 'affine:note');
  noteBlock.set('sys:version', 2);
  noteBlock.set('sys:children', noteChildren);
  
  // 设置 note 块的 props
  noteBlock.set('prop:displayMode', 0); // NoteDisplayMode.DocAndEdgeless
  
  // 创建段落块
  const paragraphChildren = new YArray<string>();
  const paragraphBlock = new YMap();
  paragraphBlock.set('sys:id', paragraphId);
  paragraphBlock.set('sys:flavour', 'affine:paragraph');
  paragraphBlock.set('sys:version', 2);
  paragraphBlock.set('sys:children', paragraphChildren);
  
  // 设置段落块的 props - 使用真正的 Y.Text 对象
  const paragraphYText = new YText();
  paragraphYText.insert(0, content || '');
  paragraphBlock.set('prop:text', paragraphYText);
  paragraphBlock.set('prop:type', 'text');
  
  // 创建页面块的 children
  const pageChildren = new YArray<string>();
  pageBlock.set('sys:children', pageChildren);
  
  // 设置 children 关系
  noteChildren.push([paragraphId]);
  pageChildren.push([surfaceId]);
  pageChildren.push([noteId]);
  
  logger.log(`[DocCreateTool] Created blocks with correct sys: fields`);
  
  // 添加所有块到 blocks map
  blocks.set(pageBlockId, pageBlock);
  blocks.set(surfaceId, surfaceBlock);
  blocks.set(noteId, noteBlock);
  blocks.set(paragraphId, paragraphBlock);
  
  logger.log(`[DocCreateTool] Added all blocks to blocks map`);
  
  // 设置根块
  yjsDoc.getMap('meta').set('root', pageBlockId);
  logger.log(`[DocCreateTool] Set meta root to: ${pageBlockId}`);
  
  // 检查文档结构
  logger.log(`[DocCreateTool] Document structure check:`);
  logger.log(`[DocCreateTool] - meta root:`, yjsDoc.getMap('meta').get('root'));
  logger.log(`[DocCreateTool] - blocks size:`, blocks.size);
  logger.log(`[DocCreateTool] - blocks keys:`, Array.from(blocks.keys()));
  
  logger.log(`[DocCreateTool] Document structure initialization completed for page: ${pageBlockId}`);
}

/**
 * 更新文档属性数据库
 * 设置文档的创建者、模式等属性
 */
async function updateDocProperties(
  workspaceId: string,
  docId: string,
  userId: string,
  docModel: DocModel,
  docStorageAdapter: PgWorkspaceDocStorageAdapter
) {
  try {
    // 获取或创建文档属性数据库
    const propertiesDocId = `db$${workspaceId}$docProperties`;
    let propertiesSnapshot = await docModel.getSnapshot(workspaceId, propertiesDocId);
    
    const propertiesDoc = new Doc();
    if (propertiesSnapshot) {
      applyUpdate(propertiesDoc, propertiesSnapshot.blob);
    }
    
    // 设置文档属性
    const docProperties = propertiesDoc.getMap(docId);
    docProperties.set('id', docId);
    docProperties.set('createdBy', userId);
    docProperties.set('updatedBy', userId); // 同时设置 updatedBy
    docProperties.set('primaryMode', 'page'); // 默认页面模式
    docProperties.set('edgelessColorTheme', 'light'); // 默认浅色主题
    docProperties.set('createdAt', Date.now());
    docProperties.set('updatedAt', Date.now());
    
    // 编码并推送更新
    const propertiesUpdate = encodeStateAsUpdate(propertiesDoc);

    await docStorageAdapter.pushDocUpdates(
      workspaceId,
      propertiesDocId,
      [propertiesUpdate],
      userId
    );
    
    logger.log(`Updated doc properties for ${docId}`);
  } catch (error) {
    logger.warn(`Failed to update doc properties for ${docId}:`, error);
    // 不抛出错误，因为这不是关键功能
  }
}

/**
 * 更新工作区根文档，将新文档添加到pages列表中
 * 使用AFFiNE的真实同步机制
 */
async function updateWorkspaceDocWithNewPage(
  workspaceId: string,
  docId: string,
  title: string,
  docModel: DocModel,
  docStorageAdapter: PgWorkspaceDocStorageAdapter,
  options: CopilotChatOptions,
  eventBus: EventBus
) {
  try {
    // 获取工作区根文档的快照
    const workspaceSnapshot = await docModel.getSnapshot(workspaceId, workspaceId);
    if (!workspaceSnapshot) {
      logger.warn(`Workspace snapshot not found for ${workspaceId}`);
      return;
    }

    // 解析工作区文档
    const workspaceDoc = new Doc();
    applyUpdate(workspaceDoc, workspaceSnapshot.blob);
    
    // 获取或创建meta.pages数组
    const meta = workspaceDoc.getMap('meta');
    let pages = meta.get('pages') as YArray<YMap<any>> | undefined;
    
    if (!pages) {
      pages = new YArray();
      meta.set('pages', pages);
    }

    // 检查文档是否已存在
    let docExists = false;
    for (const page of pages) {
      if (page.get('id') === docId) {
        docExists = true;
        // 更新标题
        page.set('title', title);
        break;
      }
    }

    // 如果文档不存在，添加新文档
    if (!docExists) {
      const newPageMap = new YMap();
      newPageMap.set('id', docId);
      newPageMap.set('title', title);
      newPageMap.set('trash', false);
      newPageMap.set('createDate', Date.now());
      newPageMap.set('updatedDate', Date.now());
      pages.push([newPageMap]);
    }

    // 编码更新后的工作区文档
    const workspaceUpdate = encodeStateAsUpdate(workspaceDoc);
    
    await docStorageAdapter.pushDocUpdates(
      workspaceId,
      workspaceId,
      [workspaceUpdate],
      options?.user || undefined
    );
    
    // 手动触发工作区根文档的广播事件，因为 pushDocUpdates 不会为工作区根文档触发 doc.created 事件
    eventBus.emit('doc.broadcast', {
      workspaceId: workspaceId,
      docId: workspaceId, // 工作区根文档的 docId 就是 workspaceId
      editor: options?.user || undefined,
    });
    
    logger.log(`Updated workspace ${workspaceId} with new page ${docId} and triggered broadcast`);
  } catch (error) {
    logger.error(`Failed to update workspace with new page: ${docId}`, error);
    throw error;
  }
}

export const buildDocCreator = (
  ac: AccessController,
  docModel: DocModel,
  docStorageAdapter: PgWorkspaceDocStorageAdapter,
  eventBus: EventBus
) => {
  const createDoc = async (
    options: CopilotChatOptions,
    title: string,
    content?: string,
    parentFolderId?: string
  ) => {
    if (!options || !options.user || !options.workspace) {
      logger.warn('User or workspace not provided for doc creation');
      return null;
    }

    // 检查用户是否有创建文档的权限
    const canCreate = await ac
      .user(options.user)
      .workspace(options.workspace)
      .can(Action.Workspace.CreateDoc);
    
    if (!canCreate) {
      logger.warn(`User ${options.user} does not have permission to create docs in workspace ${options.workspace}`);
      return {
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `You don't have permission to create documents in this workspace. Please contact the workspace administrator to be added as a member with appropriate permissions.`,
        details: {
          userId: options.user,
          workspaceId: options.workspace,
          requiredRole: 'Collaborator',
          currentRole: 'None'
        }
      };
    }

    try {
      // 生成新的文档ID
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 创建 Yjs 文档
      const yjsDoc = new Doc();
      const rootMap = yjsDoc.getMap('space:meta');
      
      // 设置文档基本信息
      rootMap.set('name', title);
      rootMap.set('avatar', '');
      
      // 初始化文档的 BlockSuite 结构
      initDocStructure(yjsDoc, title, content);
      
      // 编码文档状态为更新
      const update = encodeStateAsUpdate(yjsDoc);
      
      // 使用AFFiNE的真实文档同步机制推送更新，这会触发WebSocket广播
      await docStorageAdapter.pushDocUpdates(
        options.workspace,
        docId,
        [update],
        options?.user || undefined
      );
      
      // 文档创建通过 AFFiNE 的同步机制自动处理
      // docStorageAdapter.pushDocUpdates() 会触发必要的 WebSocket 广播
      
      // 创建文档元数据
      await docModel.upsertMeta(options.workspace, docId, {
        title: title,
        public: false,
      });
      
      // 更新文档属性数据库
      await updateDocProperties(options.workspace, docId, options.user, docModel, docStorageAdapter);
      
      // 更新工作区根文档，将新文档添加到pages列表中
      await updateWorkspaceDocWithNewPage(options.workspace, docId, title, docModel, docStorageAdapter, options, eventBus);
      
      // 手动触发广播事件，通知客户端新文档已创建
      eventBus.emit('doc.broadcast', {
        workspaceId: options.workspace,
        docId,
        editor: options.user,
      });
      
      logger.log(`Document created: ${docId} in workspace ${options.workspace}`);
      
      return {
        success: true,
        docId,
        title,
        content: content || '',
        parentFolderId: parentFolderId || null,
        createdAt: new Date().toISOString(),
        message: `Document "${title}" created successfully`,
        url: `/workspace/${options.workspace}/${docId}`,
      };
    } catch (err: any) {
      logger.error(`Failed to create document: ${title}`, err);
      return {
        success: false,
        error: err.message,
        message: `Failed to create document: ${err.message}`,
      };
    }
  };

  return createDoc;
};

export const createDocCreateTool = (
  promptService: PromptService,
  factory: CopilotProviderFactory,
  createDoc: (title: string, content?: string, parentFolderId?: string) => Promise<any>
) => {
  return tool({
    description:
      'Create a new document in the workspace. This tool creates a new document with specified title and optional content.',
    inputSchema: z.object({
      title: z.string().describe('The title of the document to create'),
      content: z.string().optional().describe('Optional initial content for the document (markdown format)'),
      parentFolderId: z.string().optional().describe('Optional parent folder ID to place the document in'),
    }),
    execute: async ({ title, content, parentFolderId }) => {
      try {
        // 如果有内容，使用 AI 来优化内容
        let finalContent = content;
        if (content && content.trim()) {
          try {
            const prompt = await promptService.get('Write an article about this');
            if (prompt) {
              const provider = await factory.getProviderByModel(prompt.model);
              if (provider) {
                const optimizedContent = await provider.text(
                  {
                    modelId: prompt.model,
                  },
                  [...prompt.finish({}), { 
                    role: 'user', 
                    content: `Please improve and structure this content as markdown: ${content}` 
                  }]
                );
                finalContent = optimizedContent;
              }
            }
          } catch (error) {
            logger.warn('Failed to optimize content with AI, using original content', error);
          }
        }
        
        // 使用构建的文档创建器
        const result = await createDoc(title, finalContent, parentFolderId);
        
        if (!result) {
          return toolError('Document Creation Failed', 'Failed to create document: insufficient permissions or invalid parameters');
        }
        
        if (!result.success) {
          return toolError('Document Creation Failed', result.error || 'Unknown error occurred');
        }
        
        return result;
      } catch (err: any) {
        logger.error(`Failed to create document: ${title}`, err);
        return toolError('Document Creation Failed', err.message);
      }
    },
  });
};
