import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { LibraryManager } from './LibraryManager';

function createApp(): App {
    return {
        vault: {
            getMarkdownFiles: () => [],
        },
        metadataCache: {
            getFileCache: () => null,
        },
    } as unknown as App;
}

describe('LibraryManager', () => {
    it('registers built-in libraries and restores custom libraries without replacing settings', async () => {
        const stored = {
            language: 'en',
            customLibraries: [
                {
                    kind: 'custom',
                    id: 'bookshelf',
                    name: 'My Books',
                    icon: 'library',
                    source: { kind: 'folder', folder: 'Library/Books' },
                    schema: { fields: [] },
                },
            ],
        };
        const saveData = vi.fn(async (value: unknown) => Object.assign(stored, value as object));
        const manager = new LibraryManager(createApp(), () => stored, saveData);

        await manager.load();

        expect(manager.registry.has('game')).toBe(true);
        expect(manager.registry.has('manga')).toBe(true);
        expect(manager.registry.get('bookshelf')?.name).toBe('My Books');

        await manager.renameCustomLibrary('bookshelf', 'Reading List');

        expect(saveData).toHaveBeenCalledTimes(1);
        expect(stored.language).toBe('en');
        expect((stored.customLibraries as Array<{ name: string }>)[0].name).toBe('Reading List');
    });

    it('creates and persists custom fields with YAML ids and type-appropriate default operators', async () => {
        const stored: Record<string, unknown> = { language: 'en' };
        const saveData = vi.fn(async (value: unknown) => Object.assign(stored, value as object));
        const manager = new LibraryManager(createApp(), () => stored, saveData);

        const definition = await manager.createCustomLibrary({
            id: 'wishlist',
            name: 'Wishlist',
            folder: 'Wishlist',
            fields: [
                { id: 'priority', label: 'Priority', type: 'number' },
                { id: 'genres', label: 'Genres', type: 'list' },
            ],
        });

        expect(definition.schema.fields).toEqual([
            expect.objectContaining({ id: 'yaml:priority', type: 'number', source: 'yaml' }),
            expect.objectContaining({ id: 'yaml:genres', type: 'list', source: 'yaml' }),
        ]);
        expect(definition.schema.fields[0].operators).toContain('between');
        expect(definition.schema.fields[1].operators).toContain('containsAll');
        expect(stored).toEqual(expect.objectContaining({
            language: 'en',
            customLibraries: [expect.objectContaining({ id: 'wishlist', kind: 'custom' })],
        }));
    });

    it('lists built-in and custom libraries separately', async () => {
        const stored = {
            customLibraries: [
                {
                    kind: 'custom',
                    id: 'wishlist',
                    name: 'Wishlist',
                    icon: 'library',
                    source: { kind: 'folder', folder: 'Wishlist' },
                    schema: { fields: [] },
                },
            ],
        };
        const manager = new LibraryManager(createApp(), () => stored, async () => undefined);

        await manager.load();

        expect(manager.listLibraries().map((library) => library.id)).toEqual([
            'game', 'anime', 'movie', 'series', 'book', 'manga', 'wishlist',
        ]);
        expect(manager.listCustomLibraries().map((library) => library.id)).toEqual(['wishlist']);
    });

    it('normalizes folder and schema references when creating a custom library', async () => {
        const stored: Record<string, unknown> = {};
        const manager = new LibraryManager(createApp(), () => stored, async (value) => Object.assign(stored, value as object));

        const definition = await manager.createCustomLibrary({
            id: '  notes  ',
            name: '  Notes  ',
            folder: '/Library/Notes/',
            fields: [{ id: 'author', label: 'Author', type: 'text' }],
            titleField: 'author',
        });

        expect(definition.id).toBe('notes');
        expect(definition.name).toBe('Notes');
        expect(definition.source).toEqual({ kind: 'folder', folder: 'Library/Notes' });
        expect(definition.schema.titleField).toBe('yaml:author');
    });

    it('rejects duplicate ids, duplicate fields, and unknown schema references', async () => {
        const manager = new LibraryManager(createApp(), () => ({}), async () => undefined);

        await expect(manager.createCustomLibrary({ id: 'game', name: 'Games', folder: 'Games' })).rejects.toThrow('Library already exists: game');
        await expect(manager.createCustomLibrary({
            id: 'custom', name: 'Custom', folder: 'Custom',
            fields: [
                { id: 'rating', label: 'Rating', type: 'number' },
                { id: 'yaml:rating', label: 'Rating 2', type: 'number' },
            ],
        })).rejects.toThrow('Duplicate library field: yaml:rating');
        await expect(manager.createCustomLibrary({
            id: 'custom', name: 'Custom', folder: 'Custom',
            titleField: 'missing',
        })).rejects.toThrow('Unknown title field: yaml:missing');
    });
});
