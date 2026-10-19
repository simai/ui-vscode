/*
 * Lookups and descriptions over the generated registries. Nothing here
 * depends on the vscode API, so it is covered by plain unit tests.
 */
import { formatColor } from './registry/color';
import {
    FrameworkAttribute,
    FrameworkClass,
    FrameworkRegistry,
    FrameworkTag,
    FrameworkToken,
} from './registry/frameworkTypes';
import { RegistryEntry, SfAutocompleteRegistry } from './registry/types';

export interface FrameworkIndex {
    framework: FrameworkRegistry;
    sizing: SfAutocompleteRegistry;
    tokens: FrameworkToken[];
    tokenByName: Map<string, FrameworkToken>;
    sizingByName: Map<string, RegistryEntry>;
    classByName: Map<string, FrameworkClass>;
    tagByName: Map<string, FrameworkTag>;
}

export function createIndex(
    framework: FrameworkRegistry,
    sizing: SfAutocompleteRegistry,
): FrameworkIndex {
    const tokenByName = new Map(framework.tokens.map(token => [token.name, token]));
    const sizingByName = new Map(sizing.entries.map(entry => [entry.cssName, entry]));
    // Sizing contract variables that the core sheet does not declare still
    // get suggested, with their contract values.
    for (const entry of sizing.entries) {
        if (tokenByName.has(entry.cssName)) continue;
        tokenByName.set(entry.cssName, {
            name: entry.cssName,
            group: 'sizing',
            source: 'core',
            component: null,
            summary: entry.description,
            value: `${entry.modes.mobile.px}px`,
            light: `${entry.modes.mobile.px}px`,
            dark: null,
            desktop: entry.modes.desktop.px === entry.modes.mobile.px
                ? null
                : `${entry.modes.desktop.px}px`,
            color: null,
            darkColor: null,
            since: null,
        });
    }
    return {
        framework,
        sizing,
        tokens: [...tokenByName.values()].sort((left, right) => left.name.localeCompare(right.name)),
        tokenByName,
        sizingByName,
        classByName: new Map(framework.classes.map(item => [item.name, item])),
        tagByName: new Map(framework.tags.map(tag => [tag.tag, tag])),
    };
}

/** CSS-escapes a literal class name for use in a selector. */
export const escapeClass = (name: string): string =>
    name.replace(/[^A-Za-z0-9_-]/g, char => `\\${char}`);

/** "0.875rem" → "14px"; other values are returned as they are. */
export function toPx(value: string | null): string | null {
    if (value === null) return null;
    const rem = value.match(/^(-?\d*\.?\d+)rem$/);
    if (!rem) return value;
    const px = Math.round(parseFloat(rem[1]) * 16 * 100) / 100;
    return `${px}px`;
}

const showValue = (value: string | null): string => {
    if (value === null) return '—';
    const px = toPx(value);
    return px !== value ? `${px} (${value})` : value;
};

/** A one-line summary for the completion list. */
export function tokenDetail(token: FrameworkToken): string {
    if (token.color) {
        const light = formatColor(token.color);
        return token.darkColor
            ? `light ${light} · dark ${formatColor(token.darkColor)}`
            : light;
    }
    if (token.desktop !== null) {
        return `mobile ${toPx(token.light)} · desktop ${toPx(token.desktop)}`;
    }
    return toPx(token.light) ?? token.value;
}

const releaseLine = (index: FrameworkIndex, where: string): string => {
    const release = index.framework.release;
    return `SIMAI Framework release \`${release.id}\` · ${where}`;
};

const deprecationLine = (
    deprecated: { since: string | null; replacement: string | null },
): string => {
    const since = deprecated.since ? ` since ${deprecated.since}` : '';
    const replacement = deprecated.replacement ? ` Use instead: ${deprecated.replacement}.` : '';
    return `**Deprecated**${since}.${replacement}`;
};

