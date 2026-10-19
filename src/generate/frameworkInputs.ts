import * as crypto from 'crypto';

export const sha256 = (content: Buffer | string): string =>
    crypto.createHash('sha256').update(content).digest('hex');

export interface RuntimeSource {
    owner: string;
    commit: string;
    tree: string;
    runtime_path: string;
    runtime_tree: string;
}

export interface ReleaseLock {
    compatibility_id: string;
    runtime_sources: {
        core: RuntimeSource;
        smart: RuntimeSource;
    };
    build_inputs: {
        source: { owner: string; commit: string; tree: string };
    };
}

export interface RawRegistryEntry {
    id: string;
    kind: 'component' | 'smart-component' | 'utility' | 'recipe';
    name: string;
    title: string;
    lifecycle: string;
    documentation_refs: string[];
    provenance: {
        commit: string;
        repository: string;
        source_refs: string[];
    };
    runtime: {
        asset_root?: string;
        rule_name?: string;
        rule_names?: string[];
        tags?: string[];
    };
    /**
     * Per-entry promotion state. The Framework promotes an entry by a written
     * rule (contracts/owners/PROMOTION.md) and only a promoted, ready entry
     * belongs in the suggestion set. `blockers` is not machine-readable: a
     * held entry carries an empty list, so never read a hold off it.
     */
    readiness?: {
        safe_to_suggest?: boolean;
        status?: string;
    };
}

export interface RawContractRegistry {
    schema_id: string;
    schema_version: number;
    compatibility: { id: string };
    indexes: {
        safe_to_suggest: string[];
        blocked: string[];
    };
    entries: RawRegistryEntry[];
}

export interface RawManifestProperty {
    type?: string | string[];
    default?: unknown;
    description?: string;
    enum?: unknown[];
    examples?: unknown[];
}

export interface RawSmartManifest {
    id: string;
    title: string;
    summary: string;
    lifecycle: string;
    custom_element: string;
    inputs?: { properties?: Record<string, RawManifestProperty> };
    compatibility?: {
        deprecations?: { path: string; since?: string | null; replacement?: string | null }[];
        replacement?: string | null;
    };
}

export interface RawPublicVariables {
    schema: string;
    components: {
        component: string;
        selector: string;
        variables: {
            name: string;
            role: string;
            summary: string;
            default: string;
            since: string;
        }[];
    }[];
}

export interface FrameworkPointer {
    releaseId: string;
    repository: string;
    registryCommit: string;
    runtime: {
        core: { commit: string; tree: string; runtimeTree: string };
        smart: { commit: string; tree: string; runtimeTree: string };
    };
    files: Record<string, { source: string; sha256: string }>;
}
