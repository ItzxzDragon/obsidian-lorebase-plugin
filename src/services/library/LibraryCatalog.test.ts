import { describe, expect, it } from 'vitest';
import type { LibraryDefinition } from './types';
import { LibraryCatalog } from './LibraryCatalog';
import { LibraryRegistry } from './LibraryRegistry';

const customLibrary = (id = 'bookshelf'): Omit<LibraryDefinition & { kind?: 'custom' }, 'kind'> => ({
    id,
    name: '  My Books  ',
    icon: 'library',
    source: { kind: 'folder', folder: 'Books' },
    schema: {
        fields: [{
            id: 'author',
            label: 'Author',
            icon: 'user',
            type: 'text',
            source: 'yaml',
            operators: ['contains'],
        }],
    },
});

describe('LibraryCatalog', () => {
    it('creates, renames, removes, and persists only custom libraries', async () => {
        const registry = new LibraryRegistry();
        registry.register({
            id: 'game',
            name: 'Games',
            icon: 'gamepad-2',
            source: { kind: 'builtin', mediaType: 'game' },
            mediaType: 'game',
            schema: { fields: [] },
        });
        let saved: unknown;
        const catalog = new LibraryCatalog(registry, () => [], (value) => { saved = value; });

        const created = catalog.create(customLibrary());
        expect(created.kind).toBe('custom');
        expect(catalog.rename('bookshelf', '  Reading  ').name).toBe('Reading');
        await catalog.saveCustomLibraries();

        expect(saved).toEqual([expect.objectContaining({ id: 'bookshelf', name: 'Reading', kind: 'custom' })]);
        expect((saved as LibraryDefinition[]).some((entry) => entry.id === 'game')).toBe(false);

        expect(catalog.remove('bookshelf')).toBe(true);
        expect(registry.has('bookshelf')).toBe(false);
    });

    it('loads valid definitions and ignores malformed entries', async () => {
        const registry = new LibraryRegistry();
        const catalog = new LibraryCatalog(registry, () => [
            { kind: 'custom', id: 'valid', name: 'Valid', source: { kind: 'folder', folder: 'Vault/Books' }, schema: { fields: [] } },
            { kind: 'custom', id: '', name: 'Invalid', source: { kind: 'folder', folder: 'Nope' }, schema: { fields: [] } },
            { kind: 'builtin', id: 'game', name: 'Games' },
        ], () => undefined);

        await catalog.loadCustomLibraries();

        expect(registry.get('valid')?.name).toBe('Valid');
        expect(registry.has('')).toBe(false);
        expect(registry.has('game')).toBe(false);
    });

    it('does not allow custom operations on built-in libraries', () => {
        const registry = new LibraryRegistry();
        registry.register({
            id: 'game',
            name: 'Games',
            icon: 'gamepad-2',
            source: { kind: 'builtin', mediaType: 'game' },
            mediaType: 'game',
            schema: { fields: [] },
        });
        const catalog = new LibraryCatalog(registry, () => [], () => undefined);

        expect(() => catalog.rename('game', 'Broken')).toThrow('Custom library not found: game');
        expect(() => catalog.remove('game')).toThrow('Custom library not found: game');
    });
});
