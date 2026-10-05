/* The theme a page is in, as it reports it to the shell. The page owns it; the shell paints the window with it. */
export interface ThemeState {
    resolved: 'light' | 'dark';
    /* True while the app follows the system, the one case in which a page inside it may follow the system too. */
    followsSystem: boolean;
    /* The page's ground, so the window paints it before the page does. */
    background: string;
}
