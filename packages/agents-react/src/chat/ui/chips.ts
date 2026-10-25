/* An `@file`, `$skill` or `#reference` token drawn as a pill: the tone says which it is, the shape
   says where it is drawn. */

export const MENTION_TONE = 'bg-accent-soft text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent)]';

/* A skill is the same token shape as a file mention, in its own hue. */
export const SKILL_TONE = 'bg-skill-soft text-skill shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--skill)_25%,transparent)]';

/* A `#` to a view, node or chat is neutral, so it never reads as a file or a skill. */
export const REFERENCE_TONE = 'bg-text/8 text-text shadow-[inset_0_0_0_1px_var(--border-strong)]';

/* A `#` whose view or node is no longer in the project. */
export const REFERENCE_GONE_TONE = 'bg-text/4 text-text-faint shadow-[inset_0_0_0_1px_var(--border)]';

/* The pill in the composer's editor, around the token's own characters: the editor places the caret
   from what it drew, so padding is safe, and a chip that wraps keeps it on every fragment. */
export const CHIP_IN_EDITOR = 'box-decoration-clone rounded-md px-1 py-0.5';

/* A picked or named token in a message or a reply, a shade smaller than the text around it. Inline like
   the editor's pill, so its name sits on the baseline of the sentence, and a selection copies it on the
   same line as the words around it, where a flex box would put it on lines of its own. */
export const TOKEN_IN_MESSAGE = 'box-decoration-clone rounded-md px-1.5 py-0.5 text-xs font-medium';

/* The mark in place of the sigil, a 14px icon. Inline, since the base styles make an svg a block of its
   own. Its middle goes on the middle of the name's capitals, where a mark reads as centered; the middle
   of the x-height `Icon` aligns on sits low next to a capital. */
export const TOKEN_ICON = 'mr-1 inline align-[calc(0.5cap-7px)]!';

/* The same middle for the 12px mark the composer draws, in a box whose bottom edge is its baseline. */
export const TOKEN_ICON_IN_EDITOR = 'mr-1 inline-block align-[calc(0.5cap-6px)]';

/* The same pill in the transcript: a real inline box a shade smaller than the text around it, with
   the icon in place of the sigil. */
export const CHIP_IN_MESSAGE = 'inline-flex h-5 max-w-full items-center gap-1 rounded-md px-1.5 align-[-3px] text-xs/none font-medium';
