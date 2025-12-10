import './reactflow.css';

import { Button, IconButton } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import {
  useQuery,
  useQueryImmutable,
} from '@affine/core/components/hooks/use-query';
import {
  type CopilotPromptMessageInput,
  CopilotPromptMessageRole,
  getPromptModelsQuery,
  getPromptsQuery,
  updatePromptMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { CloseIcon, PlusIcon } from '@blocksuite/icons/rc';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import ReactFlow, {
  addEdge,
  Background,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  useEdgesState,
  useNodesState,
} from 'reactflow';

import * as styles from './builder-modal.css';

type BuilderModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

const BuilderModal = ({
  title,
  onClose,
  children,
  footer,
}: BuilderModalProps) =>
  createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={event => {
          event.stopPropagation();
        }}
      >
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <IconButton icon={<CloseIcon />} onClick={onClose} />
        </div>
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body
  );

type EditableMessage = {
  role: CopilotPromptMessageRole;
  content: string;
  params?: string;
};

const safeParseJson = (value: string | undefined): Record<string, any> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Failed to parse params', error);
    return {};
  }
};

type AgentBuilderModalProps = {
  open: boolean;
  onClose: () => void;
};

type PromptListItem = {
  name: string;
  action: string | null;
  model: string;
  messages: { content: string; role: CopilotPromptMessageRole; params?: any }[];
  optionalModels?: string[];
};

type ModelOption = {
  id: string;
  name: string;
  provider: string;
};

const usePromptList = (open: boolean): PromptListItem[] => {
  const { data: promptsData } = useQuery(
    open ? { query: getPromptsQuery } : undefined
  );
  return (
    promptsData?.listCopilotPrompts?.map(p => ({
      name: p.name,
      action: p.action,
      model: p.model,
      messages: p.messages,
      optionalModels: (p as any).optionalModels || [],
    })) ?? []
  );
};

