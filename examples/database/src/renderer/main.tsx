import { createRoot } from 'react-dom/client';
import { UIProvider } from '@adecore/ui';
import { App } from './App.tsx';
import { i18n } from './i18n.ts';
import { followSystemTheme } from './theme.ts';
import './styles.css';

followSystemTheme();

createRoot(document.getElementById('root')!).render(
    <UIProvider i18n={i18n}>
        <App />
    </UIProvider>
);
