/* The first letters of the first two words that start with a capital, so "Sanne de Vries" gives "SV". A name without one gives its first letter. */
export function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/u);
    const capitals = words.filter((word) => /^\p{Lu}/u.test(word)).slice(0, 2);

    if (capitals.length > 0) {
        return capitals.map((word) => Array.from(word)[0]).join('');
    }

    return (Array.from(words[0] ?? '')[0] ?? '').toLocaleUpperCase();
}
