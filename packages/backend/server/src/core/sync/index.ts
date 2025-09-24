import { Module } from '@nestjs/common';

import { DocStorageModule } from '../doc';
import { PermissionModule } from '../permission';
import { SpaceSyncGateway } from './gateway';
import { DocBroadcastListener } from './doc-broadcast-listener';

@Module({
  imports: [DocStorageModule, PermissionModule],
  providers: [SpaceSyncGateway, DocBroadcastListener],
})
export class SyncModule {}
