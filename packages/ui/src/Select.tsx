import { Select as BaseSelect } from '@base-ui/react/select';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon.tsx';
import { MENU_LABEL } from './menu/parts.tsx';
import { renderPositioner } from './popup-layer.ts';
import { RowContent } from './select-row.tsx';
import { isGroup, rowClassName, triggerClassName, type SelectGroup, type SelectItem, type SelectProps } from './select-shared.ts';
import { SelectSearch } from './SelectSearch.tsx';
import { useOverlayScrollbars } from './useOverlayScrollbars.tsx';

export type { SelectGroup, SelectItem };

function Row<T extends string>({ item, picked }: { item: SelectItem<T>; picked: boolean }) {
    return (
        <BaseSelect.Item className={rowClassName(item)} value={item.value} label={item.label} disabled={item.disabled}>
            <RowContent item={item} picked={picked} text={<BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>} />
        </BaseSelect.Item>
    );
}

/* A long list can ask for a search field, which swaps in a combobox with the same trigger and rows. */
export function Select<T extends string>(props: SelectProps<T>) {
    const { searchable, items } = props;
    const count = items.length > 0 && isGroup(items[0]!) ? (items as SelectGroup<T>[]).reduce((sum, group) => sum + group.items.length, 0) : items.length;
    const search = searchable === true || (typeof searchable === 'number' && count >= searchable);

    return search ? <SelectSearch {...props} /> : <PlainSelect {...props} />;
}

function PlainSelect<T extends string>({
    value,
    onValueChange,
    items,
    label,
    placeholder,
    size = 'md',
    variant = 'outlined',
    disabled,
    align = 'start',
    truncateValue = true,
    className,
    ref
}: SelectProps<T>) {
    const { t } = useTranslation('ui');
    const groups = items.length > 0 && isGroup(items[0]!) ? (items as SelectGroup<T>[]) : null;
    const flat = groups ? groups.flatMap((group) => group.items) : (items as SelectItem<T>[]);
    const selected = flat.find((item) => item.value === value) ?? null;
    const [list, setList] = useState<HTMLDivElement | null>(null);
    const scrollbars = useOverlayScrollbars(list);

    return (
        <BaseSelect.Root
            items={flat.map((item) => ({ value: item.value, label: item.label }))}
            value={value}
            disabled={disabled}
            onValueChange={(next) => onValueChange(next as T)}
        >
            <BaseSelect.Trigger ref={ref} aria-label={label} className={triggerClassName(size, variant, className)}>
                {selected?.icon}
                <BaseSelect.Value className={clsx(truncateValue && 'truncate')}>{() => selected?.label ?? placeholder ?? t('action.select')}</BaseSelect.Value>
                <BaseSelect.Icon className="ml-auto flex shrink-0 pl-1">
                    <Icon icon={ChevronDown} size={14} />
                </BaseSelect.Icon>
            </BaseSelect.Trigger>
            <BaseSelect.Portal>
                <BaseSelect.Positioner
                    className="popup-positioner"
                    render={renderPositioner}
                    side="bottom"
                    align={align}
                    sideOffset={6}
                    alignItemWithTrigger={false}
                >
                    <BaseSelect.Popup className="menu-popup">
                        <BaseSelect.List ref={setList} className="max-h-80 overflow-auto">
                            {groups
                                ? groups.map((group) => (
                                      <BaseSelect.Group key={group.label}>
                                          <BaseSelect.GroupLabel className={MENU_LABEL}>{group.label}</BaseSelect.GroupLabel>
                                          {group.items.map((item) => (
                                              <Row key={item.value} item={item} picked={item.value === value} />
                                          ))}
                                      </BaseSelect.Group>
                                  ))
                                : flat.map((item) => <Row key={item.value} item={item} picked={item.value === value} />)}
                        </BaseSelect.List>
                    </BaseSelect.Popup>
                    {scrollbars}
                </BaseSelect.Positioner>
            </BaseSelect.Portal>
        </BaseSelect.Root>
    );
}
