/* What the review of one editor does for the other editors that show the same file. */
export interface ReviewMember {
    /* Optimistically hides runs until the host answers. */
    hide(runIds: readonly string[]): void;
    /* Restores runs after a refused operation. */
    show(runIds: readonly string[]): void;
    /* Refreshes runs after an operation. */
    refresh(): void;
}

/*
 * The editors of one file in this window. An answer in one of them is an answer for all: the rows of
 * the others go with it at once and every one of them reads the runs again, so no editor keeps a
 * change in front of a person that the other already took.
 */
export class ReviewGroup {
    private readonly members = new Set<ReviewMember>();

    join(member: ReviewMember): () => void {
        this.members.add(member);
        return () => {
            this.members.delete(member);
        };
    }

    hide(runIds: readonly string[]): void {
        for (const member of [...this.members]) {
            member.hide(runIds);
        }
    }

    show(runIds: readonly string[]): void {
        for (const member of [...this.members]) {
            member.show(runIds);
        }
    }

    refresh(): void {
        for (const member of [...this.members]) {
            member.refresh();
        }
    }
}

const groups = new Map<string, { group: ReviewGroup; holders: number }>();

/* The host supplies a shared file key; the group is released with its last editor. */
export function joinReviewGroup(key: string): { group: ReviewGroup; leave(): void } {
    let entry = groups.get(key);
    if (entry === undefined) {
        entry = { group: new ReviewGroup(), holders: 0 };
        groups.set(key, entry);
    }
    entry.holders++;
    const held = entry;
    let left = false;
    return {
        group: held.group,
        leave: () => {
            if (left) {
                return;
            }
            left = true;
            held.holders--;
            if (held.holders === 0 && groups.get(key) === held) {
                groups.delete(key);
            }
        }
    };
}
