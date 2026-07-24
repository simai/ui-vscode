import {
    CompletionContext,
    RegistryEntry,
    SfAutocompleteRegistry,
} from './types';

export const expectedContract = {
    id: 'simai.vertical-sizing',
    version: '1.1.0',
    sha256: '333d78f0f3abe6f47c9caa1fc3c53c4d2894e122a922a400804383266cbd72f5',
} as const;

const allowedContexts = new Set<CompletionContext>([
    'cssVariable',
    'cssValue',
    'htmlClass',
]);

function assertMode(entry: RegistryEntry, mode: 'mobile' | 'desktop'): void {
    const value = entry.modes[mode];
    if (!value || typeof value.alias !== 'string' || !Number.isFinite(value.px)) {
        throw new Error(`${entry.stableId} has invalid ${mode} mode`);
    }
}

export function validateRegistry(value: unknown): SfAutocompleteRegistry {
    if (!value || typeof value !== 'object') {
        throw new Error('registry must be an object');
    }

    const registry = value as SfAutocompleteRegistry;
    if (
        registry.schemaVersion !== '1.0.0'
        || registry.registryId !== 'simai.sf-autocomplete'
    ) {
        throw new Error('unsupported registry schema or identity');
    }
    if (
        registry.source?.contractId !== expectedContract.id
        || registry.source?.contractVersion !== expectedContract.version
        || registry.source?.sha256 !== expectedContract.sha256
    ) {
        throw new Error('adaptive sizing contract identity mismatch');
    }
    if (
        registry.modes?.mobile?.minWidthPx !== 0
        || registry.modes?.desktop?.minWidthPx !== 960
    ) {
        throw new Error('adaptive sizing mode boundary mismatch');
    }
    if (!Array.isArray(registry.entries) || registry.entries.length === 0) {
        throw new Error('registry entries are missing');
    }

    const stableIds = new Set<string>();
    const cssNames = new Set<string>();
    for (const entry of registry.entries) {
        if (!entry.stableId || stableIds.has(entry.stableId)) {
            throw new Error(`duplicate or empty stable ID: ${entry.stableId}`);
        }
        if (!entry.cssName?.startsWith('--sf-') || cssNames.has(entry.cssName)) {
            throw new Error(`duplicate or invalid CSS name: ${entry.cssName}`);
        }
        if (entry.type !== 'length') {
            throw new Error(`${entry.stableId} has unsupported type`);
        }
        assertMode(entry, 'mobile');
        assertMode(entry, 'desktop');
        if (
            !Array.isArray(entry.completionContexts)
            || entry.completionContexts.some(context => !allowedContexts.has(context))
        ) {
            throw new Error(`${entry.stableId} has invalid completion contexts`);
        }
        if (
            entry.lifecycle.deprecated
            !== (entry.lifecycle.status === 'deprecated')
        ) {
            throw new Error(`${entry.stableId} has inconsistent lifecycle`);
        }
        stableIds.add(entry.stableId);
        cssNames.add(entry.cssName);
    }

    const requiredExclusions = [
        'menu-indentation',
        'leading-slot-alignment',
        'inline-padding-parity',
        'container-gutters',
        'container-width',
        'cross-component-horizontal-relations',
    ];
    if (
        requiredExclusions.some(
            exclusion => !registry.scope.excluded.includes(exclusion),
        )
    ) {
        throw new Error('horizontal non-goals are incomplete');
    }

    return registry;
}
