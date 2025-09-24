import { Logger } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';
import { Doc, encodeStateAsUpdate, applyUpdate } from 'yjs';

import { AccessController } from '../../../core/permission';
import { Action } from '../../../core/permission/types';
import { EventBus } from '../../../base';
import { DocModel } from '../../../models/doc';
import { PgWorkspaceDocStorageAdapter } from '../../../core/doc/adapters/workspace';
import type { PromptService } from '../prompt';
import type { CopilotProviderFactory, CopilotChatOptions } from '../providers';
import { toolError } from './error';

const logger = new Logger('FolderCreateTool');

/**
 * 通过AFFiNE的真实同步机制创建文件夹
 * 使用与前端相同的Yjs数据库结构和同步流程
 */
async function createFolderInFoldersDB(
  workspaceId: string,
  folderId: string,
  name: string,
  parentFolderId: string | null,
  index: string,
  docModel: DocModel,
  docStorageAdapter: PgWorkspaceDocStorageAdapter,
  options: CopilotChatOptions
) {
  try {
    // 获取db$folders文档的快照
    // 前端会将db$folders转换为db${workspaceId}$folders发送给后端
    const foldersDocId = `db$${workspaceId}$folders`;
    const foldersSnapshot = await docModel.getSnapshot(workspaceId, foldersDocId);
    
    // 创建或获取folders文档
    let foldersDoc: Doc;
    if (foldersSnapshot) {
      foldersDoc = new Doc();
      applyUpdate(foldersDoc, foldersSnapshot.blob);
    } else {
      // 如果folders文档不存在，创建一个新的
      foldersDoc = new Doc();
    }
    
    // 在Yjs数据库中，每个记录是一个YMap，以主键为key
    // 根据AFFiNE的YjsTableAdapter，记录存储在doc.getMap(key)中
    // 对于folders表，主键是'id'字段，所以key应该是folderId
    const folderRecord = foldersDoc.getMap(folderId);
    
    // 设置文件夹记录的数据 - 与前端FolderStore.createFolder保持一致
    foldersDoc.transact(() => {
      // 确保id字段被正确设置（这是主键）
      folderRecord.set('id', folderId);
      folderRecord.set('parentId', parentFolderId);
      folderRecord.set('data', name); // 文件夹名称存储在data字段中
      folderRecord.set('type', 'folder');
      folderRecord.set('index', index);
      // 删除删除标记，确保记录是活跃的
      folderRecord.delete('$$DELETED');
    }, 'FolderCreateTool');
    
    // 编码更新后的folders文档
    const foldersUpdate = encodeStateAsUpdate(foldersDoc);
    
    // 使用AFFiNE的真实文档同步机制推送更新，这会触发WebSocket广播
    await docStorageAdapter.pushDocUpdates(
      workspaceId,
      foldersDocId,
      [foldersUpdate],
      options?.user || undefined
    );
    
    logger.log(`Created folder ${folderId} in db$folders document using AFFiNE sync mechanism`);
  } catch (error) {
    logger.error(`Failed to create folder in db$folders: ${folderId}`, error);
    throw error;
  }
}


export const buildFolderCreator = (
  ac: AccessController,
  docModel: DocModel,
  docStorageAdapter: PgWorkspaceDocStorageAdapter,
  moduleRef: any
) => {
  const createFolder = async (
    options: CopilotChatOptions,
    name: string,
    parentFolderId?: string,
    description?: string
  ) => {
    if (!options || !options.user || !options.workspace) {
      logger.warn('User or workspace not provided for folder creation');
      return null;
    }

    // 检查用户是否有创建文件夹的权限（使用 Organize.Read 权限）
    const canOrganize = await ac
      .user(options.user)
      .workspace(options.workspace)
      .can(Action.Workspace.Organize.Read);
    
    if (!canOrganize) {
      logger.warn(`User ${options.user} does not have permission to create folders in workspace ${options.workspace}`);
      return {
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `You don't have permission to create folders in this workspace. Please contact the workspace administrator to be added as a member with appropriate permissions.`,
        details: {
          userId: options.user,
          workspaceId: options.workspace,
          requiredRole: 'External',
          currentRole: 'None'
        }
      };
    }

    try {
      // 生成新的文件夹ID - 使用与前端相同的ID生成策略
      const folderId = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 生成索引键用于排序 - 与前端FolderNode.indexAt保持一致
      const index = Date.now().toString();
      
      // 直接操作db$folders文档来创建文件夹
      await createFolderInFoldersDB(options.workspace, folderId, name, parentFolderId || null, index, docModel, docStorageAdapter, options);
      
      // 发射文档更新事件，触发索引更新等业务逻辑
      try {
        const eventBus = moduleRef.get(EventBus, { strict: false });
        if (eventBus) {
          eventBus.emit('doc.updated', {
            workspaceId: options.workspace,
            docId: 'db$folders',
          });
        }
      } catch (error) {
        logger.warn('Failed to emit doc.updated event for folder creation', error);
      }
      
      // 注意：space:broadcast-doc-update 事件由前端的主动同步机制触发
      // 前端会通过WebSocket定期同步 db$folders 文档，获取我们创建的文件夹
      
      logger.log(`Folder created: ${folderId} in workspace ${options.workspace}`);
      
      return {
        success: true,
        folderId,
        name,
        parentFolderId: parentFolderId || null,
        description: description || '',
        createdAt: new Date().toISOString(),
        message: `Folder "${name}" created successfully`,
        url: `/workspace/${options.workspace}/${folderId}`,
      };
    } catch (err: any) {
      logger.error(`Failed to create folder: ${name}`, err);
      return {
        success: false,
        error: err.message,
        message: `Failed to create folder: ${err.message}`,
      };
    }
  };

  return createFolder;
};

export const createFolderCreateTool = (
  _promptService: PromptService,
  _factory: CopilotProviderFactory,
  createFolder: (name: string, parentFolderId?: string, description?: string) => Promise<any>
) => {
  return tool({
    description:
      'Create a new folder in the workspace. This tool creates a new folder with specified name and optional parent folder.',
    inputSchema: z.object({
      name: z.string().describe('The name of the folder to create'),
      parentFolderId: z.string().optional().describe('Optional parent folder ID to create the folder inside'),
      description: z.string().optional().describe('Optional description for the folder'),
    }),
    execute: async ({ name, parentFolderId, description }) => {
      try {
        // 验证文件夹名称
        if (!name || name.trim().length === 0) {
          return toolError('Invalid Folder Name', 'Folder name cannot be empty');
        }

        // 检查名称长度
        if (name.length > 100) {
          return toolError('Invalid Folder Name', 'Folder name is too long (max 100 characters)');
        }

        // 使用构建的文件夹创建器
        const result = await createFolder(name, parentFolderId, description);
        
        if (!result) {
          return toolError('Folder Creation Failed', 'Failed to create folder: insufficient permissions or invalid parameters');
        }
        
        if (!result.success) {
          return toolError('Folder Creation Failed', result.error || 'Unknown error occurred');
        }
        
        return result;
      } catch (err: any) {
        logger.error(`Failed to create folder: ${name}`, err);
        return toolError('Folder Creation Failed', err.message);
      }
    },
  });
};
