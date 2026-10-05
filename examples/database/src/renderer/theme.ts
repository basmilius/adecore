/* The theme reads light or dark from `data-theme` on <html>; this keeps it on the system's choice. */
export const followSystemTheme = (): void => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => {
        document.documentElement.dataset.theme = query.matches ? 'dark' : 'light';
    };

    apply();
    query.addEventListener('change', apply);
};
