import { DocsPages, familyPage, pagesFromSitemap, tagPage } from '../generate/docsPages';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { detectCompletionRequest } from '../completion';
import { analyzeDocument, distance, nearestName } from '../diagnostics';
import { createIndex, describeTag, docsLink } from '../framework';
import { buildSnippets } from '../generate/snippets';
import { validateFrameworkRegistry } from '../registry/frameworkValidation';
import { validateRegistry } from '../registry/validation';

const readJson = (file: string): unknown =>
    JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'));
const framework = validateFrameworkRegistry(readJson('data/sf-framework.json'));
const index = createIndex(framework, validateRegistry(readJson('data/sf-autocomplete.json')));
const codes = (text: string, language = 'html'): string[] =>
    analyzeDocument(text, language, index).map(item => `${item.code}:${item.name}->${item.replacement}`);

test('edit distance and nearest names', () => {
    assert.equal(distance('appearence', 'appearance', 2), 1);
    assert.equal(distance('abc', 'xyz12345', 2), 3);
    assert.equal(nearestName('sf-buton', ['sf-button', 'sf-input']), 'sf-button');
    assert.equal(nearestName('sf-mywidget', ['sf-button', 'sf-input']), null);
});

test('misspelt tokens get a replacement; own and internal tokens do not', () => {
    assert.deepEqual(codes('.a { color: var(--sf-primay); }', 'css'), [
        'unknown-token:--sf-primay->--sf-primary',
    ]);
    assert.deepEqual(codes('.a { color: var(--sf-primary); gap: var(--sf-space-1\\/2); }', 'css'), []);
    // A project's own variable and a component-internal token are left alone.
    assert.deepEqual(codes('.a { color: var(--sf-brand-accent); --x: var(--sf-button--background-color); }', 'css'), []);
    // Public variables of components that are not suggested are still real names.
    assert.deepEqual(codes('.a { color: var(--sf-badge-color); }', 'css'), []);
});

test('misspelt tags get a replacement; real unsuggested tags do not', () => {
    assert.deepEqual(codes('<sf-buton></sf-buton>'), ['unknown-tag:sf-buton->sf-button']);
    assert.deepEqual(codes('<sf-alert></sf-alert><sf-badge></sf-badge>'), []);
    assert.deepEqual(codes('<sf-my-widget></sf-my-widget>'), []);
});

test('attributes: typos, deprecations and global or binding attributes', () => {
    assert.deepEqual(codes('<sf-button apperance="tonal"></sf-button>'), [
        'unknown-attribute:apperance->appearance',
    ]);
    assert.deepEqual(codes('<sf-context-menu\n  position="top"></sf-context-menu>'), [
        'deprecated-attribute:position->null',
    ]);
    assert.deepEqual(
        codes('<sf-button id="a" class="flex" data-x="1" aria-label="Go" onClick={() => go({a: 1})} :size="s" @click="go" v-if="ok" wire:click="save" x-data="{}" slot="end" size="1"></sf-button>', 'vue'),
        [],
    );
    assert.deepEqual(codes('<sf-button {{ $attributes }} size="{{ $size }}"></sf-button>', 'blade'), []);
});

test('deprecations are reported with the configured kind', () => {
    const [finding] = analyzeDocument('<sf-context-menu position="top">', 'html', index);
    assert.equal(finding.kind, 'deprecated');
    assert.match(finding.message, /deprecated since 1\.3\.0: openFor/);
});

test('documentation links need a real page and an https base URL', () => {
    const page = '/ru/smart-components/actions/buttons/';
    assert.equal(docsLink('', page), null);
    assert.equal(docsLink('http://insecure.example', page), null);
    assert.equal(docsLink('https://docs.example', null), null);
    assert.equal(docsLink('https://docs.example/sf/', page), `https://docs.example/sf${page}`);
    const button = index.tagByName.get('sf-button')!;
    assert.doesNotMatch(describeTag(index, button), /SIMAI Framework docs/);
    assert.ok(describeTag(index, button, 'https://docs.example').includes(
        `[SIMAI Framework docs](https://docs.example${page})`,
    ));
});

test('every link target in the data is a page the documentation site lists', () => {
    const recorded = (JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', '..', 'contracts', 'docs-pages.json'), 'utf8',
    )) as DocsPages).pages;
    const targets = [
        ...index.framework.tags.flatMap(tag => (tag.page ? [tag.page] : [])),
        ...Object.values(index.framework.utilityPages),
    ];
    assert.ok(targets.length > 50, 'expected the data to link to many pages');
    for (const target of targets) assert.ok(recorded.includes(target), `not on the site: ${target}`);
    assert.ok(!targets.some(target => /smart\.|utility\.|component\./.test(target)), 'a registry ID is not a page');
});

test('registry names map to the site\'s own page names', () => {
    const pages = [
        '/ru/smart-components/actions/buttons/',
        '/ru/smart-components/overlays/modal/',
        '/ru/utilities/spacing/margin/',
    ];
    assert.equal(tagPage(pages, 'sf-button', 'smart.buttons'), pages[0]);
    assert.equal(tagPage(pages, 'sf-button', 'smart.button'), pages[0]);
    assert.equal(tagPage(pages, 'sf-modal', 'smart.modal'), pages[1]);
    assert.equal(tagPage(pages, 'sf-unknown', 'smart.unknown'), null);
    assert.equal(familyPage(pages, 'margin-ext'), pages[2]);
    assert.equal(familyPage(pages, 'absent'), null);
    assert.deepEqual(
        pagesFromSitemap(
            '<loc>https://site.example/ru/utilities/</loc><loc>https://site.example/ru/utilities/a/b/</loc>'
            + '<loc>https://site.example/ru/guide/x/</loc><loc>https://other.example/ru/utilities/c/d/</loc>',
            'https://site.example',
        ),
        ['/ru/utilities/a/b/'],
    );
});

test('snippets use only names from the snapshot', () => {
    const snippets = buildSnippets(framework);
    assert.deepEqual(
        Object.values(snippets).map(item => item.prefix),
        [
            'sf-field',
            'sf-checkbox-field',
            'sf-button-submit',
            'sf-buttons',
            'sf-select',
            'sf-modal-dialog',
            'sf-pagination-bar',
        ],
    );
    const broken = structuredClone(framework);
    broken.tags.find(tag => tag.tag === 'sf-input')!.attributes =
        broken.tags.find(tag => tag.tag === 'sf-input')!.attributes.filter(item => item.name !== 'hint');
    assert.throws(() => buildSnippets(broken), /sf-input has no current hint attribute/);
    const noClass = structuredClone(framework);
    noClass.classes = noClass.classes.filter(item => item.name !== 'g-1/2');
    assert.throws(() => buildSnippets(noClass), /class g-1\/2 is not in the snapshot/);
});

test('Blade and PHP templates complete classes in class attributes', () => {
    for (const language of ['blade', 'php']) {
        assert.deepEqual(detectCompletionRequest('<div class="md:fl', 17, language), {
            context: 'htmlClass',
            prefix: 'md:fl',
            replaceLength: 5,
        });
    }
});
