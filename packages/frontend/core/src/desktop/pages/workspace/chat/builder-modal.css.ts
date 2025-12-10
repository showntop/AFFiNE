import { style } from '@vanilla-extract/css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  zIndex: 1100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const modal = style({
  width: 'min(1080px, 92vw)',
  height: 'min(780px, 90vh)',
  backgroundColor: 'var(--affine-background-primary-color)',
  borderRadius: 12,
  boxShadow: '0 12px 60px rgba(0, 0, 0, 0.22)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid var(--affine-border-color)',
});

export const title = style({
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--affine-text-primary-color)',
});

export const body = style({
  flex: 1,
  overflow: 'auto',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

export const footer = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
  padding: '12px 20px',
  borderTop: '1px solid var(--affine-border-color)',
});

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const sectionTitle = style({
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--affine-text-primary-color)',
});

export const fieldRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const label = style({
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--affine-text-secondary-color)',
});

export const input = style({
  width: '100%',
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  padding: '8px 10px',
  backgroundColor: 'var(--affine-background-secondary-color)',
  color: 'var(--affine-text-primary-color)',
});

export const textarea = style({
  width: '100%',
  minHeight: 120,
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  padding: '10px 12px',
  backgroundColor: 'var(--affine-background-secondary-color)',
  color: 'var(--affine-text-primary-color)',
  fontFamily: 'inherit',
});

export const helper = style({
  fontSize: 12,
  color: 'var(--affine-text-tertiary-color)',
});

export const row = style({
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
});

export const half = style({
  flex: 1,
  minWidth: 240,
});

export const messageCard = style({
  border: '1px solid var(--affine-border-color)',
  borderRadius: 8,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  backgroundColor: 'var(--affine-background-secondary-color)',
});

export const messageHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const select = style({
  height: 32,
  borderRadius: 6,
  border: '1px solid var(--affine-border-color)',
  padding: '0 10px',
  backgroundColor: 'var(--affine-background-primary-color)',
  color: 'var(--affine-text-primary-color)',
});

export const flowCanvas = style({
  width: '100%',
  height: 360,
  border: '1px solid var(--affine-border-color)',
  borderRadius: 12,
  overflow: 'hidden',
});

export const toolbar = style({
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
});

export const errorText = style({
  color: 'var(--affine-error-color)',
  fontSize: 12,
});

export const contentWithSidebar = style({
  display: 'grid',
  gridTemplateColumns: '260px 1fr',
  gap: 16,
  width: '100%',
  minHeight: 0,
});

export const contentMain = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  minHeight: 0,
});

export const sidebar = style({
  border: '1px solid var(--affine-border-color)',
  borderRadius: 8,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  backgroundColor: 'var(--affine-background-secondary-color)',
  minHeight: 0,
});

export const sidebarTitle = style({
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--affine-text-primary-color)',
});

export const promptList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  overflowY: 'auto',
  maxHeight: '100%',
});

export const promptItem = style({
  border: '1px solid var(--affine-border-color)',
  borderRadius: 8,
  padding: 10,
  cursor: 'pointer',
  transition: 'border-color 0.15s ease, background-color 0.15s ease',
  selectors: {
    '&:hover': {
      borderColor: 'var(--affine-text-tertiary-color)',
    },
    '&[data-active="true"]': {
      borderColor: 'var(--affine-primary-color)',
      backgroundColor:
        'color-mix(in srgb, var(--affine-primary-color) 8%, transparent)',
    },
  },
});

export const promptName = style({
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--affine-text-primary-color)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const promptDesc = style({
  marginTop: 4,
  fontSize: 12,
  color: 'var(--affine-text-secondary-color)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const empty = style({
  fontSize: 12,
  color: 'var(--affine-text-tertiary-color)',
});

export const tagList = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
});

export const tag = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  backgroundColor: 'var(--affine-background-secondary-color)',
  border: '1px solid var(--affine-border-color)',
  fontSize: 12,
  color: 'var(--affine-text-primary-color)',
});

export const addBtn = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px dashed var(--affine-border-color)',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  fontSize: 12,
});

export const inlineModal = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  backgroundColor: 'var(--affine-background-primary-color)',
  border: '1px solid var(--affine-border-color)',
  borderRadius: 12,
  padding: 16,
  boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
  minWidth: 320,
  zIndex: 1200,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const inlineModalMask = style({
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.05)',
  zIndex: 1100,
});

export const inlineRow = style({
  display: 'flex',
  gap: 8,
});

export const selectInput = style({
  width: '100%',
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  padding: '0 10px',
  backgroundColor: 'var(--affine-background-primary-color)',
  color: 'var(--affine-text-primary-color)',
});
