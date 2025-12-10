import { Button } from '@affine/component/ui/button';
import { Menu, MenuItem, MenuTrigger } from '@affine/component/ui/menu';
import { useI18n } from '@affine/i18n';
import { ArrowDownSmallIcon } from '@blocksuite/icons/rc';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AppConfig } from './config';

interface ProviderSelectorProps {
  appConfig: AppConfig;
  patchedAppConfig: AppConfig;
  update: (field: string, value: any) => void;
}

export const ProviderSelector = ({
  appConfig,
  patchedAppConfig,
  update,
}: ProviderSelectorProps) => {
  const t = useI18n();
  const copilotConfig = patchedAppConfig?.copilot || appConfig?.copilot;
  const providersConfig = copilotConfig?.providers || {};

  const providerEntries = useMemo(
    () =>
      Object.keys(providersConfig).map(key => ({
        key,
        label: key,
        link:
          typeof providersConfig[key]?.link === 'string'
            ? providersConfig[key].link
            : undefined,
      })),
    [providersConfig]
  );

  // 找出当前已配置的 provider
  const configuredProviders = useMemo(() => {
    return providerEntries.filter(({ key }) => {
      const config = providersConfig[key];
      return config && Object.keys(config).length > 0;
    });
  }, [providerEntries, providersConfig]);

  const [selectedProvider, setSelectedProvider] = useState<string>(
    configuredProviders[0]?.key || providerEntries[0]?.key || ''
  );

  useEffect(() => {
    if (
      providerEntries.length > 0 &&
      !providerEntries.some(provider => provider.key === selectedProvider)
    ) {
      setSelectedProvider(providerEntries[0].key);
    }
  }, [providerEntries, selectedProvider]);

  const [jsonError, setJsonError] = useState<string>('');

  const currentProviderConfig = selectedProvider
    ? providersConfig[selectedProvider]
    : undefined;
  const currentProvider = providerEntries.find(p => p.key === selectedProvider);
  const currentProviderLabel =
    currentProvider?.label || selectedProvider || '请选择';

  const handleProviderChange = useCallback((providerKey: string) => {
    setSelectedProvider(providerKey);
    setJsonError('');
  }, []);

  const handleConfigChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!selectedProvider) {
        setJsonError('请先选择要配置的 Provider');
        return;
      }
      const value = e.target.value;
      try {
        if (value.trim() === '') {
          // 允许清空配置
          update(`copilot/providers.${selectedProvider}`, {});
          setJsonError('');
          return;
        }
        const parsed = JSON.parse(value);
        update(`copilot/providers.${selectedProvider}`, parsed);
        setJsonError('');
      } catch (err) {
        // @ts-ignore
        const errorMsg = t[
          'com.affine.adminSettings.copilot.providerSelector.jsonError'
        ]
          ? // @ts-ignore
            t['com.affine.adminSettings.copilot.providerSelector.jsonError']({
              error: (err as Error).message,
            })
          : 'JSON 格式错误：' + (err as Error).message;
        setJsonError(errorMsg);
      }
    },
    [selectedProvider, update, t]
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        borderRadius: '12px',
        background: 'var(--affine-background-secondary-color)',
        border: '1px solid var(--affine-border-color)',
      }}
    >
      {/* Provider 选择器 */}
      <div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--affine-text-primary-color)',
            marginBottom: '8px',
          }}
        >
          {/* @ts-ignore */}
          {t['com.affine.adminSettings.copilot.providerSelector.title']
            ? // @ts-ignore
              t['com.affine.adminSettings.copilot.providerSelector.title']()
            : 'AI Provider 配置'}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--affine-text-secondary-color)',
            marginBottom: '12px',
          }}
        >
          {/* @ts-ignore */}
          {t['com.affine.adminSettings.copilot.providerSelector.description']
            ? // @ts-ignore
              t[
                'com.affine.adminSettings.copilot.providerSelector.description'
              ]()
            : '选择要配置的 AI 服务提供商，然后在下方编辑其配置'}
        </div>
        <Menu
          items={providerEntries.map(provider => (
            <MenuItem
              key={provider.key}
              onSelect={() => handleProviderChange(provider.key)}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>{provider.label}</span>
                {provider.link && (
                  <span style={{ fontSize: '11px', opacity: 0.6 }}>
                    {provider.link}
                  </span>
                )}
              </div>
            </MenuItem>
          ))}
          contentOptions={{
            align: 'start',
          }}
        >
          {/* @ts-expect-error asChild works at runtime though not in types */}
          <MenuTrigger asChild style={{ width: '100%' }}>
            <Button
              variant="plain"
              style={{
                border: '1px solid var(--affine-border-color)',
                padding: '0 16px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                minWidth: '240px',
                justifyContent: 'space-between',
                background: 'var(--affine-background-primary-color)',
                color: 'var(--affine-text-primary-color)',
              }}
            >
              <span style={{ fontWeight: 500 }}>
                {currentProviderLabel || '请选择'}
              </span>
              <ArrowDownSmallIcon />
            </Button>
          </MenuTrigger>
        </Menu>
      </div>

      {/* 配置编辑器 */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--affine-text-primary-color)',
            }}
          >
            {(t as any)[
              'com.affine.adminSettings.copilot.providerSelector.configLabel'
            ]?.({ provider: currentProviderLabel }) ??
              `${currentProviderLabel} 配置 (JSON)`}
          </div>
          {currentProvider?.link && (
            <a
              href={currentProvider.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12px',
                color: 'var(--affine-link-color)',
                textDecoration: 'none',
              }}
            >
              {/* @ts-ignore */}
              {t['com.affine.adminSettings.copilot.providerSelector.viewDocs']
                ? // @ts-ignore
                  t[
                    'com.affine.adminSettings.copilot.providerSelector.viewDocs'
                  ]()
                : '查看文档'}{' '}
              →
            </a>
          )}
        </div>
        <textarea
          value={
            currentProviderConfig
              ? JSON.stringify(currentProviderConfig, null, 2)
              : ''
          }
          onChange={handleConfigChange}
          placeholder={
            (t as any)[
              'com.affine.adminSettings.copilot.providerSelector.placeholder'
            ]?.({ provider: currentProviderLabel }) ??
            `请输入 ${currentProviderLabel} 的配置 (JSON 格式)\n\n例如：\n{\n  "apiKey": "your-api-key",\n  "baseURL": "https://api.example.com"\n}`
          }
          style={{
            width: '100%',
            minHeight: '240px',
            padding: '12px',
            borderRadius: '8px',
            border: jsonError
              ? '1px solid var(--affine-error-color)'
              : '1px solid var(--affine-border-color)',
            background: 'var(--affine-background-primary-color)',
            color: 'var(--affine-text-primary-color)',
            fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
            fontSize: '12px',
            lineHeight: '1.6',
            resize: 'vertical',
            outline: 'none',
          }}
        />
        {jsonError && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'var(--affine-background-error-color)',
              color: 'var(--affine-error-color)',
              fontSize: '12px',
            }}
          >
            {jsonError}
          </div>
        )}
        <div
          style={{
            marginTop: '8px',
            fontSize: '11px',
            color: 'var(--affine-text-secondary-color)',
          }}
        >
          {/* @ts-ignore */}
          {t['com.affine.adminSettings.copilot.providerSelector.configPath']
            ? // @ts-ignore
              t[
                'com.affine.adminSettings.copilot.providerSelector.configPath'
              ]()
            : '配置路径'}
          ：
          <code
            style={{
              padding: '2px 6px',
              marginLeft: '4px',
              background: 'var(--affine-background-tertiary-color)',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}
          >
            copilot.providers.{selectedProvider || '<provider>'}
          </code>
        </div>
      </div>

      {/* 已配置的 providers 显示 */}
      {configuredProviders.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--affine-text-secondary-color)',
              marginBottom: '8px',
            }}
          >
            {(t as any)[
              'com.affine.adminSettings.copilot.providerSelector.configured'
            ]?.({ count: configuredProviders.length }) ??
              `已配置的 Providers (${configuredProviders.length})`}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {configuredProviders.map(provider => (
              <button
                key={provider.key}
                onClick={() => handleProviderChange(provider.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '16px',
                  background:
                    provider.key === selectedProvider
                      ? 'var(--affine-primary-color)'
                      : 'var(--affine-background-primary-color)',
                  color:
                    provider.key === selectedProvider
                      ? 'white'
                      : 'var(--affine-text-primary-color)',
                  fontSize: '12px',
                  fontWeight: 500,
                  border:
                    provider.key === selectedProvider
                      ? 'none'
                      : '1px solid var(--affine-border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {provider.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
