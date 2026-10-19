import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { detectCompletionRequest } from '../completion';
import { createIndex, describeToken, escapeClass, nearestColorTokens, toPx } from '../framework';
import { buildFramework, FrameworkInputs } from '../generate/buildFramework';
import { parseCss } from '../generate/css';
import { RawContractRegistry, RawRegistryEntry } from '../generate/frameworkInputs';
import { detectMarkupRequest } from '../markup';
import { formatColor, parseColor } from '../registry/color';
import { validateFrameworkRegistry } from '../registry/frameworkValidation';
import { validateRegistry } from '../registry/validation';
import { findHoverTarget } from '../targets';

const root = process.cwd();
const readJson = (file: string): unknown =>
    JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'));

/* ------------------------------------------------------------ fixtures */

const entry = (
    id: string,
    kind: RawRegistryEntry['kind'],
    name: string,
    runtime: RawRegistryEntry['runtime'] = {},
    lifecycle = 'released',
): RawRegistryEntry => ({
    id,
    kind,
    name,
    title: name,
    lifecycle,
    documentation_refs: ['simai/ui@a9636b60d3e330edc2736b41f3791ebf8d1be391:README.md'],
    provenance: { commit: 'a'.repeat(40), repository: 'https://github.com/simai/ui', source_refs: [] },
    runtime,
});

function fixture(): FrameworkInputs {
    const registry: RawContractRegistry = {
        schema_id: 'simai.framework.contract-registry',
        schema_version: 1,
        compatibility: { id: 'ui-a9636b60d3e3' },
        indexes: {
            safe_to_suggest: ['utility.display', 'smart.buttons', 'smart.retired', 'utility.blocked'],
            blocked: ['utility.blocked'],
        },
        entries: [
            entry('utility.display', 'utility', 'display'),
            entry('utility.blocked', 'utility', 'blocked'),
            entry('utility.hidden', 'utility', 'hidden'),
            entry('smart.buttons', 'smart-component', 'buttons', { tags: ['sf-button'] }, 'experimental'),
            entry('smart.retired', 'smart-component', 'retired', { tags: ['sf-retired'] }),
            entry('smart.unsafe', 'smart-component', 'unsafe', { tags: ['sf-unsafe'] }),
        ],
    };
    return {
        pointer: {
            releaseId: 'ui-a9636b60d3e3',
            repository: 'simai/ui',
            registryCommit: 'b'.repeat(40),
            runtime: {
                core: { commit: 'c'.repeat(40), tree: 'd'.repeat(40), runtimeTree: 'e'.repeat(40) },
                smart: { commit: 'f'.repeat(40), tree: 'd'.repeat(40), runtimeTree: 'e'.repeat(40) },
            },
            files: {},
        },
        registry,
        registrySha256: '0'.repeat(64),
        coreCss: `
            @layer sf.base {
              :root {
                --sf-blue-40: #005bbe;
                --sf-blue-80: #acc7ff;
                --sf-b2: 0.75rem;
                --sf-c0: 1rem;
                --sf-space-1\\/2: var(--sf-b2);
                --sf-ghost: var(--sf-missing);
              }
              @media (min-width: 60rem) {
                :root { --sf-space-1\\/2: var(--sf-c0); }
              }
              @media (min-width: 72rem) {
                :root { --sf-space-1\\/2: 2rem; }
              }
              .theme-light,
              .theme-dark {
                /* comment */
                --sf-primary: light-dark(var(--sf-blue-40), var(--sf-blue-80));
              }
              .sf-button { --sf-button--internal: 1px; }
            }`,
        publicVariables: {
            schema: 'simai.framework.public-variables',
            components: [
                {
                    component: 'button',
                    selector: '.sf-button',
                    variables: [{
                        name: '--sf-button-gap',
                        role: 'gap',
                        summary: 'Gap.',
                        default: 'var(--sf-space-1/2)',
                        since: '2026-10-13',
                    }],
                },
                {
                    component: 'unsafe',
                    selector: '.sf-unsafe',
                    variables: [{
                        name: '--sf-unsafe-color',
                        role: 'color',
                        summary: 'Colour.',
                        default: 'red',
                        since: '2026-10-13',
                    }],
                },
            ],
        },
        utilityCss: {
            'utility/display/default/css/default.css': '@layer sf.utilities { .flex { display: flex; } .hidden, .none { display: none; } }',
            'utility/display/md/css/md.css': '@layer sf.utilities { @media (min-width: 44rem) { .md\\:flex { display: flex; } .md\\:flex:hover { display: flex; } } }',
        },
        manifests: {
            'smart/buttons/smart.manifest.json': {
                id: 'smart.buttons',
                title: 'Buttons',
                summary: 'A button.',
                lifecycle: 'experimental',
                custom_element: 'sf-button',
                inputs: {
                    properties: {
                        size: { type: 'string', default: '1', enum: ['1/2', '1', '2'] },
                        status: { type: 'string', default: '', enum: ['', 'error'] },
                        loading: { type: 'boolean', default: false },
                        position: { type: 'string', default: '' },
                    },
                },
                compatibility: {
                    deprecations: [{ path: 'position', since: '1.3.0', replacement: 'openFor()' }],
                    replacement: null,
                },
            },
            'smart/retired/smart.manifest.json': {
                id: 'smart.retired',
                title: 'Retired',
                summary: 'Old.',
                lifecycle: 'experimental',
                custom_element: 'sf-retired',
                compatibility: { deprecations: [], replacement: 'smart.buttons' },
            },
        },
        desktopMinWidthPx: 960,
    };
}

