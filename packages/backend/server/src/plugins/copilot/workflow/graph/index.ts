import type { WorkflowGraphs } from '../types';
import { brainstorm } from './brainstorm';
import { anime, clay, pixel, sketch } from './image-filter';
import { novel, novelChapterBatch, novelReview } from './novel';
import { presentation } from './presentation';

export const WorkflowGraphList: WorkflowGraphs = [
  brainstorm,
  presentation,
  sketch,
  clay,
  anime,
  pixel,
  novel,
  novelReview,
  novelChapterBatch,
];
