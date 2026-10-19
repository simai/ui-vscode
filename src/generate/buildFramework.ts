import { parseColor } from '../registry/color';
import {
    Deprecation,
    FrameworkAttribute,
    FrameworkClass,
    FrameworkRegistry,
    FrameworkTag,
    FrameworkToken,
} from '../registry/frameworkTypes';
import { CssRule, parseCss, splitTopLevel, unescapeCss } from './css';
import {
    FrameworkPointer,
    RawContractRegistry,
    RawManifestProperty,
    RawPublicVariables,
    RawSmartManifest,
} from './frameworkInputs';

export interface FrameworkInputs {
    pointer: FrameworkPointer;
    registry: RawContractRegistry;
    registrySha256: string;
    coreCss: string;
    publicVariables: RawPublicVariables;
    /** Keyed by snapshot path, e.g. utility/display/md/css/md.css. */
    utilityCss: Record<string, string>;
    /** Keyed by snapshot path, e.g. smart/buttons/smart.manifest.json. */
    manifests: Record<string, RawSmartManifest>;
    /** Desktop mode boundary from the adaptive sizing contract, in px. */
    desktopMinWidthPx: number;
}

export interface FrameworkReport {
    skippedPublicComponents: string[];
    ignoredTokenMedia: string[];
}

/** Selectors whose custom properties make up the global token set. */
const tokenSelectors = new Set([
    ':root',
    ':root, ::after, ::before',
    '.theme-light, .theme-dark',
]);

const githubUrl = (ref: string): string | null => {
    const match = ref.match(/^([^@]+)@([0-9a-f]{7,40}):(.+)$/);
    return match ? `https://github.com/${match[1]}/blob/${match[2]}/${match[3]}` : null;
};

const asText = (value: unknown): string =>
    typeof value === 'string' ? value : JSON.stringify(value);

/* ---------------------------------------------------------------- tokens */

type Scheme = 'light' | 'dark';
type Mode = 'mobile' | 'desktop';

/** Applies fn to every call of `name(...)`, innermost first. */
function replaceCalls(
    value: string,
    name: string,
    fn: (args: string[]) => string,
): string {
    const opener = `${name}(`;
    let result = value;
    for (let guard = 0; guard < 500; guard += 1) {
        const start = result.lastIndexOf(opener);
        if (start < 0) break;
        if (start > 0 && /[a-z-]/i.test(result[start - 1])) {
            // Part of a longer function name; leave it.
            break;
        }
        let depth = 0;
        let end = -1;
        for (let index = start + opener.length - 1; index < result.length; index += 1) {
            if (result[index] === '(') depth += 1;
            if (result[index] === ')') {
                depth -= 1;
                if (depth === 0) {
                    end = index;
                    break;
                }
            }
        }
        if (end < 0) break;
        const args = splitTopLevel(result.slice(start + opener.length, end));
        result = result.slice(0, start) + fn(args) + result.slice(end + 1);
    }
    return result;
}

const unresolvedMarker = '\u0001unresolved';

class TokenResolver {
    constructor(
        private readonly base: Map<string, string>,
        private readonly desktop: Map<string, string>,
    ) {}

    declared(name: string, mode: Mode): string | undefined {
        return (mode === 'desktop' ? this.desktop.get(name) : undefined) ?? this.base.get(name);
    }

    resolve(name: string, scheme: Scheme, mode: Mode, seen: Set<string> = new Set()): string | null {
        const value = this.declared(name, mode);
        if (value === undefined || seen.has(name)) return null;
        const next = new Set(seen).add(name);
        const withVars = replaceCalls(value, 'var', ([reference, ...fallback]) => {
            const resolved = this.resolve(reference.trim(), scheme, mode, next);
            if (resolved !== null) return resolved;
            if (fallback.length > 0) return fallback.join(', ');
            // Marked so the scan does not find the same call again.
            return `${unresolvedMarker}(${reference})`;
        });
        return replaceCalls(withVars, 'light-dark', ([light, dark]) =>
            scheme === 'light' ? light : dark ?? light,
        ).split(unresolvedMarker).join('var');
    }
}

function tokenGroup(name: string, isColor: boolean): string {
    const rules: [RegExp, string][] = [
        [/^--sf-[a-i]\d/, 'primitive'],
        [/^--sf-radius/, 'radius'],
        [/^--sf-icon/, 'icon'],
        [/^--sf-opacity|^--sf-alpha/, 'opacity'],
        [/^--sf-z-/, 'z-index'],
        [/^--sf-space/, 'spacing'],
        [/^--sf-ui-/, 'control'],
        [/^--sf-(text|title|heading|display|label|font|weight|code|mono|sans|serif)/, 'typography'],
        [/^--sf-(elevation|shadow|floating|drop)/, 'elevation'],
        [/^--sf-(duration|ease|transition|animation)/, 'motion'],
        [/^--sf-(breakpoint|container|viewport)/, 'layout'],
        [/^--sf-(border|focus|ring|outline-width)/, 'border'],
    ];
    if (isColor) return 'color';
    return rules.find(([pattern]) => pattern.test(name))?.[1] ?? 'other';
}

