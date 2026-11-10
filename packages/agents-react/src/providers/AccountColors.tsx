import { AccentSwatches } from '@adecore/ui';
import { useChatHost } from '../host/host';

export function AccountColors({ value, label, onChange }: { value: string | undefined; label: string; onChange(id: string): void }) {
    const { all, featured, label: labelOf } = useChatHost().accents;

    return <AccentSwatches value={value} label={label} accents={all} featured={featured} labelOf={labelOf} onValueChange={onChange} />;
}