/* -------------------------------------------------------------- generator */

test('generator suggests only safe, unblocked registry entries', () => {
    const { registry } = buildFramework(fixture());
    assert.deepEqual(registry.tags.map(tag => tag.tag), ['sf-button', 'sf-retired']);
    assert.deepEqual(
        registry.classes.map(item => item.name),
        ['flex', 'hidden', 'md:flex', 'none'],
    );
    assert.ok(registry.tokens.every(token => token.name !== '--sf-unsafe-color'));
    assert.ok(registry.tokens.every(token => token.name !== '--sf-button--internal'));
});

test('generator resolves light-dark and the desktop mode', () => {
    const { registry, report } = buildFramework(fixture());
    const primary = registry.tokens.find(token => token.name === '--sf-primary')!;
    assert.equal(primary.light, '#005bbe');
    assert.equal(primary.dark, '#acc7ff');
    assert.equal(primary.group, 'color');
    assert.deepEqual(primary.color, [0, 0.3569, 0.7451, 1]);

    const space = registry.tokens.find(token => token.name === '--sf-space-1\\/2')!;
    assert.equal(space.light, '0.75rem');
    assert.equal(space.desktop, '1rem');
    assert.deepEqual(report.ignoredTokenMedia, ['(min-width: 72rem)']);

    const ghost = registry.tokens.find(token => token.name === '--sf-ghost')!;
    assert.equal(ghost.light, 'var(--sf-missing)');
});

test('generator resolves unescaped references in public variable defaults', () => {
    const { registry, report } = buildFramework(fixture());
    const gap = registry.tokens.find(token => token.name === '--sf-button-gap')!;
    assert.equal(gap.source, 'component');
    assert.equal(gap.component, '.sf-button');
    assert.equal(gap.value, 'var(--sf-space-1/2)');
    assert.equal(gap.light, '0.75rem');
    assert.equal(gap.desktop, '1rem');
    assert.deepEqual(report.skippedPublicComponents, ['unsafe']);
});

test('generator keeps attributes, values and deprecations from the manifest', () => {
    const { registry } = buildFramework(fixture());
    const button = registry.tags.find(tag => tag.tag === 'sf-button')!;
    assert.equal(button.lifecycle, 'experimental');
    assert.equal(button.deprecated, null);
    assert.equal(
        button.docs[0],
        'https://github.com/simai/ui/blob/a9636b60d3e330edc2736b41f3791ebf8d1be391/README.md',
    );
    const size = button.attributes.find(attribute => attribute.name === 'size')!;
    assert.deepEqual(size.values, ['1/2', '1', '2']);
    const status = button.attributes.find(attribute => attribute.name === 'status')!;
    assert.deepEqual(status.values, ['error']);
    const position = button.attributes.find(attribute => attribute.name === 'position')!;
    assert.deepEqual(position.deprecated, { since: '1.3.0', replacement: 'openFor()' });

    const retired = registry.tags.find(tag => tag.tag === 'sf-retired')!;
    assert.deepEqual(retired.deprecated, { since: null, replacement: 'smart.buttons' });
});

test('generator rejects a registry bound to another release', () => {
    const inputs = fixture();
    inputs.registry.compatibility.id = 'ui-000000000000';
    assert.throws(() => buildFramework(inputs), /bound to ui-000000000000/);
});

test('generated classes keep media and merge pseudo-class rules', () => {
    const { registry } = buildFramework(fixture());
    const mdFlex = registry.classes.find(item => item.name === 'md:flex')!;
    assert.equal(mdFlex.breakpoint, 'md');
    assert.equal(mdFlex.media, '(min-width: 44rem)');
    assert.equal(mdFlex.declarations, 'display: flex;');
});

test('CSS reader handles comments, nesting and strings', () => {
    const rules = parseCss('/* a { } */ @layer x { @media (a) { .b, .c { color: red; content: "}"; } } .d { margin: 0 }');
    assert.deepEqual(rules, [
        { selector: '.b, .c', media: ['(a)'], declarations: [['color', 'red'], ['content', '"}"']] },
        { selector: '.d', media: [], declarations: [['margin', '0']] },
    ]);
});

/* ---------------------------------------------------- shipped registries */

