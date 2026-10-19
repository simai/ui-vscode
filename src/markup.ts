/*
 * Recognises where the cursor is inside HTML-like markup (HTML, JSX, Vue
 * templates, template literals): typing a tag name, an attribute name or an
 * attribute value of an sf- custom element.
 */

export type MarkupRequest =
    | { kind: 'tag'; prefix: string }
    | { kind: 'attribute'; tag: string; prefix: string; present: string[] }
    | { kind: 'value'; tag: string; attribute: string; prefix: string };

const isSpace = (char: string): boolean => /\s/.test(char);

export function detectMarkupRequest(textBefore: string): MarkupRequest | undefined {
    const open = textBefore.lastIndexOf('<');
    if (open < 0) return undefined;
    const inside = textBefore.slice(open + 1);

    const typingTag = inside.match(/^([a-z][a-z0-9-]*)?$/i);
    if (typingTag) return { kind: 'tag', prefix: typingTag[1] ?? '' };

    const tag = inside.match(/^(sf-[a-z0-9-]+)(?=[\s/])/)?.[1];
    if (!tag) return undefined;

    const rest = inside.slice(tag.length);
    const present: string[] = [];
    let index = 0;
    const skipSpace = (): void => {
        while (index < rest.length && isSpace(rest[index])) index += 1;
    };

    while (index <= rest.length) {
        skipSpace();
        if (index >= rest.length) return { kind: 'attribute', tag, prefix: '', present };
        const char = rest[index];
        if (char === '>') return undefined;
        if (char === '/') {
            index += 1;
            continue;
        }

        const nameStart = index;
        while (index < rest.length && !/[\s"'>/=]/.test(rest[index])) index += 1;
        const name = rest.slice(nameStart, index);
        if (index >= rest.length) return { kind: 'attribute', tag, prefix: name, present };
        if (name === '') {
            // A stray quote or "=": step over it.
            index += 1;
            continue;
        }

        skipSpace();
        if (rest[index] !== '=') {
            present.push(name);
            continue;
        }
        index += 1;
        skipSpace();
        if (index >= rest.length) return { kind: 'value', tag, attribute: name, prefix: '' };

        const quote = rest[index];
        if (quote === '"' || quote === "'") {
            const close = rest.indexOf(quote, index + 1);
            if (close < 0) {
                return { kind: 'value', tag, attribute: name, prefix: rest.slice(index + 1) };
            }
            index = close + 1;
        } else if (quote === '{') {
            const close = rest.indexOf('}', index + 1);
            if (close < 0) return undefined;
            index = close + 1;
        } else {
            const valueStart = index;
            while (index < rest.length && !/[\s>]/.test(rest[index])) index += 1;
            if (index >= rest.length) {
                return { kind: 'value', tag, attribute: name, prefix: rest.slice(valueStart) };
            }
        }
        present.push(name);
    }
    return undefined;
}
