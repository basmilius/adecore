/* What the review of one editor does for the other editors that show the same file. */
export interface ReviewMember {
    /* Optimistically hides runs until the host answers. */
    hide(runIds: readonly string[]): void;
    /* Restores runs after a refused operation. */
    show(runIds: readonly string[]): void;
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
        this.each((member) => member.hide(runIds));
    }

    show(runIds: readonly string[]): void {
        this.each((member) => member.show(runIds));
    }

    refresh(): void {
        this.each((member) => member.refresh());
    }

    /* Over a copy, since a member may leave while it hears. */
    private each(action: (member: ReviewMember) => void): void {
        for (const member of [...this.members]) {
            action(member);
        }
    }
}

const groups = new Map<string, { group: ReviewGroup; holders: number }>();

/* The host supplies a shared file key; the group is released with its last editor. */
export function joinReviewGroup(key: string): { group: ReviewGroup; leave(): void } {
    const held = groups.get(key) ?? { group: new ReviewGroup(), holders: 0 };
    groups.set(key, held);
    held.holders++;
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
