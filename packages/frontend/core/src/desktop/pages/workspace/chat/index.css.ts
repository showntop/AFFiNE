import { style } from '@vanilla-extract/css';

export const chatRoot = style({
  width: '100%',
  height: '100%',
});

export const chatHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
});

export const builderActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});
