/*
 * Maps SIMAI Framework names to real pages of the documentation site. The
 * site's paths follow its own navigation (group folders, plural page names),
 * not registry IDs, so a link is only ever built from a page the site lists.
 */

export interface DocsPages {
    site: string;
    pages: string[];
}

const sections = ['/ru/components/', '/ru/smart-components/', '/ru/utilities/'];

/** Page paths of the reference sections from the text of a sitemap. */
export function pagesFromSitemap(xml: string, site: string): string[] {
    const pages = new Set<string>();
    for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
        if (!match[1].startsWith(`${site}/`)) continue;
        const page = match[1].slice(site.length);
        if (sections.some(section => page.startsWith(section) && page !== section)) pages.add(page);
    }
    return [...pages].sort();
}

const pageNamed = (pages: string[], section: string, names: string[]): string | null => {
    for (const name of names) {
        const found = pages.filter(page => page.startsWith(section) && page.endsWith(`/${name}/`));
        if (found.length === 1) return found[0];
    }
    return null;
};

/** Smart component page of a tag. Page names are often plural: sf-button is buttons. */
export function tagPage(pages: string[], tag: string, id: string): string | null {
    const name = tag.replace(/^sf-/, '');
    const entry = id.replace(/^smart\./, '');
    return pageNamed(pages, '/ru/smart-components/', [name, `${name}s`, entry, `${entry}s`]);
}

/** Utility page of a utility family. The -ext families extend the base page. */
export function familyPage(pages: string[], family: string): string | null {
    return pageNamed(pages, '/ru/utilities/', [family, family.replace(/-ext$/, '')]);
}