const PromptSidebar = ({
  prompts,
  selected,
  onSelect,
  labels,
}: {
  prompts: PromptListItem[];
  selected?: string;
  onSelect: (name: string) => void;
  labels: { title: string; empty: string; noDesc: string };
}) => {
  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarTitle}>{labels.title}</div>
      {prompts.length ? (
        <div className={styles.promptList}>
          {prompts.map(item => (
            <div
              key={item.name}
              className={styles.promptItem}
              data-active={item.name === selected}
              onClick={() => onSelect(item.name)}
            >
              <div className={styles.promptName}>{item.name}</div>
              <div className={styles.promptDesc}>
                {item.action || item.messages?.[0]?.content || labels.noDesc}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>{labels.empty}</div>
      )}
    </div>
  );
};

export const AgentBuilderModal = ({
  open,
  onClose,
}: AgentBuilderModalProps) => {
  const t = useI18n();
  const defaultGoal = useMemo(
    () => t['com.affine.ai.builder.agent.defaultGoal'](),
    [t]
  );
  const defaultTools = useMemo(
    () => t['com.affine.ai.builder.agent.defaultTools'](),
    [t]
  );
  const defaultSystemContent = useMemo(
    () => t['com.affine.ai.builder.agent.defaultSystemContent'](),
    [t]
  );
  const [promptName, setPromptName] = useState('agent:custom');
  const [model, setModel] = useState('');
  const [optionalModels, setOptionalModels] = useState<string[]>([]);
  const [showAddModel, setShowAddModel] = useState(false);
  const [providerFilter, setProviderFilter] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [goal, setGoal] = useState(defaultGoal);
  const [tools, setTools] = useState(defaultTools);
  const [messages, setMessages] = useState<EditableMessage[]>([
    {
      role: CopilotPromptMessageRole.system,
      content: defaultSystemContent,
      params: JSON.stringify({ type: 'agent', version: 1 }, null, 2),
    },
  ]);
  const [savingError, setSavingError] = useState<string | null>(null);

  const { trigger: updatePrompt, isMutating } = useMutation({
    mutation: updatePromptMutation,
  });

  const promptList = usePromptList(open);

  const canFetchModels =
    open && promptList.some(item => item.name === promptName);

  const { data: modelsData } = useQueryImmutable(
    canFetchModels
      ? { query: getPromptModelsQuery, variables: { promptName } }
      : undefined,
    { suspense: false, revalidateOnFocus: false }
  );

  // 全部 provider（不依赖当前 prompt）
  const { data: globalModelsData } = useQueryImmutable(
    open
      ? {
          query: getPromptModelsQuery,
          variables: { promptName: 'Chat With AFFiNE AI' },
        }
      : undefined,
    { suspense: false, revalidateOnFocus: false }
  );

  const providersWithModels = useMemo((): {
    type: string;
    models: ModelOption[];
  }[] => {
    const modelsAny = modelsData as any;
    const providers = modelsAny?.currentUser?.copilot?.providers || [];
    const globalProviders =
      (globalModelsData as any)?.currentUser?.copilot?.providers || [];
    const all = [...providers, ...globalProviders];
    const map = new Map<string, { type: string; models: ModelOption[] }>();
    all.forEach((p: any) => {
      const type = p?.type;
      if (!type) return;
      const current = map.get(type) || { type, models: [] as ModelOption[] };
      (p?.models || []).forEach((m: any) => {
        if (!m?.id) return;
        if (current.models.some(item => item.id === m.id)) return;
        current.models.push({ id: m.id, name: m.name, provider: type });
      });
      map.set(type, current);
    });
    return Array.from(map.values());
  }, [globalModelsData, modelsData]);

  const providerTypes = useMemo(
    () => providersWithModels.map(p => p.type),
    [providersWithModels]
  );

  const selectedProviderModels = useMemo(() => {
    const targetType = providerFilter || providerTypes[0];
    const provider = providersWithModels.find(p => p.type === targetType);
    return provider?.models ?? [];
  }, [providerFilter, providerTypes, providersWithModels]);

  const applyPrompt = useCallback(
    (name: string) => {
      const prompt = promptList.find(p => p.name === name);
      if (!prompt) {
        setPromptName(name);
        return;
      }
      setPromptName(prompt.name);
      setModel(prompt.model || '');
      setOptionalModels(prompt.optionalModels || []);
      if (prompt.messages?.[0]?.params?.tools) {
        const t = prompt.messages?.[0]?.params?.tools;
        setTools(Array.isArray(t) ? t.join(', ') : String(t));
      }
      const firstParams = prompt.messages?.[0]?.params as any;
      if (firstParams?.goal) {
        setGoal(String(firstParams.goal));
      }
      if (prompt.messages?.length) {
        setMessages(
          prompt.messages.map(m => ({
            role: m.role,
            content: m.content,
            params:
              m.params && Object.keys(m.params || {}).length
                ? JSON.stringify(m.params, null, 2)
                : '',
          }))
        );
      }
    },
    [promptList]
  );

  useEffect(() => {
    if (!open) {
      setSavingError(null);
    }
  }, [open]);

  const onUpdateMessage = useCallback(
    (index: number, next: Partial<EditableMessage>) => {
      setMessages(prev => {
        const cloned = [...prev];
        cloned[index] = { ...cloned[index], ...next };
        return cloned;
      });
    },
    []
  );

  const onAddMessage = useCallback(() => {
    setMessages(prev => [
      ...prev,
      {
        role: CopilotPromptMessageRole.user,
        content: '',
      },
    ]);
  }, []);

  const onRemoveMessage = useCallback((index: number) => {
    setMessages(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  const onSave = useCallback(async () => {
    const trimmedName = promptName.trim();
    if (!trimmedName) {
      setSavingError(t['com.affine.ai.builder.agent.error.promptName']());
      return;
    }
    if (!messages.length) {
      setSavingError(t['com.affine.ai.builder.agent.error.messageRequired']());
      return;
    }
    setSavingError(null);

    const normalizedMessages: CopilotPromptMessageInput[] = messages.map(
      msg => ({
        role: msg.role,
        content: msg.content || ' ',
        params: {
          ...safeParseJson(msg.params),
          type: 'agent',
          goal: goal.trim(),
          tools: JSON.stringify(
            tools
              .split(',')
              .map(t => t.trim())
              .filter(Boolean)
          ),
        } as Record<string, string>,
      })
    );

    try {
      await (updatePrompt as any)({
        name: trimmedName,
        messages: normalizedMessages,
        model: model.trim() || null,
        optionalModels,
      });
      onClose();
    } catch (error: any) {
      console.error(error);
      setSavingError(
        error?.message ?? t['com.affine.ai.builder.agent.error.saveFailed']()
      );
    }
  }, [
    goal,
    messages,
    model,
    optionalModels,
    promptName,
    tools,
    updatePrompt,
    onClose,
    t,
  ]);

  if (!open) return null;

  return (
    <BuilderModal
      title={t['com.affine.ai.builder.agent.title']()}
      onClose={onClose}
      footer={
        <>
          {savingError ? (
            <div className={styles.errorText}>{savingError}</div>
          ) : null}
          <Button variant="plain" onClick={onClose}>
            {t['com.affine.ai.builder.common.cancel']()}
          </Button>
          <Button onClick={() => void onSave()} loading={isMutating}>
            {t['com.affine.ai.builder.common.savePrompt']()}
          </Button>
        </>
      }
    >
      <div className={styles.contentWithSidebar}>
        <PromptSidebar
          prompts={promptList}
          selected={promptName}
          onSelect={applyPrompt}
          labels={{
            title: t['com.affine.ai.builder.sidebar.title'](),
            empty: t['com.affine.ai.builder.sidebar.empty'](),
            noDesc: t['com.affine.ai.builder.sidebar.noDesc'](),
          }}
        />
        <div className={styles.contentMain}>
          <div className={styles.section}>
            <div className={styles.row}>
              <div className={styles.half}>
                <div className={styles.fieldRow}>
                  <label className={styles.label}>
                    {t['com.affine.ai.builder.common.promptName']()}
                  </label>
                  <input
                    className={styles.input}
                    value={promptName}
                    onChange={e => setPromptName(e.target.value)}
                    placeholder={t[
                      'com.affine.ai.builder.agent.promptName.placeholder'
                    ]()}
                  />
                  <div className={styles.helper}>
                    {t['com.affine.ai.builder.agent.promptName.helper']()}
                  </div>
                </div>
              </div>
              <div className={styles.half}>
                <div className={styles.fieldRow}>
                  <label className={styles.label}>
                    {t['com.affine.ai.builder.agent.defaultModel.label']()}
                  </label>
                  <select
                    className={styles.selectInput}
                    value={model}
                    onChange={e => setModel(e.target.value)}
                  >
                    <option value="">
                      {t[
                        'com.affine.ai.builder.agent.defaultModel.customOption'
                      ]()}
                    </option>
                    {optionalModels.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.half}>
                <div className={styles.fieldRow}>
                  <label className={styles.label}>
                    {t['com.affine.ai.builder.agent.goal.label']()}
                  </label>
                  <input
                    className={styles.input}
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    placeholder={t[
                      'com.affine.ai.builder.agent.goal.placeholder'
                    ]()}
                  />
                </div>
              </div>
              <div className={styles.half}>
                <div className={styles.fieldRow}>
                  <label className={styles.label}>
                    {t['com.affine.ai.builder.agent.optionalModels.label']()}
                  </label>
                  <div className={styles.tagList}>
                    {optionalModels.map(item => (
                      <span className={styles.tag} key={item}>
                        {item}
                      </span>
                    ))}
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={() => {
                        setProviderFilter(providerTypes[0] || '');
                        setSelectedModelId('');
                        setShowAddModel(true);
                      }}
                    >
                      <PlusIcon />{' '}
                      {t['com.affine.ai.builder.agent.optionalModels.add']()}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                {t['com.affine.ai.builder.agent.tools.label']()}
              </label>
              <input
                className={styles.input}
                value={tools}
                onChange={e => setTools(e.target.value)}
                placeholder={t[
                  'com.affine.ai.builder.agent.tools.placeholder'
                ]()}
              />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {t['com.affine.ai.builder.agent.messages.title']()}
            </div>
            <div className={styles.helper}>
              {t['com.affine.ai.builder.agent.messages.helper']()}
            </div>
            {messages.map((message, index) => (
              <div className={styles.messageCard} key={index}>
                <div className={styles.messageHeader}>
                  <select
                    className={styles.select}
                    value={message.role}
                    onChange={e =>
                      onUpdateMessage(index, {
                        role: e.target.value as CopilotPromptMessageRole,
                      })
                    }
                  >
                    <option value={CopilotPromptMessageRole.system}>
                      system
                    </option>
                    <option value={CopilotPromptMessageRole.user}>user</option>
                    <option value={CopilotPromptMessageRole.assistant}>
                      assistant
                    </option>
                  </select>
                  {messages.length > 1 ? (
                    <Button
                      variant="plain"
                      onClick={() => onRemoveMessage(index)}
                    >
                      {t['com.affine.ai.builder.agent.messages.delete']()}
                    </Button>
                  ) : null}
                </div>
                <textarea
                  className={styles.textarea}
                  value={message.content}
                  placeholder={t[
                    'com.affine.ai.builder.agent.messages.content.placeholder'
                  ]()}
                  onChange={e =>
                    onUpdateMessage(index, { content: e.target.value })
                  }
                />
                <div className={styles.fieldRow}>
                  <label className={styles.label}>
                    {t['com.affine.ai.builder.agent.messages.params.label']()}
                  </label>
                  <textarea
                    className={styles.textarea}
                    value={message.params || ''}
                    placeholder={t[
                      'com.affine.ai.builder.agent.messages.params.placeholder'
                    ]()}
                    onChange={e =>
                      onUpdateMessage(index, { params: e.target.value })
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              prefix={<PlusIcon />}
              variant="plain"
              onClick={onAddMessage}
            >
              {t['com.affine.ai.builder.agent.messages.add']()}
            </Button>
          </div>
        </div>
      </div>
      {showAddModel && (
        <>
          <div
            className={styles.inlineModalMask}
            onClick={() => setShowAddModel(false)}
          />
          <div className={styles.inlineModal}>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                {t['com.affine.ai.builder.common.provider']()}
              </label>
              <select
                className={styles.selectInput}
                value={providerFilter || providerTypes[0] || ''}
                onChange={e => {
                  setProviderFilter(e.target.value);
                  setSelectedModelId('');
                }}
              >
                {providerTypes.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                {t['com.affine.ai.builder.common.model']()}
              </label>
              {selectedProviderModels.length ? (
                <select
                  className={styles.selectInput}
                  value={selectedModelId}
                  onChange={e => {
                    setSelectedModelId(e.target.value);
                    setCustomModelId('');
                  }}
                >
                  <option value="">
                    {t['com.affine.ai.builder.common.modelPlaceholder']()}
                  </option>
                  {selectedProviderModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                className={styles.input}
                placeholder={t[
                  'com.affine.ai.builder.common.customModelPlaceholder'
                ]()}
                value={customModelId}
                onChange={e => {
                  setCustomModelId(e.target.value);
                  setSelectedModelId('');
                }}
                style={{ marginTop: 8 }}
              />
            </div>
            <div className={styles.inlineRow}>
              <Button variant="plain" onClick={() => setShowAddModel(false)}>
                {t['com.affine.ai.builder.common.cancel']()}
              </Button>
              <Button
                disabled={!selectedModelId && !customModelId}
                onClick={() => {
                  const pick = selectedModelId || customModelId.trim();
                  if (!pick) return;
                  setOptionalModels(prev =>
                    prev.includes(pick) ? prev : [...prev, pick]
                  );
                  setShowAddModel(false);
                  setSelectedModelId('');
                  setCustomModelId('');
                }}
              >
                {t['com.affine.ai.builder.common.confirm']()}
              </Button>
            </div>
          </div>
        </>
      )}
    </BuilderModal>
  );
};

type WorkflowBuilderModalProps = {
  open: boolean;
  onClose: () => void;
};

type FlowNode = Node<{ label: string }>;
type FlowEdge = Edge<{ label?: string }>;

export const WorkflowBuilderModal = ({
  open,
  onClose,
}: WorkflowBuilderModalProps) => {
  const t = useI18n();
  const buildStepLabel = useCallback(
    (index: number) =>
      (t['com.affine.ai.builder.workflow.graph.stepLabel'] as any)({
        index,
      }),
    [t]
  );
  const defaultWorkflowDescription = useMemo(
    () => t['com.affine.ai.builder.workflow.description.default'](),
    [t]
  );
  const [promptName, setPromptName] = useState('workflow:custom');
  const [description, setDescription] = useState(defaultWorkflowDescription);
  const [nodeIndex, setNodeIndex] = useState(2);
  const [savingError, setSavingError] = useState<string | null>(null);

  const initialNodes = useMemo<FlowNode[]>(
    () => [
      {
        id: 'start',
        type: 'input',
        position: { x: 0, y: 0 },
        data: { label: t['com.affine.ai.builder.workflow.graph.start']() },
      },
      {
        id: 'step-1',
        position: { x: 180, y: 120 },
        data: { label: buildStepLabel(1) },
      },
    ],
    [buildStepLabel, t]
  );
  const initialEdges = useMemo<FlowEdge[]>(
    () => [
      { id: 'e-start-1', source: 'start', target: 'step-1', animated: true },
    ],
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const { trigger: updatePrompt, isMutating } = useMutation({
    mutation: updatePromptMutation,
  });

  const promptList = usePromptList(open);

  const applyPrompt = useCallback(
    (name: string) => {
      const prompt = promptList.find(p => p.name === name);
      if (!prompt) {
        setPromptName(name);
        return;
      }
      setPromptName(prompt.name);
      const firstMsg = prompt.messages?.[0];
      if (firstMsg?.content) {
        setDescription(firstMsg.content);
      }
      const params = (firstMsg?.params || {}) as any;
      const graph = params?.graph as {
        nodes?: FlowNode[];
        edges?: FlowEdge[];
      };
      if (graph?.nodes?.length) {
        setNodes(graph.nodes as FlowNode[]);
      }
      if (graph?.edges?.length) {
        setEdges(graph.edges as FlowEdge[]);
      }
    },
    [promptList, setEdges, setNodes]
  );

  useEffect(() => {
    if (open) return;
    setSavingError(null);
    setNodes(initialNodes);
    setEdges(initialEdges);
    setNodeIndex(2);
  }, [initialEdges, initialNodes, open, setEdges, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges(eds =>
        addEdge(
          {
            ...connection,
            animated: true,
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const addStep = useCallback(() => {
    const newId = `step-${nodeIndex}`;
    const lastId = nodes.length ? nodes[nodes.length - 1].id : 'start';
    const newNode: FlowNode = {
      id: newId,
      position: { x: 80 * nodeIndex, y: 140 + 50 * nodeIndex },
      data: { label: buildStepLabel(nodeIndex) },
    };
    setNodeIndex(prev => prev + 1);
    setNodes(nds => [...nds, newNode]);
    setEdges(eds => [
      ...eds,
      {
        id: `e-${lastId}-${newId}`,
        source: lastId,
        target: newId,
        animated: true,
      } as FlowEdge,
    ]);
  }, [buildStepLabel, nodeIndex, nodes, setEdges, setNodes]);

  const onSave = useCallback(async () => {
    const trimmedName = promptName.trim();
    if (!trimmedName) {
      setSavingError(t['com.affine.ai.builder.workflow.error.promptName']());
      return;
    }
    if (!nodes.length) {
      setSavingError(t['com.affine.ai.builder.workflow.error.nodeRequired']());
      return;
    }
    setSavingError(null);

    const serializedNodes = nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    }));
    const serializedEdges = edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: edge.animated,
      label: edge.data?.label ?? edge.label,
    }));

    const messages: CopilotPromptMessageInput[] = [
      {
        role: CopilotPromptMessageRole.system,
        content: description || 'Workflow definition',
        params: {
          type: 'workflow',
          graph: JSON.stringify({
            nodes: serializedNodes,
            edges: serializedEdges,
          }),
        } as Record<string, string>,
      },
    ];

    try {
      await (updatePrompt as any)({
        name: trimmedName,
        messages,
      });
      onClose();
    } catch (error: any) {
      console.error(error);
      setSavingError(
        error?.message ?? t['com.affine.ai.builder.workflow.error.saveFailed']()
      );
    }
  }, [description, edges, nodes, promptName, updatePrompt, onClose, t]);

  if (!open) return null;

  return (
    <BuilderModal
      title={t['com.affine.ai.builder.workflow.title']()}
      onClose={onClose}
      footer={
        <>
          {savingError ? (
            <div className={styles.errorText}>{savingError}</div>
          ) : null}
          <Button variant="plain" onClick={onClose}>
            {t['com.affine.ai.builder.common.cancel']()}
          </Button>
          <Button onClick={() => void onSave()} loading={isMutating}>
            {t['com.affine.ai.builder.common.savePrompt']()}
          </Button>
        </>
      }
    >
      <div className={styles.contentWithSidebar}>
        <PromptSidebar
          prompts={promptList}
          selected={promptName}
          onSelect={applyPrompt}
          labels={{
            title: t['com.affine.ai.builder.sidebar.title'](),
            empty: t['com.affine.ai.builder.sidebar.empty'](),
            noDesc: t['com.affine.ai.builder.sidebar.noDesc'](),
          }}
        />
        <div className={styles.contentMain}>
          <div className={styles.section}>
            <div className={styles.row}>
              <div className={styles.half}>
                <div className={styles.fieldRow}>
                  <label className={styles.label}>
                    {t['com.affine.ai.builder.common.promptName']()}
                  </label>
                  <input
                    className={styles.input}
                    value={promptName}
                    onChange={e => setPromptName(e.target.value)}
                    placeholder={t[
                      'com.affine.ai.builder.workflow.promptName.placeholder'
                    ]()}
                  />
                  <div className={styles.helper}>
                    {t['com.affine.ai.builder.workflow.promptName.helper']()}
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.half}>
                <div className={styles.fieldRow}>
                  <label className={styles.label}>
                    {t['com.affine.ai.builder.workflow.description.label']()}
                  </label>
                  <input
                    className={styles.input}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t[
                      'com.affine.ai.builder.workflow.description.placeholder'
                    ]()}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {t['com.affine.ai.builder.workflow.graph.title']()}
            </div>
            <div className={styles.toolbar}>
              <Button prefix={<PlusIcon />} onClick={addStep}>
                {t['com.affine.ai.builder.workflow.graph.addStep']()}
              </Button>
            </div>
            <div className={styles.flowCanvas}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
              >
                <MiniMap />
                <Controls />
                <Background gap={16} />
              </ReactFlow>
            </div>
          </div>
        </div>
      </div>
    </BuilderModal>
  );
};
