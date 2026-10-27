/** Converts HEIC and HEIF to a browser-readable PNG for display, preserving other formats and the source bytes. */
export async function imageForDisplay(blob: Blob): Promise<Blob> {
    if (!/^image\/(?:heic|heif)(?:-sequence)?$/i.test(blob.type)) {
        return blob;
    }

    // The CSP build decodes in a worker without requiring unsafe-eval on the host page.
    const { heicTo } = await import('heic-to/csp');

    return heicTo({ blob, type: 'image/png' });
}

/** Makes embedded HEIC/HEIF data URLs readable in a sandboxed HTML preview without changing the saved document. */
export async function imageDocumentForDisplay(html: string): Promise<string> {
    const sources = [...new Set(html.match(/data:image\/(?:heic|heif)(?:-sequence)?;base64,[A-Za-z0-9+/=]+/gi) ?? [])];
    let result = html;

    for (const source of sources) {
        try {
            const comma = source.indexOf(',');
            const mime = source.slice(5, source.indexOf(';')).toLowerCase();
            const bytes = Uint8Array.from(atob(source.slice(comma + 1)), (character) => character.charCodeAt(0));
            const blob = await imageForDisplay(new Blob([bytes], { type: mime }));
            const converted = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            });

            result = result.replaceAll(source, converted);
        } catch {
            // A broken picture must not prevent the rest of the document from opening.
        }
    }

    return result;
}
