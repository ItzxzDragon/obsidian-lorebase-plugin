import { describe, expect, it, vi } from 'vitest';
import type { LibraryDefinition, LibraryItem } from './types';
import { LibrarySurfaceRenderer } from './LibrarySurfaceRenderer';

const cardDefinitions: LibraryDefinition[] = [];

vi.mock('../../components/LibraryItemCard', () => ({
    LibraryItemCard: class {
        constructor(
            parent: HTMLElement,
            item: LibraryItem,
            definition: LibraryDefinition,
        ) {
            cardDefinitions.push(definition);
            parent.createDiv({ cls: 'test-card', text: String(item.values.name ?? item.file.basename) });
        }
    },
}));

function definition(): LibraryDefinition {
    return {
        id: 'custom',
        name: 'Custom',
        icon: 'library',
        kind: 'custom',
        source: { kind: 'folder', folder: 'Library' },
        propertyScope: 'folder',
        schema: { fields: [], titleField: 'yaml:title' },
    };
}

function item(name: string, rating: number): LibraryItem {
    return {
        file: { basename: name, path: `Library/${name}.md` } as LibraryItem['file'],
        values: { name, rating },
    };
}

describe('LibrarySurfaceRenderer', () => {
    it('uses the shared pipeline before rendering cards', () => {
        cardDefinitions.length = 0;
        const parent = document.body.createDiv();
        const renderer = new LibrarySurfaceRenderer();
        const library = definition();

        renderer.render(parent, [item('B', 2), item('A', 5)], library, {
            sorts: [{ field: 'yaml:rating', order: 'desc' }],
            group: { mode: 'none', order: 'asc' },
        });

        const cards = Array.from(parent.querySelectorAll('.test-card')).map((node) => node.textContent);
        expect(cards).toEqual(['A', 'B']);
        expect(cardDefinitions).toEqual([library, library]);
    });
});
