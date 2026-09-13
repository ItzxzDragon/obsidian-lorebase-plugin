import type { App, CachedMetadata, TFile } from 'obsidian';
import type { FieldDefinition } from '../../types';
import type { LibraryDefinition, LibraryItem } from './types';

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
            const key = field.id.startsWith('yaml:') ? field.id.slice(5) : field.id;
            const value = readProperty(frontmatter, key);
            values[field.id] = value;
            if (field.source === 'yaml') values[key] = value;
        }

        if (titleField) {
            values.name = values[titleField] ?? readProperty(frontmatter, titleField.replace(/^yaml:/, '')) ?? values.name;
        }
        if (coverField) {
            values.cover = values[coverField] ?? readProperty(frontmatter, coverField.replace(/^yaml:/, '')) ?? null;
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
