/*
 * Snippets for common SIMAI Framework constructs. Each one names the tags,
 * attributes, attribute values and utility classes it uses; buildSnippets
 * refuses to emit a snippet that uses anything the snapshot does not have,
 * so a repin that drops a name fails the generator instead of shipping a
 * broken snippet.
 *
 * A table snippet is missing on purpose: the Framework registry does not mark
 * a table component as safe to suggest yet.
 */
import { FrameworkRegistry } from '../registry/frameworkTypes';

interface SnippetSpec {
    name: string;
    prefix: string;
    description: string;
    body: string[];
    uses: {
        tag: string;
        attributes: string[];
        /** attribute → values the body uses as fixed text or choices. */
        values?: Record<string, string[]>;
    }[];
    classes?: string[];
}

const specs: SnippetSpec[] = [
    {
        name: 'SIMAI Framework form field',
        prefix: 'sf-field',
        description: 'A labelled sf-input with a hint.',
        body: [
            '<sf-input',
            '  label="${1:Label}"',
            '  name="${2:name}"',
            '  input-type="${3|text,email,password,search,tel,url|}"',
            '  placeholder="${4}"',
            '  hint="${5}"',
            '  ${6:required}',
            '></sf-input>$0',
        ],
        uses: [{
            tag: 'sf-input',
            attributes: ['label', 'name', 'input-type', 'placeholder', 'hint', 'required'],
            values: { 'input-type': ['text', 'email', 'password', 'search', 'tel', 'url'] },
        }],
    },
    {
        name: 'SIMAI Framework checkbox',
        prefix: 'sf-checkbox-field',
        description: 'A labelled sf-checkbox.',
        body: [
            '<sf-checkbox label="${1:Label}" name="${2:name}" value="${3:1}"></sf-checkbox>$0',
        ],
        uses: [{ tag: 'sf-checkbox', attributes: ['label', 'name', 'value'] }],
    },
    {
        name: 'SIMAI Framework button',
        prefix: 'sf-button-submit',
        description: 'An sf-button that submits its form.',
        body: [
            '<sf-button appearance="${1|default,tonal,outline,link,surface|}" native-type="submit" text="${2:Save}"></sf-button>$0',
        ],
        uses: [{
            tag: 'sf-button',
            attributes: ['appearance', 'native-type', 'text'],
            values: {
                appearance: ['default', 'tonal', 'outline', 'link', 'surface'],
                'native-type': ['submit'],
            },
        }],
    },
    {
        name: 'SIMAI Framework button group',
        prefix: 'sf-buttons',
        description: 'A row of sf-button elements laid out with the flex and gap utilities.',
        body: [
            '<div class="flex g-1/2">',
            '  <sf-button appearance="default" text="${1:Save}"></sf-button>',
            '  <sf-button appearance="outline" text="${2:Cancel}"></sf-button>',
            '</div>$0',
        ],
        uses: [{
            tag: 'sf-button',
            attributes: ['appearance', 'text'],
            values: { appearance: ['default', 'outline'] },
        }],
        classes: ['flex', 'g-1/2'],
    },
    {
        name: 'SIMAI Framework select',
        prefix: 'sf-select',
        description: 'An sf-dropdown in select mode.',
        body: [
            '<sf-dropdown mode="select" label="${1:Label}" name="${2:name}" placeholder="${3:Choose}"></sf-dropdown>$0',
        ],
        uses: [{
            tag: 'sf-dropdown',
            attributes: ['mode', 'label', 'name', 'placeholder'],
            values: { mode: ['select'] },
        }],
    },
    {
        name: 'SIMAI Framework modal',
        prefix: 'sf-modal-dialog',
        description: 'An sf-modal with an id, a title and a position.',
        body: [
            '<sf-modal modal-id="${1:example}" title="${2:Title}" position="${3|center,left,right,top,bottom|}">',
            '  ${4:Content}',
            '</sf-modal>$0',
        ],
        uses: [{
            tag: 'sf-modal',
            attributes: ['modal-id', 'title', 'position'],
            values: { position: ['center', 'left', 'right', 'top', 'bottom'] },
        }],
    },
    {
        name: 'SIMAI Framework pagination',
        prefix: 'sf-pagination-bar',
        description: 'An sf-pagination with the current page and page size.',
        body: [
            '<sf-pagination current="${1:1}" page-size="${2:20}" show-page-size></sf-pagination>$0',
        ],
        uses: [{ tag: 'sf-pagination', attributes: ['current', 'page-size', 'show-page-size'] }],
    },
];

export interface VsCodeSnippet {
    prefix: string;
    description: string;
    body: string[];
}

export function buildSnippets(registry: FrameworkRegistry): Record<string, VsCodeSnippet> {
    const result: Record<string, VsCodeSnippet> = {};
    const classes = new Set(registry.classes.map(item => item.name));
    for (const spec of specs) {
        for (const use of spec.uses) {
            const tag = registry.tags.find(item => item.tag === use.tag);
            if (!tag) throw new Error(`snippet ${spec.prefix}: ${use.tag} is not in the snapshot`);
            if (tag.deprecated) throw new Error(`snippet ${spec.prefix}: ${use.tag} is deprecated`);
            for (const name of use.attributes) {
                const attribute = tag.attributes.find(item => item.name === name);
                if (!attribute || attribute.deprecated) {
                    throw new Error(`snippet ${spec.prefix}: ${use.tag} has no current ${name} attribute`);
                }
                for (const value of use.values?.[name] ?? []) {
                    if (attribute.values.length > 0 && !attribute.values.includes(value)) {
                        throw new Error(`snippet ${spec.prefix}: ${use.tag} ${name} has no value ${value}`);
                    }
                }
            }
        }
        for (const name of spec.classes ?? []) {
            if (!classes.has(name)) throw new Error(`snippet ${spec.prefix}: class ${name} is not in the snapshot`);
        }
        result[spec.name] = {
            prefix: spec.prefix,
            description: `${spec.description} (SIMAI Framework ${registry.release.id})`,
            body: spec.body,
        };
    }
    return result;
}
