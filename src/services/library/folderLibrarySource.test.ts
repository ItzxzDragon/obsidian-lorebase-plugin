import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition } from '../../types';
import type { LibraryDefinition } from './types';
import { FolderLibrarySource } from './folderLibrarySource';

const definition: LibraryDefinition = {
    id: 'custom',
    name: 'Custom',
    icon: 'library',
    source: { kind: 'folder', folder: 'Library' },
    schema: {
        titleField: 'yaml:title',
        fields: [
            { id: 'yaml:title', label: 'Title', icon: 'type', type: 'text', source: 'yaml', operators: ['contains'] },
            { id: 'yaml:rating', label: 'Rating', icon: 'star', type: 'number', source: 'yaml', operators: ['greater'] },
            { id: 'yaml:tags', label: 'Tags', icon: 'tags', type: 'list', source: 'yaml', operators: ['contains'] },
        ],
    },
};

function createApp(files: Array<{ path: string; basename: string; frontmatter: Record<string, unknown> }>) {
    const markdownFiles = files.map((file) => ({
        path: file.path,
        basename: file.basename,
    }));
    return {
        vault: {
            getMarkdownFiles: vi.fn().mockReturnValue(markdownFiles),
        },
        metadataCache: {
            getFileCache: vi.fn((file: { path: string }) => {
                const match = files.find((entry) => entry.path === file.path);
                return match ? { frontmatter: match.frontmatter } : null;
            }),
        },
    } as never;
}

describe('FolderLibrarySource', () => {
    it('loads only notes inside the configured folder and maps schema values', async () => {
        const app = createApp([
            { path: 'Library/One.md', basename: 'One', frontmatter: { title: 'First', rating: 8, tags: ['rpg', 'co-op'] } },
            { path: 'Library/Sub/Two.md', basename: 'Two', frontmatter: { title: 'Second', rating: 9, tags: ['strategy'] } },
            { path: 'Other/Three.md', basename: 'Three', frontmatter: { title: 'Ignored', rating: 10 } },
        ]);
        const source = new FolderLibrarySource(app);

        const items = await source.load(definition);

        expect(items.map((item) => item.file.path)).toEqual(['Library/One.md', 'Library/Sub/Two.md']);
        expect(items[0].values).toMatchObject({
            name: 'First',
            'yaml:title': 'First',
            title: 'First',
            'yaml:rating': 8,
            rating: 8,
            'yaml:tags': ['rpg', 'co-op'],
            tags: ['rpg', 'co-op'],
        });
    });

    it('uses the configured title field and falls back to the file basename', async () => {
        const app = createApp([
            { path: 'Library/NoTitle.md', basename: 'NoTitle', frontmatter: { rating: 5 } },
            { path: 'Library/Named.md', basename: 'Named', frontmatter: { title: 'Named Title' } },
        ]);
        const source = new FolderLibrarySource(app);
        const fields: FieldDefinition[] = definition.schema.fields;

        const items = await source.load({
            ...definition,
            schema: { ...definition.schema, fields },
        });

        expect(items[0].values.name).toBe('NoTitle');
        expect(items[1].values.name).toBe('Named Title');
    });

    it('accepts a leading or trailing slash in the configured folder', async () => {
        const app = createApp([
            { path: 'Library/One.md', basename: 'One', frontmatter: {} },
        ]);
        const source = new FolderLibrarySource(app);

        const items = await source.load({
            ...definition,
            source: { kind: 'folder', folder: '/Library/' },
        });

        expect(items).toHaveLength(1);
    });
});