test('shipped framework registry is pinned and only holds safe entries', () => {
    const framework = validateFrameworkRegistry(readJson('data/sf-framework.json'));
    const snapshot = readJson('contracts/framework/framework-contract-registry.json') as RawContractRegistry;
    const safe = new Set(snapshot.indexes.safe_to_suggest);
    const blocked = new Set(snapshot.indexes.blocked);
    assert.equal(framework.release.id, 'ui-a9636b60d3e3');
    assert.equal(framework.release.coreCommit, 'a9636b60d3e330edc2736b41f3791ebf8d1be391');
    for (const id of [...framework.tags.map(tag => tag.id), ...framework.classes.map(item => item.id)]) {
        assert.ok(safe.has(id) && !blocked.has(id), `${id} is not safe to suggest`);
    }
    assert.ok(framework.tags.length > 0);
    assert.ok(framework.classes.length > 500);
    assert.ok(framework.tokens.filter(token => token.color).length > 300);
});

test('index merges sizing contract data into core tokens', () => {
    const index = createIndex(
        validateFrameworkRegistry(readJson('data/sf-framework.json')),
        validateRegistry(readJson('data/sf-autocomplete.json')),
    );
    for (const entry of index.sizing.entries) {
        assert.ok(index.tokenByName.has(entry.cssName), `${entry.cssName} is not suggested`);
    }
    const space = index.tokenByName.get('--sf-space-1')!;
    const text = describeToken(index, space);
    assert.match(text, /mobile \| 12px \(0\.75rem\)/);
    assert.match(text, /simai\.vertical-sizing@1\.3\.0/);
    assert.match(text, /ui-a9636b60d3e3/);

    const nearest = nearestColorTokens(index, [0, 0.3569, 0.7451, 1], 5);
    assert.ok(nearest.some(token => token.name === '--sf-primary-40'));
});

/* ---------------------------------------------------------------- helpers */

test('colours parse and format for the suggest widget', () => {
    assert.deepEqual(parseColor('#fff'), [1, 1, 1, 1]);
    assert.deepEqual(parseColor('rgba(25,138,39,0.12157)'), [0.098, 0.5412, 0.1529, 0.1216]);
    assert.deepEqual(parseColor('rgb(0 0 0 / 50%)'), [0, 0, 0, 0.5]);
    assert.equal(parseColor('color-mix(in srgb, red, blue)'), null);
    assert.equal(formatColor([0, 0.3569, 0.7451, 1]), '#005bbe');
    assert.equal(formatColor([0.098, 0.5412, 0.1529, 0.1216]), 'rgba(25, 138, 39, 0.12)');
});

test('class names and sizes format for CSS', () => {
    assert.equal(escapeClass('md:w-1/2'), 'md\\:w-1\\/2');
    assert.equal(toPx('0.875rem'), '14px');
    assert.equal(toPx('calc(1px * 2)'), 'calc(1px * 2)');
});

test('class selectors complete only in stylesheets', () => {
    assert.deepEqual(detectCompletionRequest('.md\\:fl', 7, 'css'), {
        context: 'htmlClass',
        prefix: 'md\\:fl',
        replaceLength: 6,
        escaped: true,
    });
    assert.equal(detectCompletionRequest('document.bo', 11, 'typescript'), undefined);
    assert.equal(detectCompletionRequest('<p>The end.', 11, 'html'), undefined);
});

test('markup context finds tags, attributes and values', () => {
    assert.deepEqual(detectMarkupRequest('<div><sf-bu'), { kind: 'tag', prefix: 'sf-bu' });
    assert.deepEqual(detectMarkupRequest('<sf-button size="1" lo'), {
        kind: 'attribute',
        tag: 'sf-button',
        prefix: 'lo',
        present: ['size'],
    });
    assert.deepEqual(detectMarkupRequest('<sf-button\n  loading\n  size="1/'), {
        kind: 'value',
        tag: 'sf-button',
        attribute: 'size',
        prefix: '1/',
    });
    assert.deepEqual(detectMarkupRequest('<sf-button onClick={() => go()} '), {
        kind: 'attribute',
        tag: 'sf-button',
        prefix: '',
        present: ['onClick'],
    });
    assert.equal(detectMarkupRequest('<sf-button size="1">te'), undefined);
    assert.equal(detectMarkupRequest('<div class="a" '), undefined);
});

test('hover targets cover tokens, tags, attributes and classes', () => {
    assert.deepEqual(
        findHoverTarget('color: var(--sf-radius-1\\/2);', 15, 'css'),
        { kind: 'token', name: '--sf-radius-1\\/2', start: 11, end: 27 },
    );
    assert.deepEqual(
        findHoverTarget('.md\\:flex { }', 3, 'scss'),
        { kind: 'class', name: 'md:flex', start: 1, end: 9 },
    );
    assert.deepEqual(
        findHoverTarget('<sf-button size="1"></sf-button>', 4, 'html'),
        { kind: 'tag', name: 'sf-button', start: 1, end: 10 },
    );
    assert.deepEqual(
        findHoverTarget('  size="1">', 3, 'html', '<sf-button\n'),
        { kind: 'attribute', tag: 'sf-button', name: 'size', start: 2, end: 6 },
    );
    assert.deepEqual(
        findHoverTarget('<div className="flex md:flex">', 24, 'typescriptreact'),
        { kind: 'class', name: 'md:flex', start: 21, end: 28 },
    );
    assert.equal(findHoverTarget('<p>flex</p>', 5, 'html'), undefined);
});
