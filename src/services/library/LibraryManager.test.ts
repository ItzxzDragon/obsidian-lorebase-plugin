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

    it('creates custom fields with YAML ids and type-appropriate default operators', () => {
        const manager = new LibraryManager(createApp(), () => ({}), async () => undefined);

        const definition = manager.createCustomLibrary({
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
    });
});
