export type CompletionContext = 'cssVariable' | 'cssValue' | 'htmlClass';

export interface RegistryModeValue {
    alias: string;
    px: number;
}

export interface RegistryEntry {
    stableId: string;
    cssName: string;
    type: 'length';
    category: string;
    role: string;
    modes: {
        mobile: RegistryModeValue;
        desktop: RegistryModeValue;
    };
    aliases: string[];
    componentRelation: string | null;
    lifecycle: {
        status: 'active' | 'deprecated';
        deprecated: boolean;
        replacementStableId: string | null;
    };
    completionContexts: CompletionContext[];
    description: string;
}

export interface SfAutocompleteRegistry {
    schemaVersion: '1.0.0';
    registryId: 'simai.sf-autocomplete';
    registryVersion: string;
    source: {
        contractId: string;
        contractVersion: string;
        sha256: string;
        repository: string;
        commit: string;
        tree: string;
        path: string;
    };
    modes: {
        mobile: { minWidthPx: number };
        desktop: { minWidthPx: number };
    };
    scope: {
        included: string[];
        excluded: string[];
    };
    entries: RegistryEntry[];
}
