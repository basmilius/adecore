import { useRef, useState, type Ref } from 'react';
import clsx from 'clsx';
import { Ban, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Icon, Menu } from '@adecore/ui';
import { CODE_TEXT } from '../code-text.ts';
import { joinMembers, membersOf, type EnumType } from './enum-type.ts';

export interface EnumPickerProps {
    type: EnumType;
    /* The column's value; `null` is NULL. A set is its members joined by commas. */
    value: string | null;
    nullable: boolean;
    /* The accessible name of the trigger. */
    label: string;
    /* Opens the menu as it mounts, for a cell that was just put into edit mode. */
    autoOpen?: boolean;
    disabled?: boolean;
    /* The value picked, or `undefined` when the menu closed with nothing changed. */
    onDone(result: { readonly value: string | null } | undefined): void;
    /* `cell` fills the box it sits in; `field` is a boxed field of a form. */
    look?: 'cell' | 'field';
    className?: string;
    ref?: Ref<HTMLButtonElement>;
}

const LOOK = {
    cell: `absolute inset-0 z-10 flex items-center gap-2 border border-accent bg-surface-raised px-3 ${CODE_TEXT} outline-0`,
    field: 'field field-sm flex w-full items-center gap-2 font-mono text-code data-disabled:opacity-50'
} as const;

/*
 * The editor of a MySQL ENUM or SET column: a menu of the values the type declares, plus NULL where
 * the column allows it. An enum picks one value and is done; a set toggles its members and is done
 * when the menu closes. It is a menu rather than a `Select` since a set takes several values and a
 * cell has to open it by itself as the edit starts.
 */
export function EnumPicker({ type, value, nullable, label, autoOpen = false, disabled = false, onDone, look = 'cell', className, ref }: EnumPickerProps) {
    const { t } = useTranslation('database');
    const set = type.kind === 'set';
    const membersOfValue = (): ReadonlySet<string> => new Set(set && value !== null ? membersOf(value) : []);
    const settled = useRef(false);
    const [members, setMembers] = useState(membersOfValue);

    const settle = (result: { readonly value: string | null } | undefined): void => {
        if (!settled.current) {
            settled.current = true;
            onDone(result);
        }
    };

    const handleOpenChange = (open: boolean): void => {
        if (open) {
            settled.current = false;
            setMembers(membersOfValue());
            return;
        }
        const joined = joinMembers(type, members);
        settle(set && joined !== value ? { value: joined } : undefined);
    };

    const toggle = (member: string, checked: boolean): void => {
        setMembers((now) => {
            const next = new Set(now);
            if (checked) {
                next.add(member);
            } else {
                next.delete(member);
            }
            return next;
        });
    };

    return (
        <Menu.Root defaultOpen={autoOpen} onOpenChange={handleOpenChange}>
            <Menu.Trigger ref={ref} disabled={disabled} aria-label={label} className={clsx(LOOK[look], className)}>
                <span className={clsx('min-w-0 flex-1 truncate text-left', value === null && 'text-text-faint')}>{value ?? 'NULL'}</span>
                <Icon icon={ChevronDown} size={14} className="shrink-0 text-text-faint" />
            </Menu.Trigger>
            <Menu.Popup className="max-h-80 overflow-auto">
                {nullable && (
                    <>
                        <Menu.Item onClick={() => settle({ value: null })}>
                            <Icon icon={Ban} size={14} />
                            {t('grid.setNull')}
                        </Menu.Item>
                        <Menu.Separator />
                    </>
                )}
                {set
                    ? type.values.map((member) => (
                          <Menu.CheckboxItem
                              key={member}
                              checked={members.has(member)}
                              closeOnClick={false}
                              onCheckedChange={(checked) => toggle(member, checked)}
                          >
                              {member === '' ? <span className="text-text-faint">{t('grid.emptyValue')}</span> : member}
                          </Menu.CheckboxItem>
                      ))
                    : type.values.map((option) => (
                          <Menu.Item key={option} onClick={() => settle({ value: option })}>
                              <Menu.Check kind="radio" checked={option === value} />
                              {option === '' ? <span className="text-text-faint">{t('grid.emptyValue')}</span> : option}
                          </Menu.Item>
                      ))}
            </Menu.Popup>
        </Menu.Root>
    );
}
