import { useEffect, useRef } from 'react';
import { TerminalView, type TerminalViewHandle } from '@adecore/ui/terminal';

const PROMPT = '\x1b[32m~\x1b[0m $ ';

/* A pretend shell that echoes what is typed, since a demo has no program behind it. */
export default function TerminalViewDemo() {
    const view = useRef<TerminalViewHandle>(null);
    const line = useRef('');

    useEffect(() => {
        view.current?.write(`\x1b[1mbun test\x1b[0m\r\n\x1b[32m 236 pass\x1b[0m\r\n\x1b[2m 0 fail\x1b[0m\r\nDocs: https://adecore.dev\r\n\r\n${PROMPT}`);
    }, []);

    const type = (data: string): void => {
        for (const key of data) {
            if (key === '\r') {
                view.current?.write(`\r\n${line.current === '' ? '' : `${line.current}\r\n`}${PROMPT}`);
                line.current = '';
            } else if (key === '\x7f') {
                if (line.current !== '') {
                    line.current = line.current.slice(0, -1);
                    view.current?.write('\b \b');
                }
            } else if (key >= ' ') {
                line.current += key;
                view.current?.write(key);
            }
        }
    };

    return <TerminalView ref={view} label="Demo shell" onData={type} className="h-56 w-full max-w-xl rounded-lg" />;
}
