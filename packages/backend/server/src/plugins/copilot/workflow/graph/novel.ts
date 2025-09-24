import { NodeExecutorType } from '../executor';
import type { WorkflowGraph, WorkflowNodeState } from '../types';
import { WorkflowNodeType } from '../types';

// 主要的小说创作workflow
export const novel: WorkflowGraph = {
  name: 'novel',
  graph: [
    {
      id: 'start',
      name: 'Start: Market Research',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel:market-research',
      paramKey: 'marketResearch',
      edges: ['step2'],
    },
    {
      id: 'step2',
      name: 'Step 2: Basic Setting',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel:basic-setting',
      paramKey: 'basicSetting',
      edges: ['step3'],
    },
    {
      id: 'step3',
      name: 'Step 3: World Building',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel:worldbuilding',
      paramKey: 'worldbuilding',
      edges: ['step4'],
    },
    {
      id: 'step4',
      name: 'Step 4: Character Design',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel:character-design',
      paramKey: 'characterDesign',
      edges: ['step5'],
    },
    {
      id: 'step5',
      name: 'Step 5: Plot Design',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel:plot-design',
      paramKey: 'plotDesign',
      edges: ['step6'],
    },
    {
      id: 'step6',
      name: 'Step 6: Outline Design',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel:outline-design',
      paramKey: 'outline',
      edges: ['step7'],
    },
    {
      id: 'step7',
      name: 'Step 7: Chapter Creation Planning',
      nodeType: WorkflowNodeType.Decision,
      condition: (nodeIds: string[], params: WorkflowNodeState) => {
        // 这里可以根据需要决定是否进入逐章创作模式
        // 暂时总是进入创作模式
        console.log('nodeIds', nodeIds);
        console.log('params', params);
        return nodeIds[0]; // 选择第一个边，即step8
      },
      edges: ['step8', 'finish'],
    },
    {
      id: 'step8',
      name: 'Step 8: Detailed Outline for Chapter',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel:detailed-outline',
      paramKey: 'detailedOutline',
      edges: ['step9'],
    },
    {
      id: 'step9',
      name: 'Step 9: Chapter Writing',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel:chapter-writing',
      edges: ['finish'],
    },
    {
      id: 'finish',
      name: 'Finish: Novel Creation Complete',
      nodeType: WorkflowNodeType.Nope,
      edges: [],
    },
  ],
};

// 审稿和优化的workflow
export const novelReview: WorkflowGraph = {
  name: 'novel-review',
  graph: [
    {
      id: 'start',
      name: 'Start: Consistency Check',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel-review:consistency-check',
      paramKey: 'consistencyReport',
      edges: ['step2'],
    },
    {
      id: 'step2',
      name: 'Step 2: AI Flavor Removal',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel-review:ai-flavor-removal',
      paramKey: 'deAIContent',
      edges: ['step3'],
    },
    {
      id: 'step3',
      name: 'Step 3: Quality Enhancement',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel-review:quality-enhancement',
      edges: ['finish'],
    },
    {
      id: 'finish',
      name: 'Finish: Review Complete',
      nodeType: WorkflowNodeType.Nope,
      edges: [],
    },
  ],
};

// 单独的章节创作workflow（用于批量创作多个章节）
export const novelChapterBatch: WorkflowGraph = {
  name: 'novel-chapter-batch',
  graph: [
    {
      id: 'start',
      name: 'Start: Chapter Detailed Outline',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel:detailed-outline',
      paramKey: 'detailedOutline',
      edges: ['step2'],
    },
    {
      id: 'step2',
      name: 'Step 2: Chapter Writing',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel:chapter-writing',
      paramKey: 'chapterContent',
      edges: ['step3'],
    },
    {
      id: 'step3',
      name: 'Step 3: Chapter Review',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel-review:consistency-check',
      paramKey: 'reviewReport',
      edges: ['step4'],
    },
    {
      id: 'step4',
      name: 'Step 4: Quality Enhancement',
      nodeType: WorkflowNodeType.Basic,
      type: NodeExecutorType.ChatText,
      promptName: 'workflow:novel-review:quality-enhancement',
      edges: ['finish'],
    },
    {
      id: 'finish',
      name: 'Finish: Chapter Complete',
      nodeType: WorkflowNodeType.Nope,
      edges: [],
    },
  ],
};
