import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@adecore/ui';
import type { SchemaInfo } from '../protocol/index.ts';

export interface SchemaPickerProps {
    schemas: readonly SchemaInfo[];
    /* `null` while the statements run in whatever the session has selected. */
    value: string | null;
    onValueChange(schema: string): void;
    disabled?: boolean;
    className?: string;
    ref?: Ref<HTMLButtonElement>;
}

/* Picks the schema the console's statements run in. */
export function SchemaPicker({ schemas, value, onValueChange, disabled, className, ref }: SchemaPickerProps) {
    const { t } = useTranslation('database');
    return (
        <Select
            ref={ref}
            size="sm"
            label={t('console.schema')}
            placeholder={t('console.schemaPlaceholder')}
            value={value}
            disabled={disabled}
            className={className}
            items={schemas.map((schema) => ({ value: schema.name, label: schema.name }))}
            onValueChange={onValueChange}
        />
    );
}
