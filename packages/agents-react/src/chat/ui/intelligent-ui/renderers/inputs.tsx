import type { UiProps } from '@adecore/intelligent-ui';
import { Button, Checkbox, Input, Segmented, Select, Slider, Switch, TextArea, Tooltip } from '@adecore/ui';
import { formatNumber, formatRounded } from '@adecore/ui/format';
import clsx from 'clsx';
import { createContext, useContext, useId, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { uiChildrenOf, uiNodeLabel, uiOwnLabel, uiWithUnit } from '../node-text';
import type { UiRendererProps } from '../render-context';
import { useTruncated } from '../use-truncated';
import { bindingOf, PENDING } from './binding';

type Scalar = UiProps<'Item'>['value'];

interface ChecklistState {
    values: readonly Scalar[];
    enabled: boolean;
    toggle(value: Scalar): void;
}

const ChecklistContext = createContext<ChecklistState>({ values: [], enabled: false, toggle: () => undefined });

function ChecklistGroup({ pending, children }: { pending: boolean; children: ReactNode }) {
    const { t } = useTranslation('agent-chat');

    return (
        <div role="group" aria-label={t('blocks.checklist')} className={clsx('chat-ui-nodes flex flex-col gap-1.5', pending && PENDING)}>
            {children}
        </div>
    );
}

export function ChecklistRenderer({ node, children, context }: UiRendererProps<UiProps<'Checklist'>>) {
    const binding = bindingOf(node, context);
    const values = binding?.value ?? node.props.value;

    const toggle = (value: Scalar): void => {
        binding?.onValueChange(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);
    };

    return (
        <ChecklistContext value={{ values, enabled: binding !== null, toggle }}>
            <ChecklistGroup pending={!node.complete}>{children}</ChecklistGroup>
        </ChecklistContext>
    );
}

/* The whole tile is the label, ringed in the accent while checked; a link inside it keeps its own click and checks nothing. */
export function ItemRenderer({ node, children }: UiRendererProps<UiProps<'Item'>>) {
    const list = useContext(ChecklistContext);
    const { value, detail } = node.props;
    const checked = list.values.includes(value);

    const toggleRow = (event: MouseEvent<HTMLDivElement>): void => {
        if (list.enabled && !(event.target as Element).closest('button, a')) {
            list.toggle(value);
        }
    };

    return (
        <div
            className={clsx(
                'flex min-h-10 items-start gap-3 rounded-xl bg-ui-tile px-3 py-2.5 text-xs text-text',
                checked && 'ring-2 ring-accent ring-inset',
                list.enabled && 'hover:bg-surface-active'
            )}
            onClick={toggleRow}
        >
            <Checkbox className="mt-0.5" checked={checked} onCheckedChange={() => list.toggle(value)} label={uiNodeLabel(node)} disabled={!list.enabled} />
            <div className="flex min-w-0 grow flex-col gap-0.5">
                <div className="min-w-0">{children}</div>
                {detail !== undefined && detail !== '' && <div className="text-2xs wrap-break-word text-text-muted">{detail}</div>}
            </div>
        </div>
    );
}

export function SwitchRenderer({ node, children, context }: UiRendererProps<UiProps<'Switch'>>) {
    const binding = bindingOf(node, context);

    return (
        <div
            className={clsx('chat-ui-flat flex min-h-11 items-center justify-between gap-3 rounded-xl bg-ui-tile px-3 py-2 text-xs', !node.complete && PENDING)}
        >
            <span className="min-w-0 font-medium text-text">{children}</span>
            <Switch
                checked={binding?.value ?? node.props.value}
                onCheckedChange={(next) => binding?.onValueChange(next)}
                label={uiNodeLabel(node)}
                disabled={binding === null}
            />
        </div>
    );
}

/* Its children are the label, read as text: the slider writes its own label line. */
export function SliderRenderer({ node, context }: UiRendererProps<UiProps<'Slider'>>) {
    const binding = bindingOf(node, context);
    const { value, min, max, step, unit } = node.props;

    return (
        <Slider
            value={binding?.value ?? value}
            onValueChange={(next) => binding?.onValueChange(next)}
            min={min}
            max={max}
            step={step}
            // The slider prints its unit right after the number, so the space a unit stands apart with comes from here.
            unit={uiWithUnit('', unit)}
            label={uiNodeLabel(node)}
            disabled={binding === null}
            className={clsx('chat-ui-flat rounded-xl bg-ui-tile p-3', !node.complete && PENDING)}
        />
    );
}

/* A label longer than this reads as a sentence, which wraps badly beside another; the options then stand in a column. */
const SIDE_BY_SIDE_LABEL = 24;

/* Left aligned, never the full width, under its label where it has one. Each Option is a segment by its place, since a value may be any scalar. */
export function SegmentedRenderer({ node, context }: UiRendererProps<UiProps<'Segmented'>>) {
    const { t } = useTranslation('agent-chat');
    const binding = bindingOf(node, context);
    const current = binding?.value ?? node.props.value;
    const options = uiChildrenOf(node, 'Option').map((option, index) => ({ id: String(index), label: uiNodeLabel(option), value: option.props.value }));
    const picked = options.find((option) => option.value === current)?.id ?? '';
    const { label } = node.props;
    const named = label !== undefined && label !== '';

    return (
        <div className={clsx('flex flex-col items-start gap-1.5', !node.complete && PENDING)}>
            {named && <span className="px-0.5 text-2xs text-text-muted">{label}</span>}
            <Segmented
                value={picked}
                options={options}
                label={named ? label : t('blocks.options')}
                orientation={options.some((option) => option.label.length > SIDE_BY_SIDE_LABEL) ? 'vertical' : 'horizontal'}
                disabled={binding === null}
                onValueChange={(id) => {
                    const option = options[Number(id)];

                    if (option !== undefined) {
                        binding?.onValueChange(option.value);
                    }
                }}
            />
        </div>
    );
}

/* The longest a text field takes when its agent names none; the schema allows up to 1024. */
const DEFAULT_MAX_LENGTH = 256;

/* The count under a field appears once the field is this full, and never nags before. */
const COUNT_FROM = 0.8;

/*
 * A line of text, or with `multiline` a few lines that grow with what is typed: the label above the field,
 * which stops taking characters at its limit. Nothing here binds a key or submits on Enter, so the value
 * reaches the agent only through a Choice.
 */
export function TextFieldRenderer({ node, children, context }: UiRendererProps<UiProps<'TextField'>>) {
    const { t } = useTranslation('agent-chat');
    const id = useId();
    const binding = bindingOf(node, context);
    const { maxLength = DEFAULT_MAX_LENGTH, placeholder, multiline } = node.props;
    const value = binding?.value ?? node.props.value;
    const countId = `${id}-count`;
    const counting = value.length >= maxLength * COUNT_FROM;

    return (
        <div className={clsx('flex flex-col gap-1.5', !node.complete && PENDING)}>
            <label htmlFor={id} className="px-0.5 text-2xs text-text-muted">
                {children}
            </label>
            {multiline === true ? (
                <TextArea
                    id={id}
                    value={value}
                    size="sm"
                    rows={2}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    disabled={binding === null}
                    aria-describedby={counting ? countId : undefined}
                    className="max-h-40 field-sizing-content border-transparent bg-ui-tile"
                    onChange={(event) => binding?.onValueChange(event.target.value)}
                />
            ) : (
                <Input
                    id={id}
                    value={value}
                    size="sm"
                    maxLength={maxLength}
                    placeholder={placeholder}
                    disabled={binding === null}
                    aria-describedby={counting ? countId : undefined}
                    className="border-transparent bg-ui-tile"
                    onChange={(event) => binding?.onValueChange(event.target.value)}
                />
            )}
            {counting && (
                <span id={countId} className="text-xs text-text-muted tabular-nums">
                    {t('blocks.textField.count', { used: formatNumber(value.length), max: formatNumber(maxLength) })}
                </span>
            )}
        </div>
    );
}

/* What a person typed as a number, or null for text that is none or lies outside the field's range. */
function typedNumber(text: string, min: number | undefined, max: number | undefined): number | null {
    const value = text.trim() === '' ? Number.NaN : Number(text);

    return Number.isFinite(value) && (min === undefined || value >= min) && (max === undefined || value <= max) ? value : null;
}

/*
 * A number a person types: the label above the field, the unit inside it at the end. What is typed stays in
 * the field while it has the focus, and reaches the local state only as a number inside the range, so a
 * half-typed or refused value never leaves the block. Leaving the field puts the last good number back.
 */
export function NumberFieldRenderer({ node, children, context }: UiRendererProps<UiProps<'NumberField'>>) {
    const { t } = useTranslation('agent-chat');
    const id = useId();
    const binding = bindingOf(node, context);
    const { min, max, step, unit } = node.props;
    const value = binding?.value ?? node.props.value;
    const [typed, setTyped] = useState<string | null>(null);
    const refused = typed !== null && typedNumber(typed, min, max) === null;
    const hintId = `${id}-hint`;

    const range =
        min !== undefined && max !== undefined
            ? t('blocks.numberField.between', { min: formatRounded(min, 6), max: formatRounded(max, 6) })
            : min !== undefined
              ? t('blocks.numberField.atLeast', { min: formatRounded(min, 6) })
              : max !== undefined
                ? t('blocks.numberField.atMost', { max: formatRounded(max, 6) })
                : t('blocks.numberField.number');

    return (
        <div className={clsx('flex flex-col gap-1.5', !node.complete && PENDING)}>
            <label htmlFor={id} className="px-0.5 text-2xs text-text-muted">
                {children}
            </label>
            <Input
                id={id}
                type="number"
                inputMode="decimal"
                value={typed ?? String(value)}
                size="sm"
                min={min}
                max={max}
                step={step ?? 'any'}
                disabled={binding === null}
                aria-invalid={refused || undefined}
                aria-describedby={refused ? hintId : undefined}
                className="border-transparent bg-ui-tile"
                end={unit !== undefined && unit !== '' ? <span className="pr-1.5 text-2xs text-text-muted">{unit}</span> : undefined}
                onChange={(event) => {
                    const text = event.target.value;
                    const number = typedNumber(text, min, max);
                    setTyped(text);

                    if (number !== null) {
                        binding?.onValueChange(number);
                    }
                }}
                onBlur={() => setTyped(null)}
            />
            {refused && (
                <span id={hintId} role="status" className="text-2xs text-status-error">
                    {range}
                </span>
            )}
        </div>
    );
}

/*
 * Left aligned, never the full width. Like Segmented, each Option is an item by its place, since a value may be any scalar.
 * The text beside its options is its label, drawn above it and read as its name.
 */
export function SelectRenderer({ node, context }: UiRendererProps<UiProps<'Select'>>) {
    const { t } = useTranslation('agent-chat');
    const binding = bindingOf(node, context);
    const current = binding?.value ?? node.props.value;
    const options = uiChildrenOf(node, 'Option').map((option, index) => ({ id: String(index), label: uiNodeLabel(option), value: option.props.value }));
    const label = uiOwnLabel(node);

    return (
        <div className={clsx('flex flex-col items-start gap-1.5', !node.complete && PENDING)}>
            {label !== '' && <span className="px-0.5 text-2xs text-text-muted">{label}</span>}
            <Select
                value={options.find((option) => option.value === current)?.id ?? null}
                items={options.map((option) => ({ value: option.id, label: option.label }))}
                label={label === '' ? t('blocks.options') : label}
                disabled={binding === null || options.length === 0}
                onValueChange={(id) => {
                    const option = options[Number(id)];

                    if (option !== undefined) {
                        binding?.onValueChange(option.value);
                    }
                }}
            />
        </div>
    );
}

/* Runs its local action once its own node closed; like an input, it closes once the block is answered. A label cut to the button's one line reads whole in its tooltip. */
export function ButtonRenderer({ node, children, context }: UiRendererProps<UiProps<'Button'>>) {
    const enabled = node.onAction !== undefined && node.complete && context.answer === null && node.props.disabled !== true;
    const label = uiNodeLabel(node);
    const [measure, truncated] = useTruncated<HTMLSpanElement>();

    return (
        <div className={clsx(!node.complete && PENDING)}>
            <Tooltip label={label} disabled={!truncated}>
                <Button variant="secondary" size="sm" className="max-w-full" disabled={!enabled} onClick={() => node.onAction?.()}>
                    <span ref={measure} className="min-w-0 truncate">
                        {children}
                    </span>
                </Button>
            </Tooltip>
        </div>
    );
}
