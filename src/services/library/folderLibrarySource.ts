import { TFile, type App } from 'obsidian';
import type { FieldDefinition } from '../../types';
import type { LibraryDefinition, LibraryItem } from './types';

/** Reads Markdown notes from a custom library folder and exposes frontmatter as values. */
export class FolderLibrarySource {
    constructor(private readonly app: App) {}

    async load(definition: LibraryDefinition): Promise<LibraryItem[]> {
        if (definition.source.kind !== 'folder') return [];

        const folder = normalizeFolder(definition.source.folder);
        const files = this.app.vault.getMarkdownFiles()
            .filter((file) => isInFolder(file.path, folder));

        return files.map((file) => this.toLibraryItem(file, definition.schema.fields, definition.schema.titleField));
    }

    private toLibraryItem(file: TFile, fields: FieldDefinition[], titleField?: string): LibraryItem {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter ?? {};
        const values: Record<string, unknown> = {
            name: frontmatter.title ?? frontmatter.name ?? file.basename,
            filePath: file.path,
        };

        for (const field of fields) {
            const key = field.id.startsWith('yaml:') ? field.id.slice(5) : field.id;
            const value = frontmatter[key];
            values[field.id] = value;
            if (field.source === 'yaml') values[key] = value;
        }

        if (titleField) {
            values.name = values[titleField] ?? frontmatter[titleField] ?? values.name;
        }

        return { file, values };
    }
}

function normalizeFolder(folder: string): string {
    return folder.trim().replace(/^\/+|\/+$/g, '');
}

function isInFolder(path: string, folder: string): boolean {
    if (!folder) return true;
    return path === folder || path.startsWith(`${folder}/`);
}
