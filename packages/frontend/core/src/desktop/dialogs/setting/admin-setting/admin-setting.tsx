import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import { Button } from '@affine/component/ui/button';
import { useI18n } from '@affine/i18n';
import { get, upperFirst } from 'lodash-es';
import { useCallback } from 'react';

import { ALL_CONFIG_DESCRIPTORS, ALL_SETTING_GROUPS } from './config';
import { type ConfigInputProps, ConfigRow } from './config-input-row';
import { useAppConfig } from './use-app-config';

interface AdminSettingProps {
  groupKey: string;
}

export const AdminSetting = ({ groupKey }: AdminSettingProps) => {
  const { appConfig, update, save, patchedAppConfig, updates } = useAppConfig();
  const disableSave = Object.keys(updates).length === 0;
  const t = useI18n();

  const saveChanges = useCallback(() => {
    if (disableSave) {
      return;
    }
    save();
  }, [save, disableSave]);

  const group = ALL_SETTING_GROUPS.find(group => group.module === groupKey);

  if (!group) {
    return <div>Group not found: {groupKey}</div>;
  }

  // Show loading state if config is not yet loaded
  if (!appConfig || !patchedAppConfig) {
    return <div className="p-4">Loading settings...</div>;
  }

  const { name, module, fields, operations } = group;

  // @ts-ignore
  const translatedName = t[name]
    ? t[name]()
    : name.startsWith('com.affine')
      ? upperFirst(module)
      : name;

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <SettingHeader
          title={translatedName}
          // @ts-ignore
          subtitle={t['com.affine.adminSettings.subtitle']({
            name: translatedName,
          })}
        />
        <Button variant="primary" onClick={saveChanges} disabled={disableSave}>
          Save Changes
        </Button>
      </div>

      <SettingWrapper>
        {fields.map(field => {
          let desc: string;
          let props: ConfigInputProps;
          if (typeof field === 'string') {
            const descriptor = ALL_CONFIG_DESCRIPTORS[module][field];
            desc = descriptor.desc;
            props = {
              field: `${module}/${field}`,
              desc,
              type: descriptor.type,
              options: [],
              defaultValue: get(patchedAppConfig[module], field),
              onChange: update,
            };
          } else {
            const descriptor = ALL_CONFIG_DESCRIPTORS[module][field.key];
            props = {
              field: `${module}/${field.key}${field.sub ? `/${field.sub}` : ''}`,
              desc: field.desc ?? descriptor.desc,
              type: field.type ?? descriptor.type,
              // @ts-expect-error for enum type
              options: field.options,
              defaultValue: get(
                patchedAppConfig[module],
                field.key + (field.sub ? '.' + field.sub : '')
              ),
              onChange: update,
            };
          }
          return <ConfigRow key={props.field} {...props} />;
        })}
        {operations?.map((Operation: any) => (
          <Operation key={Operation.name} appConfig={patchedAppConfig} />
        ))}
      </SettingWrapper>
    </>
  );
};
