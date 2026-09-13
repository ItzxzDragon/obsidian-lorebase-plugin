import { describe, expect, it } from 'vitest';
import { createBuiltinLibraryDefinitions } from './builtinLibraries';

describe('createBuiltinLibraryDefinitions', () => {
    it('creates one shared definition for every built-in media type', () => {
        const libraries = createBuiltinLibraryDefinitions();

        expect(libraries.map((library) => library.id)).toEqual([
            'game', 'anime', 'movie', 'series', 'book', 'manga',
        ]);
        expect(libraries.every((library) => library.source.kind === 'builtin')).toBe(true);
        expect(libraries.every((library) => library.schema.fields.length === 0)).toBe(true);
    });

    it('keeps source media type aligned with the definition', () => {
        for (const library of createBuiltinLibraryDefinitions()) {
            expect(library.mediaType).toBe(library.source.kind === 'builtin' ? library.source.mediaType : undefined);
        }
    });
});
