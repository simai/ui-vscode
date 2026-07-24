import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RegistryEntry, SfAutocompleteRegistry } from '../registry/types';
import { validateRegistry } from '../registry/validation';

interface AliasPair {
    mobile: string;
    desktop: string;
}

interface AdaptiveSizingContract {
    meta: {
        contractId: string;
        version: string;
    };
    modes: SfAutocompleteRegistry['modes'];
    primitives: Record<string, {
        startPx: number;
        stepPx: number;
        count: number;
    }>;
    typography: {
        sizes: Record<string, AliasPair>;
        lineHeights: Record<string, AliasPair>;
    };
    spacing: Record<string, AliasPair>;
    controls: {
        sizeRoles: Record<string, { lineHeightRole: string }>;
        tightness: Record<string, Record<string, AliasPair>>;
    };
    scope: SfAutocompleteRegistry['scope'];
}

interface ContractPointer {
    sourceRepository: string;
    sourceCommit: string;
    sourceTree: string;
    sourcePath: string;
    contractId: string;
    contractVersion: string;
    sha256: string;
}

const repositoryRoot = path.resolve(__dirname, '..', '..');
const contractPath = path.join(
    repositoryRoot,
    'contracts',
    'adaptive-sizing.v1.json',
);
const pointerPath = path.join(
    repositoryRoot,
    'contracts',
    'adaptive-sizing.pointer.json',
);
const outputPath = path.join(
    repositoryRoot,
    'src',
    'registry',
    'sf-autocomplete.json',
);

const rawContract = fs.readFileSync(contractPath);
const contract = JSON.parse(rawContract.toString('utf8')) as AdaptiveSizingContract;
const pointer = JSON.parse(
    fs.readFileSync(pointerPath, 'utf8'),
) as ContractPointer;
const actualHash = crypto
    .createHash('sha256')
    .update(rawContract)
    .digest('hex');

if (
    actualHash !== pointer.sha256
    || contract.meta.contractId !== pointer.contractId
    || contract.meta.version !== pointer.contractVersion
) {
    throw new Error('pinned adaptive sizing contract does not match pointer');
}

const primitiveValues = new Map<string, number>([['zero', 0]]);
for (const [rangeName, range] of Object.entries(contract.primitives)) {
    for (let index = 0; index < range.count; index += 1) {
        primitiveValues.set(
            `${rangeName}${index}`,
            range.startPx + range.stepPx * index,
        );
    }
}

const px = (alias: string): number => {
    const value = primitiveValues.get(alias);
    if (value === undefined) throw new Error(`unknown primitive alias: ${alias}`);
    return value;
};
const modePair = (aliases: AliasPair) => ({
    mobile: { alias: aliases.mobile, px: px(aliases.mobile) },
    desktop: { alias: aliases.desktop, px: px(aliases.desktop) },
});
const cssRole = (role: string): string => role.split('/').join('\\/');
const activeLifecycle = {
    status: 'active' as const,
    deprecated: false,
    replacementStableId: null,
};
const entry = (
    stableId: string,
    cssName: string,
    category: string,
    role: string,
    modes: RegistryEntry['modes'],
    componentRelation: string | null,
    description: string,
): RegistryEntry => ({
    stableId,
    cssName,
    type: 'length',
    category,
    role,
    modes,
    aliases: [],
    componentRelation,
    lifecycle: activeLifecycle,
    completionContexts: ['cssVariable', 'cssValue'],
    description,
});

const entries: RegistryEntry[] = [];
for (const [role, aliases] of Object.entries(contract.typography.sizes)) {
    entries.push(entry(
        `simai.vertical-sizing.typography.size.${role}`,
        `--sf-text-size-${cssRole(role)}`,
        'typography-size',
        role,
        modePair(aliases),
        'typography',
        `Adaptive font size ${role}`,
    ));
}
for (const [role, aliases] of Object.entries(contract.typography.lineHeights)) {
    entries.push(entry(
        `simai.vertical-sizing.typography.line-height.${role}`,
        `--sf-text-height-${cssRole(role)}`,
        'typography-line-height',
        role,
        modePair(aliases),
        'typography',
        `Adaptive line height ${role}`,
    ));
}
for (const [role, aliases] of Object.entries(contract.spacing)) {
    entries.push(entry(
        `simai.vertical-sizing.spacing.${role}`,
        `--sf-space-${cssRole(role)}`,
        'vertical-spacing',
        role,
        modePair(aliases),
        'block-axis-spacing',
        `Adaptive spacing ${role}`,
    ));
}
for (const [tightness, sizes] of Object.entries(contract.controls.tightness)) {
    for (const [size, aliases] of Object.entries(sizes)) {
        entries.push(entry(
            `simai.vertical-sizing.control.block-padding.${tightness}.${size}`,
            `--sf-ui-${cssRole(size)}--space-y-tightness-${tightness}`,
            'control-block-padding',
            size,
            modePair(aliases),
            `control-tightness:${tightness}`,
            `Control block padding ${size}, tightness ${tightness}`,
        ));
    }
}
for (const [size, definition] of Object.entries(contract.controls.sizeRoles)) {
    const lineHeightAliases = contract.typography.lineHeights[
        definition.lineHeightRole
    ];
    const paddingAliases = contract.controls.tightness.default[size];
    entries.push(entry(
        `simai.vertical-sizing.control.height.${size}`,
        `--sf-ui-${cssRole(size)}--control-height`,
        'control-height',
        size,
        {
            mobile: {
                alias: `formula:${lineHeightAliases.mobile}+2*${paddingAliases.mobile}`,
                px: px(lineHeightAliases.mobile) + 2 * px(paddingAliases.mobile),
            },
            desktop: {
                alias: `formula:${lineHeightAliases.desktop}+2*${paddingAliases.desktop}`,
                px: px(lineHeightAliases.desktop) + 2 * px(paddingAliases.desktop),
            },
        },
        'representative-controls',
        `Default control height ${size}`,
    ));
}

entries.sort((left, right) => left.stableId.localeCompare(right.stableId));
const registry: SfAutocompleteRegistry = {
    schemaVersion: '1.0.0',
    registryId: 'simai.sf-autocomplete',
    registryVersion: contract.meta.version,
    source: {
        contractId: contract.meta.contractId,
        contractVersion: contract.meta.version,
        sha256: pointer.sha256,
        repository: pointer.sourceRepository,
        commit: pointer.sourceCommit,
        tree: pointer.sourceTree,
        path: pointer.sourcePath,
    },
    modes: contract.modes,
    scope: contract.scope,
    entries,
};

validateRegistry(registry);
const serialized = `${JSON.stringify(registry, null, 2)}\n`;
if (process.argv.includes('--check')) {
    const actual = fs.existsSync(outputPath)
        ? fs.readFileSync(outputPath, 'utf8')
        : null;
    if (actual !== serialized) {
        process.stderr.write('src/registry/sf-autocomplete.json is stale\n');
        process.exitCode = 1;
    } else {
        process.stdout.write(
            `sf-autocomplete parity PASS ${pointer.sha256}\n`,
        );
    }
} else {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized);
    process.stdout.write(
        `generated ${entries.length} registry entries from ${pointer.sha256}\n`,
    );
}
