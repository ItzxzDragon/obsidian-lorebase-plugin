import { describe, expect, it } from 'vitest';
import { LibraryRegistry } from './LibraryRegistry';
import type { LibraryDefinition } from './types';

const gameLibrary: LibraryDefinition = {
    id: 'games',
    name: 'Games',
    icon: 'gamepad-2',
    source: { kind: 'folder', folder: 'Games' },
    schema: { fields: [] },
    mediaType: 'game',
};

describe('LibraryRegistry', () => {
    it('registers and retrieves a library', () => {
        const registry = new LibraryRegistry();
        registry.register(gameLibrary);

        expect(registry.has('games')).toBe(true);
        expect(registry.get('games')).toEqual(gameLibrary);
        expect(registry.list()).toHaveLength(1);
    });

    it('rejects duplicate registration but allows upsert', () => {
        const registry = new LibraryRegistry();
        registry.register(gameLibrary);

        expect(() => registry.register(gameLibrary)).toThrow('Library already registered: games');

        registry.upsert({ ...gameLibrary, name: 'My Games' });
        expect(registry.get('games')?.name).toBe('My Games');
    });

    it('unregisters a library without affecting other entries', () => {
        const registry = new LibraryRegistry();
        registry.register(gameLibrary);
        registry.register({ ...gameLibrary, id: 'anime', name: 'Anime', mediaType: 'anime' });

        expect(registry.unregister('games')).toBe(true);
        expect(registry.unregister('games')).toBe(false);
        expect(registry.list().map((library) => library.id)).toEqual(['anime']);
    });
});
