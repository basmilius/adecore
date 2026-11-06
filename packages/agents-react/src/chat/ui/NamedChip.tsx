import type { AgentKind } from '@adecore/agent-contracts';
import { CliMark } from '../../agents/AgentModelLabel';
import { namedChipPrefix, type NamedChipKind } from '../mentions';
import { REFERENCE_TONE, TOKEN_ICON_BOX } from './chips';
import { useNamedChipLookup } from './named-chip-look';
import { TokenChip } from './ReferenceChip';

/*
 * A model or an account a message names, under its CLI's mark in the color of the account it runs on, and
 * the name the machine knows it by. An id the machine does not know keeps the id. A copy reads the token.
 */
export function NamedChip({ kind, value }: { kind: NamedChipKind; value: string }) {
    const lookup = useNamedChipLookup();
    const slash = value.indexOf('/');
    const cli = value.slice(0, slash);
    const id = value.slice(slash + 1);
    const { label, color } = lookup(kind, cli, id);

    return (
        <TokenChip
            kind={kind}
            value={value}
            sigil={namedChipPrefix(kind, cli)}
            icon={
                <span className={TOKEN_ICON_BOX} style={color === undefined ? undefined : { color }}>
                    <CliMark kind={cli as AgentKind} size={14} />
                </span>
            }
            label={label}
            spelled={label === id ? undefined : id}
            tone={REFERENCE_TONE}
        />
    );
}
