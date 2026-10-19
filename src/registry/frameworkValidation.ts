import { FrameworkRegistry } from './frameworkTypes';

const unique = (names: string[], label: string): void => {
    const seen = new Set<string>();
    for (const name of names) {
        if (!name || seen.has(name)) throw new Error(`duplicate or empty ${label}: ${name}`);
        seen.add(name);
    }
};

export function validateFrameworkRegistry(value: unknown): FrameworkRegistry {
    if (!value || typeof value !== 'object') {
        throw new Error('framework registry must be an object');
    }
    const registry = value as FrameworkRegistry;
    if (
        registry.schemaVersion !== '1.0.0'
        || registry.registryId !== 'simai.sf-framework'
    ) {
        throw new Error('unsupported framework registry schema or identity');
    }
    if (!/^ui-[0-9a-f]{12}$/.test(registry.release?.id ?? '')) {
        throw new Error('framework registry has no release identity');
    }
    for (const key of ['registryCommit', 'coreCommit', 'smartCommit'] as const) {
        if (!/^[0-9a-f]{40}$/.test(registry.release[key])) {
            throw new Error(`framework registry ${key} is not a full commit`);
        }
    }
    if (
        !Array.isArray(registry.tags)
        || !Array.isArray(registry.classes)
        || !Array.isArray(registry.tokens)
        || !Array.isArray(registry.knownTags)
        || !Array.isArray(registry.knownTokens)
    ) {
        throw new Error('framework registry sections are missing');
    }
    unique(registry.tags.map(tag => tag.tag), 'tag');
    unique(registry.classes.map(item => item.name), 'class');
    unique(registry.tokens.map(token => token.name), 'token');
    for (const tag of registry.tags) {
        if (!tag.tag.startsWith('sf-')) throw new Error(`tag without sf- prefix: ${tag.tag}`);
        unique(tag.attributes.map(attribute => attribute.name), `${tag.tag} attribute`);
    }
    for (const token of registry.tokens) {
        if (!token.name.startsWith('--sf-')) throw new Error(`token without --sf- prefix: ${token.name}`);
    }
    return registry;
}
