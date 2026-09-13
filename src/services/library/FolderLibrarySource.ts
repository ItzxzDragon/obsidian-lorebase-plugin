import type { App, CachedMetadata, TFile } from 'obsidian';
import type { LibraryDefinition, LibraryItem } from './types';

/** Loads Markdown entries from a custom library folder into the shared library model. */
export class FolderLibrarySource {
    constructor(private readonly app: App) {}

    async load(definition: LibraryDefinition): Promise<LibraryItem[]> {
        if (definition.source.kind !== 'folder') return [];

        const folder = normalizeFolder(definition.source.folder);
        const files = this.app.vault.getMarkdownFiles()
            .filter((file) => isInsideFolder(file.path, folder));

        return files.map((file) => this.toLibraryItem(file));
    }

    private toLibraryItem(file: TFile): LibraryItem {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter ?? {};
        return {
            file,
            values: {
                ...frontmatter,
                '$file.name': file.basename,
                '$file.path': file.path,
                '$file.ctime': file.stat.ctime,
                '$file.mtime': file.stat.mtime,
                '$file.size': file.stat.size,
            },
        };
    }
}

function normalizeFolder(folder: string): string {
    return folder.trim().replace(/^\/+|\/+$/g, '');
}

function isInsideFolder(path: string, folder: string): boolean {
    if (!folder) return true;
    return path === folder || path.startsWith(`${folder}/`);
}

/** Reads frontmatter without exposing Obsidian's cache object to library consumers. */
export function getLibraryFrontmatter(cache: CachedMetadata | null): Record<string, unknown> {
    return cache?.frontmatter ? { ...cache.frontmatter } : {};
}
