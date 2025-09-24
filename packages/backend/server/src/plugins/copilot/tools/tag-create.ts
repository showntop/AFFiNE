import { Logger } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';

import { toolError } from './error';

const logger = new Logger('TagCreateTool');

// 预定义的标签颜色
const TAG_COLORS = [
  '#FF6B6B', // 红色
  '#4ECDC4', // 青色
  '#45B7D1', // 蓝色
  '#96CEB4', // 绿色
  '#FFEAA7', // 黄色
  '#DDA0DD', // 紫色
  '#98D8C8', // 薄荷绿
  '#F7DC6F', // 金色
  '#BB8FCE', // 淡紫色
  '#85C1E9', // 天蓝色
];

export const createTagCreateTool = () => {
  return tool({
    description:
      'Create a new tag in the workspace. This tool creates a new tag with specified name and optional color.',
    inputSchema: z.object({
      name: z.string().describe('The name of the tag to create'),
      color: z.string().optional().describe('Optional color for the tag (hex color code)'),
      description: z.string().optional().describe('Optional description for the tag'),
    }),
    execute: async ({ name, color, description }) => {
      try {
        // 生成唯一的标签 ID
        const tagId = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 验证标签名称
        if (!name || name.trim().length === 0) {
          return toolError('Invalid Tag Name', 'Tag name cannot be empty');
        }

        // 检查名称长度
        if (name.length > 50) {
          return toolError('Invalid Tag Name', 'Tag name is too long (max 50 characters)');
        }

        // 验证颜色格式
        let finalColor = color;
        if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
          logger.warn(`Invalid color format: ${color}, using random color`);
          finalColor = undefined;
        }

        // 如果没有指定颜色或颜色无效，随机选择一个颜色
        if (!finalColor) {
          finalColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
        }

        // 模拟标签创建过程
        // 在实际实现中，这里会调用相应的服务来创建标签
        const tagData = {
          id: tagId,
          name: name.trim(),
          color: finalColor,
          description: description || '',
          createdAt: new Date().toISOString(),
          updateDate: new Date().toISOString(),
        };

        return {
          success: true,
          tagId,
          name: tagData.name,
          color: tagData.color,
          description: tagData.description,
          createdAt: tagData.createdAt,
          message: `Tag "${name}" created successfully with color ${finalColor}`,
        };
      } catch (err: any) {
        logger.error(`Failed to create tag: ${name}`, err);
        return toolError('Tag Creation Failed', err.message);
      }
    },
  });
};