export function describeToken(index: FrameworkIndex, token: FrameworkToken): string {
    const lines: string[] = [`**\`${token.name}\`** · ${token.group}`];
    if (token.summary) lines.push('', token.summary);
    const rows: [string, string][] = [];
    const color = (value: string | null, rgba: FrameworkToken['color']): string =>
        rgba ? `${formatColor(rgba)}` : showValue(value);
    if (token.dark !== null) {
        rows.push(['light', color(token.light, token.color)]);
        rows.push(['dark', color(token.dark, token.darkColor)]);
    } else if (token.desktop !== null) {
        rows.push(['mobile', showValue(token.light)]);
        rows.push([`desktop (≥ ${index.framework.desktopMinWidth})`, showValue(token.desktop)]);
    } else {
        rows.push(['value', color(token.light, token.color)]);
    }
    if (token.light !== token.value) rows.push(['declared', `\`${token.value}\``]);
    lines.push('', '| | |', '|---|---|', ...rows.map(([key, value]) => `| ${key} | ${value} |`));

    const sizing = index.sizingByName.get(token.name);
    if (sizing) {
        lines.push(
            '',
            `Adaptive sizing contract \`${index.sizing.source.contractId}@${index.sizing.source.contractVersion}\`: `
            + `mobile ${sizing.modes.mobile.px}px · desktop ${sizing.modes.desktop.px}px`,
        );
    }
    const where = token.source === 'component'
        ? `public variable of \`${token.component}\`${token.since ? `, since ${token.since}` : ''}`
        : 'core token (core.css)';
    lines.push('', releaseLine(index, where));
    return lines.join('\n');
}

/**
 * Link to the SIMAI Framework documentation site for a registry entry. The
 * site serves one page per stable ID under the configured base URL
 * (sf.docs.baseUrl); without a base URL there is no link.
 */
export function docsLink(baseUrl: string | undefined, stableId: string): string | null {
    const base = (baseUrl ?? '').trim().replace(/\/+$/, '');
    if (!/^https:\/\/\S+$/.test(base)) return null;
    return `${base}/${encodeURIComponent(stableId)}`;
}

export function describeClass(
    index: FrameworkIndex,
    item: FrameworkClass,
    docsBaseUrl?: string,
): string {
    const lines = [
        `**\`${item.name}\`** · utility \`${item.family}\``,
        '',
        '```css',
        `${item.media ? `@media ${item.media} { ` : ''}.${escapeClass(item.name)} { ${item.declarations} }${item.media ? ' }' : ''}`,
        '```',
    ];
    if (item.breakpoint) lines.push('', `Applies from the \`${item.breakpoint}\` breakpoint.`);
    const docs = docsLink(docsBaseUrl, item.id);
    if (docs) lines.push('', `[SIMAI Framework docs](${docs})`);
    lines.push('', releaseLine(index, `\`${item.id}\` · ${item.lifecycle}`));
    return lines.join('\n');
}

export function describeTag(index: FrameworkIndex, tag: FrameworkTag, docsBaseUrl?: string): string {
    const lines = [`**\`<${tag.tag}>\`** · ${tag.title}`, '', tag.summary];
    if (tag.deprecated) lines.push('', deprecationLine(tag.deprecated));
    const attributes = tag.attributes.filter(attribute => !attribute.deprecated).map(item => `\`${item.name}\``);
    if (attributes.length > 0) lines.push('', `Attributes: ${attributes.join(', ')}`);
    const links = tag.docs.map(url => `[Documentation](${url})`);
    const docs = docsLink(docsBaseUrl, tag.id);
    if (docs) links.unshift(`[SIMAI Framework docs](${docs})`);
    if (links.length > 0) lines.push('', links.join(' · '));
    lines.push('', releaseLine(index, `\`${tag.id}\` · ${tag.lifecycle}`));
    return lines.join('\n');
}

export function describeAttribute(tag: FrameworkTag, attribute: FrameworkAttribute): string {
    const lines = [`**\`${attribute.name}\`** on \`<${tag.tag}>\` · ${attribute.type}`];
    if (attribute.description) lines.push('', attribute.description);
    if (attribute.deprecated) lines.push('', deprecationLine(attribute.deprecated));
    if (attribute.values.length > 0) {
        lines.push('', `Values: ${attribute.values.map(value => `\`${value}\``).join(', ')}`);
    }
    if (attribute.default !== null && attribute.default !== '') {
        lines.push('', `Default: \`${attribute.default}\``);
    }
    return lines.join('\n');
}

/** Colour tokens ranked by distance to the given colour, nearest first. */
export function nearestColorTokens(
    index: FrameworkIndex,
    rgba: [number, number, number, number],
    limit: number,
): FrameworkToken[] {
    const distance = (token: FrameworkToken): number => token.color!
        .reduce((sum, channel, position) => sum + (channel - rgba[position]) ** 2, 0);
    return index.tokens
        .filter(token => token.color !== null && token.source === 'core')
        .sort((left, right) => distance(left) - distance(right) || left.name.localeCompare(right.name))
        .slice(0, limit);
}
