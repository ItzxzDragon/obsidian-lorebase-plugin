import { describe, expect, it } from 'vitest';
import { LibraryCatalog } from './LibraryCatalog';
import { LibraryRegistry } from './LibraryRegistry';

describe('LibraryCatalog', () => {
    it('loads only valid custom libraries', async () => {
        const registry = new LibraryRegistry();
        const catalog = new LibraryCatalog(
            registry,
            () => [
                {
                    kind: 'custom', id: 'books', name: 'Books', icon: 'book',
                    source: { kind: 'folder', folder: 'Books' }, schema: { fields: [] },
                },
                { kind: 'custom', id: '', name: 'Invalid', source: { kind: 'folder', folder: 'x' }, schema: { fields: [] } },
            ],
            () => undefined,
        );

        await catalog.loadCustomLibraries();
        expect(registry.has('books')).toBe(true);
        expect(registry.list()).toHaveLength(1);
    });

    it('creates, renames and removes custom libraries', async () => {
        const registry = new LibraryRegistry();
        const saved: unknown[] = [];
        const catalog = new LibraryCatalog(registry, () => [], (value) => saved.push(value));
        catalog.create({
            id: 'albums', name: 'Albums', icon: 'disc-3',
            source: { kind: 'folder', folder: 'Albums' }, schema: { fields: [] },
        });
        catalog.rename('albums', 'Music Albums');
        await catalog.saveCustomLibraries();

        expect(registry.get('albums')?.name).toBe('Music Albums');
        expect(saved).toHaveLength(1);
        expect(catalog.remove('albums')).toBe(true);
        expect(registry.has('albums')).toBe(false);
    });
});
