/*
 * Finds unknown and deprecated SIMAI Framework names in a document. It is
 * deliberately conservative: a name is reported as unknown only when it is a
 * near miss of a real Framework name (a likely typo), so a project's own
 * names never get flagged. Nothing here depends on the vscode API.
 */
import { FrameworkIndex } from './framework';
import { isStylesheetLanguage } from './completion';

export type FindingCode =
    | 'unknown-token'
    | 'unknown-tag'
    | 'unknown-attribute'
    | 'deprecated-tag'
    | 'deprecated-attribute';

export interface Finding {
    code: FindingCode;
    kind: 'unknown' | 'deprecated';
    start: number;
    end: number;
    name: string;
    message: string;
    /** A name that can replace the finding's text, offered as a Quick Fix. */
    replacement: string | null;
}

/** Attributes any element may carry, and framework binding syntaxes. */
const globalAttributes = new Set([
    'accesskey', 'autocapitalize', 'autofocus', 'class', 'classname', 'contenteditable',
    'dir', 'draggable', 'enterkeyhint', 'exportparts', 'hidden', 'id', 'inert',
    'inputmode', 'is', 'itemid', 'itemprop', 'itemref', 'itemscope', 'itemtype',
    'key', 'lang', 'nonce', 'part', 'popover', 'ref', 'role', 'slot', 'spellcheck',
    'style', 'tabindex', 'title', 'translate',
]);
const bindingPrefix = /^(aria-|data-|on|v-|x-|wire:|hx-|bind:|:|@|#|\[|\(|\*|\{|\$)/i;

/** Levenshtein distance, capped: returns limit + 1 once it is exceeded. */
export function distance(left: string, right: string, limit: number): number {
    if (Math.abs(left.length - right.length) > limit) return limit + 1;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
        const current = [row];
        let best = row;
        for (let column = 1; column <= right.length; column += 1) {
            const cost = left[row - 1] === right[column - 1] ? 0 : 1;
            current[column] = Math.min(
                previous[column] + 1,
                current[column - 1] + 1,
                previous[column - 1] + cost,
            );
            best = Math.min(best, current[column]);
        }
        if (best > limit) return limit + 1;
        previous = current;
    }
    return previous[right.length];
}

/** The closest candidate within a small edit distance, if any. */
export function nearestName(name: string, candidates: Iterable<string>): string | null {
    const limit = name.length <= 8 ? 1 : 2;
    let best: string | null = null;
    let bestDistance = limit + 1;
    for (const candidate of candidates) {
        if (candidate === name) return null;
        const current = distance(name, candidate, limit);
        if (current < bestDistance || (current === bestDistance && best !== null && candidate < best)) {
            best = candidate;
            bestDistance = current;
        }
    }
    return bestDistance <= limit ? best : null;
}

interface ScannedAttribute {
    name: string;
    start: number;
    end: number;
}

