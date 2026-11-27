import type { AgentKind } from '@adecore/agent-contracts';
import { CliMark } from '../../agents/AgentModelLabel';
import { namedChipParts, namedChipPrefix, type NamedChipKind } from '../mentions';
import { REFERENCE_TONE, TOKEN_ICON_BOX } from './chips';
import { useNamedChipLookup } from './named-chip-look';
import { TokenChip } from './ReferenceChip';

/*
 * A model or an account a message names, under its CLI's mark in the color of the account it runs on, and
 * the name the machine knows it by, after its account's when it names one. An id the machine does not know
 * keeps the id. A copy reads the token.
 */
export function NamedChip({ kind, value }: { kind: NamedChipKind; value: string }) {
    const lookup = useNamedChipLookup();
    const { cli, id, account } = namedChipParts(value) ?? { cli: '', id: value, account: undefined };
    const look = lookup(kind, cli, id, account);

    return (
        <TokenChip
            kind={kind}
            value={value}
            sigil={namedChipPrefix(kind, cli, account)}
            icon={
                <span className={TOKEN_ICON_BOX} style={look.color === undefined ? undefined : { color: look.color }}>
                    <CliMark kind={cli as AgentKind} size={14} />
                </span>
            }
            label={look.label}
            prefix={look.account}
            spelled={look.label === id ? undefined : id}
            tone={REFERENCE_TONE}
        />
    );
}
