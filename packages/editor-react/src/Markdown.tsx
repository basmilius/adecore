import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ScrollArea } from '@adecore/ui';

/* A code block wider than its card scrolls on its own. */
const CODE_BLOCKS: Components = {
    pre: ({ children }) => (
        <ScrollArea axis="both" render={<pre />}>
            {children}
        </ScrollArea>
    )
};

/* An image becomes its alt text, so a comment cannot make the editor fetch a page of its choosing. */
const WITHOUT_IMAGES: Components = {
    ...CODE_BLOCKS,
    img: ({ alt }) => <>{alt ?? ''}</>
};

export function Markdown({ text, images = true }: { text: string; images?: boolean }) {
    return (
        <div className="adecore-editor-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={images ? CODE_BLOCKS : WITHOUT_IMAGES}>
                {text}
            </ReactMarkdown>
        </div>
    );
}
