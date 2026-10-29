import { orderedAccountIds, type AgentKind, type ProviderAccountMap } from '@adecore/agent-contracts';
import { AccountError } from './launch.ts';

/* Why an account cannot take a start right now, in words that finish "is ...". */
export type AccountUnusable = 'turned off on this machine' | 'signed out' | 'at its usage limit' | 'not available on this machine';

export interface AccountChoiceInput {
    kind: AgentKind;
    accounts: ProviderAccountMap;
    /* The account the start named; undefined for none. */
    named: string | undefined;
    /* The account the place of the start prefers, such as a project's default. */
    preferred: string | undefined;
    /* The accounts the place of the start never offers. */
    off: readonly string[];
    /* Why an account cannot take a start right now, or null when it can. */
    unusable(id: string): AccountUnusable | null;
}

export interface ChosenAccount {
    account: string;
    /* The preferred account the start passed over, and why; absent when it took that one or none was preferred. */
    passedOver?: { account: string; reason: AccountUnusable };
}

/*
 * The account a start takes: a named one unless the place turned it off, which refuses the start; else
 * the preferred one while it is usable; else the first usable account in the person's order that the
 * place offers; else the CLI's default account, which the launch refuses as before when it cannot run.
 */
export function chooseAccount(input: AccountChoiceInput): ChosenAccount {
    const { kind, accounts, named, preferred, off } = input;

    if (named !== undefined) {
        if (off.includes(named)) {
            throw new AccountError('account-off-in-project', `The account '${named}' is turned off in this project.`);
        }

        return { account: named };
    }

    const offered = orderedAccountIds(accounts, kind).filter((id) => !off.includes(id));
    const known = preferred !== undefined && offered.includes(preferred) ? preferred : undefined;
    const reason = known === undefined ? null : input.unusable(known);

    if (known !== undefined && reason === null) {
        return { account: known };
    }

    const next = offered.find((id) => id !== known && input.unusable(id) === null) ?? kind;

    if (off.includes(next)) {
        throw new AccountError('account-off-in-project', 'No account this project offers can start right now.');
    }

    return known === undefined || reason === null ? { account: next } : { account: next, passedOver: { account: known, reason } };
}
