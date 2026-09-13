import type { App, CachedMetadata, TFile } from 'obsidian';
import type { FieldDefinition } from '../../types';
import type { LibraryDefinition, LibraryItem } from './types';

const SPECIAL_PROPERTIES = ['$file.name', '$file.path', '$file.ctime', '$file.mtime', '$file.size'];

/** Loads Markdown entries from a custom library folder into the shared library model. */
export class FolderLibrarySource {
    constructor(private readonly app: App) {}

    async load(definition: LibraryDefinition): Promise<LibraryItem[]> {
        if (definition.source.kind !== 'folder') return [];

        const folder = normalizeFolder(definition.source.folder);
        const files = this.app.vault.getMarkdownFiles()
            .filter((file) => isInsideFolder(file.path, folder));

        return files.map((file) => this.toLibraryItem(file, definition.schema.fields, definition.schema.titleField, definition.schema.coverField));
    }

    /** Returns properties available to the library's schema editor. */
    getAvailableProperties(definition: LibraryDefinition): string[] {
        if (definition.source.kind !== 'folder') return [];

        const folder = normalizeFolder(definition.source.folder);
        const files = this.app.vault.getMarkdownFiles()
            .filter((file) => definition.propertyScope === 'vault' || isInsideFolder(file.path, folder));
        const properties = new Set<string>(SPECIAL_PROPERTIES);

        for (const file of files) {
            const frontmatter = getLibraryFrontmatter(this.app.metadataCache.getFileCache(file));
            for (const key of Object.keys(frontmatter)) properties.add(key);
        }

        return Array.from(properties).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    private toLibraryItem(
        file: TFile,
        fields: FieldDefinition[],
        titleField?: string,
        coverField?: string,
    ): LibraryItem {
        const frontmatter = getLibraryFrontmatter(this.app.metadataCache.getFileCache(file));
        const values: Record<string, unknown> = {
            ...frontmatter,
            '$file.name': file.basename,
            '$file.path': file.path,
            '$file.ctime': file.stat.ctime,
            '$file.mtime': file.stat.mtime,
            '$file.size': file.stat.size,
            name: frontmatter.title ?? frontmatter.name ?? file.basename,
        };

        for (const field of fields) {
            const value = propertyValue(frontmatter, file, field.id);
            values[field.id] = value;
            if (field.source === 'yaml' && !field.id.startsWith('$file.')) {
                values[field.id.replace(/^yaml:/, '')] = value;
            }
        }

        if (titleField) {
            values.name = propertyValue(frontmatter, file, titleField) ?? values.name;
        }
        if (coverField) {
            values.cover = propertyValue(frontmatter, file, coverField) ?? null;
        }

        return { file, values };
    }
}

function normalizeFolder(folder: string): string {
    return folder.trim().replace(/^\/+|\/+$/g, '');
}

function isInsideFolder(path: string, folder: string): boolean {
    if (!folder) return true;
    return path === folder || path.startsWith(`${folder}/`);
}

function propertyValue(frontmatter: Record<string, unknown>, file: TFile, property: string): unknown {
    const id = property.replace(/^yaml:/, '');
    switch (id) {
        case '$file.name': return file.basename;
        case '$file.path': return file.path;
        case '$file.ctime': return file.stat.ctime;
        case '$file.mtime': return file.stat.mtime;
        case '$file.size': return file.stat.size;
        default: return readProperty(frontmatter, id);
    }
}

function readProperty(frontmatter: Record<string, unknown>, key: string): unknown {
    if (Object.prototype.hasOwnProperty.call(frontmatter, key)) return frontmatter[key];
    const normalized = key.toLocaleLowerCase();
    const actual = Object.keys(frontmatter).find((candidate) => candidate.toLocaleLowerCase() === normalized);
    return actual ? frontmatter[actual] : undefined;
}

/** Reads frontmatter without exposing Obsidian's cache object to library consumers. */
export function getLibraryFrontmatter(cache: CachedMetadata | null): Record<string, unknown> {
    return cache?.frontmatter ? { ...cache.frontmatter } : {};
}