/** Reads the attribute names of a start tag, from just after its name. */
function scanAttributes(text: string, from: number): ScannedAttribute[] {
    const attributes: ScannedAttribute[] = [];
    let index = from;
    while (index < text.length) {
        const char = text[index];
        if (char === '>' || char === '<') break;
        if (/\s|\//.test(char)) {
            index += 1;
            continue;
        }
        if (char === '"' || char === "'") {
            const close = text.indexOf(char, index + 1);
            if (close < 0) break;
            index = close + 1;
            continue;
        }
        if (char === '{') {
            // JSX expressions and Blade echoes: skip to the matching brace.
            let depth = 0;
            for (; index < text.length; index += 1) {
                if (text[index] === '{') depth += 1;
                if (text[index] === '}' && --depth === 0) break;
            }
            index += 1;
            continue;
        }
        if (char === '=') {
            index += 1;
            while (index < text.length && /\s/.test(text[index])) index += 1;
            if (text[index] !== '"' && text[index] !== "'" && text[index] !== '{') {
                while (index < text.length && !/[\s>]/.test(text[index])) index += 1;
            }
            continue;
        }
        const start = index;
        while (index < text.length && !/[\s"'>/={}<]/.test(text[index])) index += 1;
        attributes.push({ name: text.slice(start, index), start, end: index });
    }
    return attributes;
}

export function analyzeDocument(
    text: string,
    languageId: string,
    index: FrameworkIndex,
): Finding[] {
    if (!text.includes('sf-')) return [];
    const findings: Finding[] = [];

    const knownTokens = new Set(index.framework.knownTokens);
    const allTokens = [...index.tokenByName.keys(), ...knownTokens];
    for (const match of text.matchAll(/var\(\s*(--sf-(?:\\.|[A-Za-z0-9_-])+)/g)) {
        const name = match[1];
        // --sf-<block>--* are component-internal tokens; they are not in the snapshot.
        if (index.tokenByName.has(name) || knownTokens.has(name) || name.slice(5).includes('--')) continue;
        const replacement = nearestName(name, allTokens);
        if (!replacement) continue;
        const start = match.index! + match[0].indexOf(name);
        findings.push({
            code: 'unknown-token',
            kind: 'unknown',
            start,
            end: start + name.length,
            name,
            message: `Unknown SIMAI Framework token ${name}. Did you mean ${replacement}?`,
            replacement,
        });
    }

    if (isStylesheetLanguage(languageId)) return findings;

    const knownTags = new Set(index.framework.knownTags);
    const allTags = [...index.tagByName.keys(), ...knownTags];
    for (const match of text.matchAll(/<(\/?)(sf-[a-z0-9-]+)(?=[\s/>]|$)/g)) {
        const name = match[2];
        const start = match.index! + 1 + match[1].length;
        const end = start + name.length;
        const tag = index.tagByName.get(name);
        if (!tag) {
            if (knownTags.has(name) || match[1]) continue;
            const replacement = nearestName(name, allTags);
            if (!replacement) continue;
            findings.push({
                code: 'unknown-tag',
                kind: 'unknown',
                start,
                end,
                name,
                message: `Unknown SIMAI Framework element <${name}>. Did you mean <${replacement}>?`,
                replacement,
            });
            continue;
        }
        if (tag.deprecated && !match[1]) {
            const replacement = tag.deprecated.replacement && allTags.includes(tag.deprecated.replacement)
                ? tag.deprecated.replacement
                : null;
            findings.push({
                code: 'deprecated-tag',
                kind: 'deprecated',
                start,
                end,
                name,
                message: `<${name}> is deprecated in SIMAI Framework`
                    + (tag.deprecated.replacement ? `; use ${tag.deprecated.replacement} instead.` : '.'),
                replacement,
            });
        }
        if (match[1]) continue;

        const names = tag.attributes.map(attribute => attribute.name);
        for (const attribute of scanAttributes(text, end)) {
            const lower = attribute.name.toLowerCase();
            const known = tag.attributes.find(item => item.name === attribute.name);
            if (known?.deprecated) {
                const replacement = known.deprecated.replacement
                    && names.includes(known.deprecated.replacement)
                    ? known.deprecated.replacement
                    : null;
                const since = known.deprecated.since ? ` since ${known.deprecated.since}` : '';
                findings.push({
                    code: 'deprecated-attribute',
                    kind: 'deprecated',
                    start: attribute.start,
                    end: attribute.end,
                    name: attribute.name,
                    message: `The ${attribute.name} attribute of <${name}> is deprecated${since}`
                        + (known.deprecated.replacement ? `: ${known.deprecated.replacement}.` : '.'),
                    replacement,
                });
                continue;
            }
            if (known || globalAttributes.has(lower) || bindingPrefix.test(attribute.name)) continue;
            const replacement = nearestName(attribute.name, names);
            if (!replacement) continue;
            findings.push({
                code: 'unknown-attribute',
                kind: 'unknown',
                start: attribute.start,
                end: attribute.end,
                name: attribute.name,
                message: `<${name}> has no ${attribute.name} attribute. Did you mean ${replacement}?`,
                replacement,
            });
        }
    }
    return findings;
}
