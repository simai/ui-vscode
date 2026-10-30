export interface Deprecation {
    since: string | null;
    /** A stable ID, attribute, tag or a short instruction, as the Framework states it. */
    replacement: string | null;
}

export interface FrameworkAttribute {
    name: string;
    type: string;
    default: string | null;
    description: string | null;
    /** Closed set of allowed values (enum). */
    values: string[];
    /** Open examples, offered after the allowed values. */
    examples: string[];
    deprecated: Deprecation | null;
}

export interface FrameworkTag {
    tag: string;
    id: string;
    title: string;
    summary: string;
    lifecycle: string;
    deprecated: Deprecation | null;
    docs: string[];
    /** Path of the tag's page on the documentation site, when it has one. */
    page: string | null;
    attributes: FrameworkAttribute[];
}

export interface FrameworkClass {
    /** Literal class name as written in HTML, e.g. md:flex. */
    name: string;
    id: string;
    family: string;
    breakpoint: string | null;
    media: string | null;
    declarations: string;
    lifecycle: string;
}

export type Rgba = [number, number, number, number];

export interface FrameworkToken {
    /** Name as written in CSS, with escapes, e.g. --sf-radius-1\/2. */
    name: string;
    group: string;
    source: 'core' | 'component';
    component: string | null;
    summary: string | null;
    /** Declared value (mobile, before resolution). */
    value: string;
    /** Resolved value: light scheme, mobile mode. */
    light: string | null;
    /** Resolved dark-scheme value, when it differs. */
    dark: string | null;
    /** Resolved desktop value, when it differs. */
    desktop: string | null;
    color: Rgba | null;
    darkColor: Rgba | null;
    since: string | null;
}

export interface FrameworkRegistry {
    schemaVersion: '1.0.0';
    registryId: 'simai.sf-framework';
    release: {
        id: string;
        repository: string;
        registryCommit: string;
        coreCommit: string;
        smartCommit: string;
        registrySha256: string;
    };
    desktopMinWidth: string;
    tags: FrameworkTag[];
    classes: FrameworkClass[];
    tokens: FrameworkToken[];
    /** Documentation page path of each utility family that has one. */
    utilityPages: Record<string, string>;
    /**
     * Real Framework names that are not suggested (not safe to suggest, or not
     * global tokens). Diagnostics never call them unknown.
     */
    knownTags: string[];
    knownTokens: string[];
}
