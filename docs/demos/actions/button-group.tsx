import { AlignCenter, AlignLeft, AlignRight, Redo, Undo } from 'lucide-react';
import { ButtonGroup, IconButton } from '@basmilius/react-ui';

export default function ButtonGroupDemo() {
    return (
        <div className="flex items-center gap-4">
            <ButtonGroup>
                <IconButton icon={Undo} label="Undo" />
                <IconButton icon={Redo} label="Redo" />
            </ButtonGroup>
            <ButtonGroup role="group" aria-label="Alignment">
                <IconButton icon={AlignLeft} label="Align left" active />
                <IconButton icon={AlignCenter} label="Align center" />
                <IconButton icon={AlignRight} label="Align right" />
            </ButtonGroup>
        </div>
    );
}
