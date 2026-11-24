import type { UiProps } from '@adecore/intelligent-ui';
import clsx from 'clsx';
import { useId, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { uiChildrenOf, uiNodeLabel } from '../node-text';
import type { UiRendererProps } from '../render-context';
import { bindingOf, PENDING } from './binding';

const NEXT_KEYS = new Set(['ArrowDown', 'ArrowRight']);
const PREVIOUS_KEYS = new Set(['ArrowUp', 'ArrowLeft']);

/*
 * One value out of a list whose options each take a line of explanation. Like Segmented, an Option is a
 * radio by its place, since a value may be any scalar. The group is one tab stop, and an arrow key moves
 * the focus and the choice together, as a radio group does.
 */
export function RadioRenderer({ node, context }: UiRendererProps<UiProps<'Radio'>>) {
    const { t } = useTranslation('agent-chat');
    const id = useId();
    const radios = useRef<(HTMLDivElement | null)[]>([]);
    const binding = bindingOf(node, context);
    const current = binding?.value ?? node.props.value;
    const { label } = node.props;
    const named = label !== undefined && label !== '';

    const options = uiChildrenOf(node, 'Option').map((option) => ({
        id: option.id,
        label: uiNodeLabel(option),
        detail: option.props.detail,
        value: option.props.value
    }));

    const picked = options.findIndex((option) => option.value === current);
    const enabled = binding !== null;

    const pick = (index: number): void => {
        const option = options[index];

        if (option !== undefined && enabled) {
            binding.onValueChange(option.value);
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number): void => {
        if (!enabled) {
            return;
        }

        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            pick(index);

            return;
        }

        const step = NEXT_KEYS.has(event.key) ? 1 : PREVIOUS_KEYS.has(event.key) ? -1 : 0;

        if (step === 0) {
            return;
        }

        event.preventDefault();
        const next = (index + step + options.length) % options.length;
        pick(next);
        radios.current[next]?.focus();
    };

    return (
        <div className={clsx('flex flex-col gap-1.5', !node.complete && PENDING)}>
            {named && (
                <span id={`${id}-label`} className="px-0.5 text-2xs text-text-muted">
                    {label}
                </span>
            )}
            <div
                role="radiogroup"
                aria-labelledby={named ? `${id}-label` : undefined}
                aria-label={named ? undefined : t('blocks.options')}
                aria-disabled={enabled ? undefined : true}
                className="flex flex-col gap-1.5"
            >
                {options.map((option, index) => {
                    const checked = index === picked;
                    const described = option.detail !== undefined && option.detail !== '';

                    return (
                        <div
                            key={option.id}
                            ref={(element) => {
                                radios.current[index] = element;
                            }}
                            role="radio"
                            aria-checked={checked}
                            aria-disabled={enabled ? undefined : true}
                            aria-labelledby={`${id}-${index}-label`}
                            aria-describedby={described ? `${id}-${index}-detail` : undefined}
                            // One tab stop for the group: the checked radio, or the first while nothing is checked.
                            tabIndex={checked || (picked === -1 && index === 0) ? 0 : -1}
                            className={clsx(
                                'focus-ring flex min-h-10 items-start gap-3 rounded-xl bg-ui-tile px-3 py-2.5 text-xs text-text',
                                checked && 'ring-2 ring-accent ring-inset',
                                enabled && 'cursor-pointer hover:bg-surface-active'
                            )}
                            onClick={() => pick(index)}
                            onKeyDown={(event) => onKeyDown(event, index)}
                        >
                            <span
                                aria-hidden
                                className={clsx(
                                    'mt-0.5 size-4 shrink-0 rounded-full',
                                    checked ? 'border-5 border-accent bg-accent-text' : 'border border-border-strong bg-ui-inset'
                                )}
                            />
                            <span className="flex min-w-0 grow flex-col gap-0.5">
                                <span id={`${id}-${index}-label`} className="font-medium wrap-break-word">
                                    {option.label}
                                </span>
                                {described && (
                                    <span id={`${id}-${index}-detail`} className="text-2xs wrap-break-word text-text-muted">
                                        {option.detail}
                                    </span>
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
