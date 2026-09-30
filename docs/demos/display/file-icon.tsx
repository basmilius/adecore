import { FileIcon } from '@basmilius/desktop-ui';

const FILES = ['src/index.ts', 'App.vue', 'package.json', 'README.md', 'styles.css', 'Dockerfile', 'main.go', 'logo.svg', '.gitignore', 'notes.txt'];

export default function FileIconDemo() {
    return (
        <ul className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm text-text">
            {FILES.map((path) => (
                <li key={path} className="flex items-center gap-2">
                    <FileIcon path={path} />
                    {path.slice(path.lastIndexOf('/') + 1)}
                </li>
            ))}
        </ul>
    );
}
