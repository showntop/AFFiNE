import { ShadowlessElement } from '@blocksuite/affine/std';
import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

export interface QuickActionTemplate {
  id: string;
  label: string;
  template: string;
  icon?: string;
  description?: string;
}

@customElement('ai-chat-quick-actions')
export class AIChatQuickActions extends ShadowlessElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      position: relative;
    }

    .quick-actions-container {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 0 8px 0;
      margin-bottom: 2px;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .quick-actions-container::-webkit-scrollbar {
      display: none;
    }

    .quick-action-button {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 4px 8px;
      border: 1px solid var(--affine-v2-layer-insideBorder-border);
      border-radius: 4px;
      background-color: var(--affine-v2-layer-background);
      color: var(--affine-text-primary-color);
      font-size: 11px;
      font-weight: 400;
      line-height: 16px;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
      white-space: nowrap;
      flex-shrink: 0;
      box-shadow: 0px 1px 1px rgba(0, 0, 0, 0.03);
    }

    .quick-action-button:hover {
      background-color: var(--affine-v2-layer-background-hover);
      border-color: var(--affine-v2-layer-insideBorder-primaryBorder);
      box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.06);
    }

    .quick-action-button:active {
      transform: translateY(0.5px);
      box-shadow: 0px 1px 1px rgba(0, 0, 0, 0.03);
    }

    .quick-action-icon {
      font-size: 12px;
      line-height: 1;
    }

    .quick-action-label {
      white-space: nowrap;
    }

    .menu-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: 1px solid var(--affine-v2-layer-insideBorder-border);
      border-radius: 4px;
      background-color: var(--affine-v2-layer-background);
      color: var(--affine-text-secondary-color);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
      flex-shrink: 0;
      box-shadow: 0px 1px 1px rgba(0, 0, 0, 0.03);
    }

    .menu-button:hover {
      background-color: var(--affine-v2-layer-background-hover);
      border-color: var(--affine-v2-layer-insideBorder-primaryBorder);
      color: var(--affine-text-primary-color);
    }

    .popup-menu {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      background-color: var(--affine-v2-layer-background);
      border: 1px solid var(--affine-v2-layer-insideBorder-border);
      border-radius: 8px;
      box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      max-height: 300px;
      overflow-y: auto;
      padding: 12px;
      min-width: 200px;
    }

    .popup-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease;
      font-size: 13px;
      line-height: 20px;
    }

    .popup-menu-item:hover {
      background-color: var(--affine-v2-layer-background-hover);
    }

    .popup-menu-icon {
      font-size: 14px;
      width: 16px;
      text-align: center;
    }

    .popup-menu-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .popup-menu-description {
      font-size: 11px;
      color: var(--affine-text-secondary-color);
      margin-top: 2px;
      line-height: 16px;
      white-space: normal;
    }
  `;

  @property({ attribute: false })
  accessor onTemplateSelect: ((template: string) => void) | undefined;

  @state()
  accessor showMenu = false;

  private readonly templates: QuickActionTemplate[] = [
    {
      id: 'novel',
      label: '小说',
      template:
        '请帮我写一部长篇小说，要求：\n1. 题材：\n2. 主要角色：\n3. 故事背景：\n4. 主要情节：\n5. 字数要求：',
      icon: '📚',
      description: '创作长篇小说，包含完整的故事结构',
    },
    {
      id: 'article',
      label: '技术文章',
      template:
        '请帮我写一篇技术文章，主题是：\n\n要求：\n1. 文章结构清晰\n2. 包含代码示例\n3. 适合技术博客发布\n4. 字数约2000字',
      icon: '📝',
      description: '撰写技术博客文章，包含代码示例',
    },
    {
      id: 'email',
      label: '邮件',
      template: '请帮我写一封邮件：\n\n收件人：\n主题：\n内容要点：\n语气：',
      icon: '📧',
      description: '撰写商务或日常邮件',
    },
    {
      id: 'meeting',
      label: '会议纪要',
      template:
        '请帮我整理会议纪要：\n\n会议主题：\n参会人员：\n会议时间：\n主要讨论内容：\n决议事项：\n后续行动：',
      icon: '📋',
      description: '整理会议记录和行动项',
    },
    {
      id: 'code-review',
      label: '代码审查',
      template:
        '请帮我进行代码审查：\n\n代码功能：\n\n请从以下方面进行审查：\n1. 代码质量和可读性\n2. 性能优化建议\n3. 安全性检查\n4. 最佳实践建议',
      icon: '🔍',
      description: '代码质量检查和优化建议',
    },
    {
      id: 'presentation',
      label: '演示文稿',
      template:
        '请帮我制作一个演示文稿：\n\n主题：\n目标观众：\n时长：\n主要内容：\n\n请提供：\n1. 大纲结构\n2. 每页要点\n3. 视觉建议',
      icon: '📊',
      description: '制作PPT演示文稿大纲',
    },
    {
      id: 'resume',
      label: '简历',
      template:
        '请帮我写一份简历：\n\n个人信息：\n工作经历：\n教育背景：\n技能专长：\n项目经验：\n\n请优化简历结构和内容',
      icon: '💼',
      description: '撰写或优化个人简历',
    },
    {
      id: 'proposal',
      label: '项目提案',
      template:
        '请帮我写一个项目提案：\n\n项目名称：\n项目背景：\n目标与价值：\n实施方案：\n预算估算：\n时间计划：\n风险评估：',
      icon: '📋',
      description: '撰写项目提案和计划书',
    },
    {
      id: 'summary',
      label: '内容总结',
      template:
        '请帮我总结以下内容：\n\n[在此粘贴需要总结的内容]\n\n要求：\n1. 提取关键信息\n2. 保持逻辑清晰\n3. 突出重点要点',
      icon: '📄',
      description: '总结长文档或会议内容',
    },
    {
      id: 'translation',
      label: '翻译',
      template:
        '请帮我翻译以下内容：\n\n[在此粘贴需要翻译的内容]\n\n要求：\n1. 保持原意准确\n2. 语言自然流畅\n3. 符合目标语言习惯',
      icon: '🌐',
      description: '中英文互译或语言转换',
    },
  ];

  private readonly _handleTemplateClick = (template: string) => {
    this.onTemplateSelect?.(template);
  };

  private readonly _toggleMenu = () => {
    this.showMenu = !this.showMenu;
  };

  private readonly _handleMenuTemplateClick = (template: string) => {
    this.onTemplateSelect?.(template);
    this.showMenu = false;
  };

  private readonly _handleClickOutside = (event: MouseEvent) => {
    if (!this.contains(event.target as Node)) {
      this.showMenu = false;
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._handleClickOutside);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._handleClickOutside);
  }

  override render() {
    // 只显示前4个快捷方式，其余通过菜单展示
    const visibleTemplates = this.templates.slice(0, 4);

    return html`
      <div class="quick-actions-container">
        ${visibleTemplates.map(
          template => html`
            <button
              class="quick-action-button"
              @click=${() => this._handleTemplateClick(template.template)}
              title=${template.description || template.template}
            >
              ${template.icon
                ? html`<span class="quick-action-icon">${template.icon}</span>`
                : ''}
              <span class="quick-action-label">${template.label}</span>
            </button>
          `
        )}
        <button class="menu-button" @click=${this._toggleMenu} title="更多模板">
          ⋯
        </button>
      </div>
      ${this.showMenu
        ? html`
            <div
              style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.15);
          z-index: 99999;
          max-height: 400px;
          overflow-y: auto;
          padding: 12px;
          min-width: 300px;
          max-width: 500px;
        "
            >
              <div
                style="font-weight: bold; margin-bottom: 8px; color: var(--affine-text-primary-color);"
              >
                选择模板
              </div>
              ${repeat(
                this.templates,
                template => template.id,
                template => html`
                  <div
                    style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: background-color 0.15s ease;
                font-size: 13px;
                line-height: 20px;
                margin: 2px 0;
                background: #f8f9fa;
                border: 1px solid #e9ecef;
              "
                    @click=${() =>
                      this._handleMenuTemplateClick(template.template)}
                    @mouseenter=${(e: Event) => {
                      const target = e.target as HTMLElement;
                      target.style.backgroundColor = '#e9ecef';
                    }}
                    @mouseleave=${(e: Event) => {
                      const target = e.target as HTMLElement;
                      target.style.backgroundColor = '#f8f9fa';
                    }}
                  >
                    <div
                      style="font-size: 14px; width: 16px; text-align: center;"
                    >
                      ${template.icon || '📝'}
                    </div>
                    <div style="flex: 1;">
                      <div style="font-weight: 500;">${template.label}</div>
                      ${template.description
                        ? html`
                            <div
                              style="font-size: 11px; color: var(--affine-text-secondary-color); margin-top: 2px;"
                            >
                              ${template.description}
                            </div>
                          `
                        : ''}
                    </div>
                  </div>
                `
              )}
            </div>
          `
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-chat-quick-actions': AIChatQuickActions;
  }
}
