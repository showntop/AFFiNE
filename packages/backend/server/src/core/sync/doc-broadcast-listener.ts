import { Injectable } from '@nestjs/common';
import { OnEvent } from '../../base';
import { SpaceSyncGateway } from './gateway';
import { Models } from '../../models';

@Injectable()
export class DocBroadcastListener {
  constructor(
    private readonly gateway: SpaceSyncGateway,
    private readonly models: Models
  ) {}

  @OnEvent('doc.broadcast')
  async broadcastDocUpdate(payload: Events['doc.broadcast']) {
    console.log('broadcastDocUpdate received', payload);
    const { workspaceId, docId, editor } = payload;
    
    try {
      // 获取最新的文档更新
      const rows = await this.models.doc.findUpdates(workspaceId, docId);
      if (!rows || rows.length === 0) {
        console.warn(`No updates found for doc ${docId}`);
        return;
      }

      const latestUpdate = rows[rows.length - 1];
      const updateBase64 = Buffer.from(latestUpdate.blob).toString('base64');

      // 使用 SpaceSyncGateway 的公共方法进行广播
      await this.gateway.broadcastDocUpdate(
        'workspace',
        workspaceId,
        docId,
        updateBase64,
        editor
      );

      console.log(`Broadcasted doc ${docId} to workspace ${workspaceId}`);
    } catch (error) {
      console.error(`Failed to broadcast doc ${docId}:`, error);
    }
  }
}
