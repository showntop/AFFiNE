import { SettingRow } from '@affine/component/setting-components';
import { Button } from '@affine/component/ui/button';
import { Input } from '@affine/component/ui/input';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from '@affine/component/ui/menu';
import { Switch } from '@affine/component/ui/switch';
import { ArrowDownSmallIcon } from '@blocksuite/icons/rc';
import { useCallback } from 'react';

export type ConfigInputProps = {
  field: string;
  desc: string;
  defaultValue: any;
  onChange: (field: string, value: any) => void;
  error?: string;
} & (
  | {
      type: 'String' | 'Number' | 'Boolean' | 'JSON';
    }
  | {
      type: 'Enum';
      options: string[];
    }
);

const Inputs: Record<
  ConfigInputProps['type'],
  React.ComponentType<{
    defaultValue: any;
    onChange: (value?: any) => void;
    options?: string[];
    error?: string;
  }>
> = {
  Boolean: function SwitchInput({ defaultValue, onChange }) {
    const handleSwitchChange = (checked: boolean) => {
      onChange(checked);
    };

    return <Switch checked={!!defaultValue} onChange={handleSwitchChange} />;
  },
  String: function StringInput({ defaultValue, onChange }) {
    const handleInputChange = (value: string) => {
      onChange(value);
    };

    return (
      <Input
        type="text"
        defaultValue={defaultValue}
        onChange={handleInputChange}
        style={{ width: '100%', maxWidth: '300px' }}
      />
    );
  },
  Number: function NumberInput({ defaultValue, onChange }) {
    const handleInputChange = (value: string) => {
      onChange(parseInt(value, 10));
    };

    return (
      <Input
        type="number"
        defaultValue={defaultValue}
        onChange={handleInputChange}
        style={{ width: '100%', maxWidth: '300px' }}
      />
    );
  },
  JSON: function ObjectInput({ defaultValue, onChange }) {
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      try {
        const value = JSON.parse(e.target.value);
        onChange(value);
      } catch {}
    };

    // Simple styled textarea
    return (
      <textarea
        defaultValue={
          typeof defaultValue === 'object'
            ? JSON.stringify(defaultValue, null, 2)
            : defaultValue
        }
        onChange={handleInputChange}
        style={{
          width: '100%',
          minHeight: '100px',
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid var(--affine-border-color)',
          background: 'var(--affine-background-primary-color)',
          color: 'var(--affine-text-primary-color)',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      />
    );
  },
  Enum: function EnumInput({ defaultValue, onChange, options }) {
    return (
      <Menu
        items={
          options?.map(option => (
            <MenuItem key={option} onSelect={() => onChange(option)}>
              {option}
            </MenuItem>
          )) ?? []
        }
        contentOptions={{
          align: 'end',
        }}
      >
        <MenuTrigger asChild>
          <Button
            variant="plain"
            style={{
              border: '1px solid var(--affine-border-color)',
              padding: '0 12px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {defaultValue || 'Select...'}
            <ArrowDownSmallIcon />
          </Button>
        </MenuTrigger>
      </Menu>
    );
  },
};

export const ConfigRow = ({
  field,
  desc,
  type,
  defaultValue,
  onChange,
  error,
  ...props
}: ConfigInputProps) => {
  const InputComponent = Inputs[type] ?? Inputs.JSON;

  const onValueChange = useCallback(
    (value?: any) => {
      onChange(field, value);
    },
    [field, onChange]
  );

  return (
    <SettingRow
      name=""
      desc={<span dangerouslySetInnerHTML={{ __html: desc }} />}
      style={{
        alignItems: type === 'JSON' ? 'flex-start' : 'center',
        flexDirection: type === 'JSON' ? 'column' : 'row',
        gap: type === 'JSON' ? '12px' : '0',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: type === 'JSON' ? '100%' : 'auto',
          alignItems: 'flex-end',
        }}
      >
        <InputComponent
          defaultValue={defaultValue}
          onChange={onValueChange}
          error={error}
          {...props}
        />
        {error && <div className="text-sm text-red-500 mt-1">{error}</div>}
      </div>
    </SettingRow>
  );
};