function buildTokens(
    rules: CssRule[],
    desktopMedia: RegExp,
    publicTokens: FrameworkToken[],
    report: FrameworkReport,
): FrameworkToken[] {
    const base = new Map<string, string>();
    const desktop = new Map<string, string>();
    const ignoredMedia = new Set<string>();
    for (const rule of rules) {
        if (!tokenSelectors.has(rule.selector)) continue;
        let target: Map<string, string> | null = base;
        if (rule.media.length > 0) {
            target = rule.media.length === 1 && desktopMedia.test(rule.media[0]) ? desktop : null;
        }
        for (const [property, value] of rule.declarations) {
            if (!property.startsWith('--sf-')) continue;
            if (target === null) {
                ignoredMedia.add(rule.media.join(' and '));
                continue;
            }
            target.set(property, value);
        }
    }
    report.ignoredTokenMedia = [...ignoredMedia].sort();

    // Public component variables are never set by the Framework; resolve
    // their documented defaults against the core tokens. The contract writes
    // references unescaped (--sf-space-1/4), CSS needs --sf-space-1\/4.
    const publicByName = new Map<string, FrameworkToken>();
    for (const token of publicTokens) {
        if (base.has(token.name)) continue;
        publicByName.set(token.name, token);
        base.set(token.name, token.value.replace(/(var\(--sf-[^,)]*?)(?<!\\)\//g, '$1\\/'));
    }

    const resolver = new TokenResolver(base, desktop);
    const tokens: FrameworkToken[] = [];
    for (const [name, declared] of base) {
        const publicToken = publicByName.get(name);
        const value = publicToken ? publicToken.value : declared;
        const light = resolver.resolve(name, 'light', 'mobile');
        const dark = resolver.resolve(name, 'dark', 'mobile');
        const desktopLight = resolver.resolve(name, 'light', 'desktop');
        const color = light === null ? null : parseColor(light);
        const darkColor = dark === null ? null : parseColor(dark);
        tokens.push({
            name,
            group: publicToken ? 'component' : tokenGroup(name, color !== null),
            source: publicToken ? 'component' : 'core',
            component: publicToken?.component ?? null,
            summary: publicToken?.summary ?? null,
            value,
            light,
            dark: dark !== light ? dark : null,
            desktop: desktopLight !== light ? desktopLight : null,
            color,
            darkColor: dark !== light ? darkColor : null,
            since: publicToken?.since ?? null,
        });
    }
    return tokens.sort((left, right) => left.name.localeCompare(right.name));
}

/* ------------------------------------------------------------- utilities */

function buildClasses(
    utilityCss: Record<string, string>,
    registry: RawContractRegistry,
    safe: Set<string>,
): FrameworkClass[] {
    const byFamily = new Map(
        registry.entries
            .filter(entry => entry.kind === 'utility' && safe.has(entry.id))
            .map(entry => [entry.name, entry]),
    );
    const classes = new Map<string, FrameworkClass>();
    for (const [file, css] of Object.entries(utilityCss).sort()) {
        const match = file.match(/^utility\/([^/]+)\/([^/]+)\/css\/\2\.css$/);
        if (!match) throw new Error(`unexpected utility file ${file}`);
        const [, family, variant] = match;
        const entry = byFamily.get(family);
        if (!entry) throw new Error(`${file} does not belong to a safe utility`);
        for (const rule of parseCss(css)) {
            for (const selector of splitTopLevel(rule.selector)) {
                const raw = selector.match(/^\.((?:\\.|[^\s.:#[>+~,()\\])+)/)?.[1];
                if (!raw) continue;
                const name = unescapeCss(raw);
                const declarations = rule.declarations
                    .map(([property, value]) => `${property}: ${value};`)
                    .join(' ');
                const existing = classes.get(name);
                if (existing) {
                    if (!existing.declarations.includes(declarations)) {
                        existing.declarations = `${existing.declarations} ${declarations}`;
                    }
                    continue;
                }
                classes.set(name, {
                    name,
                    id: entry.id,
                    family,
                    breakpoint: variant === 'default' ? null : variant,
                    media: rule.media.length > 0 ? rule.media.join(' and ') : null,
                    declarations,
                    lifecycle: entry.lifecycle,
                });
            }
        }
    }
    return [...classes.values()].sort((left, right) => left.name.localeCompare(right.name));
}

/* ------------------------------------------------------------ components */

function attribute(
    name: string,
    property: RawManifestProperty,
    deprecations: Map<string, Deprecation>,
): FrameworkAttribute {
    const type = Array.isArray(property.type)
        ? property.type.join(' | ')
        : property.type ?? 'string';
    return {
        name,
        type,
        default: property.default === undefined ? null : asText(property.default),
        description: property.description ?? null,
        values: (property.enum ?? []).map(asText).filter(value => value !== ''),
        examples: (property.examples ?? []).map(asText),
        deprecated: deprecations.get(name) ?? null,
    };
}

function buildTags(
    registry: RawContractRegistry,
    safe: Set<string>,
    manifests: Record<string, RawSmartManifest>,
): FrameworkTag[] {
    const byId = new Map(Object.values(manifests).map(manifest => [manifest.id, manifest]));
    const tags: FrameworkTag[] = [];
    for (const entry of registry.entries) {
        if (entry.kind !== 'smart-component' || !safe.has(entry.id)) continue;
        const manifest = byId.get(entry.id);
        if (!manifest) throw new Error(`${entry.id} has no vendored manifest`);
        const deprecations = new Map<string, Deprecation>(
            (manifest.compatibility?.deprecations ?? []).map(item => [
                item.path,
                { since: item.since ?? null, replacement: item.replacement ?? null },
            ]),
        );
        const replacement = manifest.compatibility?.replacement ?? null;
        const deprecated = entry.lifecycle === 'deprecated'
            || manifest.lifecycle === 'deprecated'
            || replacement !== null
            ? { since: null, replacement }
            : null;
        const attributes = Object.entries(manifest.inputs?.properties ?? {})
            .map(([name, property]) => attribute(name, property, deprecations))
            .sort((left, right) => left.name.localeCompare(right.name));
        for (const tag of entry.runtime.tags ?? []) {
            if (tag !== manifest.custom_element) {
                throw new Error(`${entry.id}: registry tag ${tag} != manifest ${manifest.custom_element}`);
            }
            tags.push({
                tag,
                id: entry.id,
                title: entry.title,
                summary: manifest.summary,
                lifecycle: entry.lifecycle,
                deprecated,
                docs: entry.documentation_refs
                    .map(githubUrl)
                    .filter((url): url is string => url !== null),
                attributes,
            });
        }
    }
    return tags.sort((left, right) => left.tag.localeCompare(right.tag));
}

function buildPublicVariables(
    publicVariables: RawPublicVariables,
    registry: RawContractRegistry,
    safe: Set<string>,
    report: FrameworkReport,
): FrameworkToken[] {
    const safeEntries = registry.entries.filter(entry => safe.has(entry.id));
    const tokens: FrameworkToken[] = [];
    const skipped: string[] = [];
    for (const component of publicVariables.components) {
        const name = component.component;
        const owner = safeEntries.find(entry =>
            (entry.runtime.tags ?? []).includes(`sf-${name}`)
            || [name, `${name}s`, `${name}es`].includes(entry.name),
        );
        if (!owner) {
            skipped.push(name);
            continue;
        }
        for (const variable of component.variables) {
            tokens.push({
                name: variable.name,
                group: 'component',
                source: 'component',
                component: component.selector,
                summary: variable.summary,
                value: variable.default,
                light: null,
                dark: null,
                desktop: null,
                color: null,
                darkColor: null,
                since: variable.since,
            });
        }
    }
    report.skippedPublicComponents = skipped.sort();
    return tokens;
}

/* ----------------------------------------------------------------- build */

export function buildFramework(inputs: FrameworkInputs): {
    registry: FrameworkRegistry;
    report: FrameworkReport;
} {
    const { pointer, registry } = inputs;
    if (registry.compatibility.id !== pointer.releaseId) {
        throw new Error(`registry is bound to ${registry.compatibility.id}, not ${pointer.releaseId}`);
    }
    const blocked = new Set(registry.indexes.blocked);
    const safe = new Set(registry.indexes.safe_to_suggest.filter(id => !blocked.has(id)));
    const report: FrameworkReport = { skippedPublicComponents: [], ignoredTokenMedia: [] };

    const desktopRem = inputs.desktopMinWidthPx / 16;
    const desktopMedia = new RegExp(`^\\(min-width:\\s*${desktopRem}rem\\)$`);
    const tokens = buildTokens(
        parseCss(inputs.coreCss),
        desktopMedia,
        buildPublicVariables(inputs.publicVariables, registry, safe, report),
        report,
    );

    return {
        registry: {
            schemaVersion: '1.0.0',
            registryId: 'simai.sf-framework',
            release: {
                id: pointer.releaseId,
                repository: pointer.repository,
                registryCommit: pointer.registryCommit,
                coreCommit: pointer.runtime.core.commit,
                smartCommit: pointer.runtime.smart.commit,
                registrySha256: inputs.registrySha256,
            },
            desktopMinWidth: `${desktopRem}rem`,
            tags: buildTags(registry, safe, inputs.manifests),
            classes: buildClasses(inputs.utilityCss, registry, safe),
            tokens,
        },
        report,
    };
}
