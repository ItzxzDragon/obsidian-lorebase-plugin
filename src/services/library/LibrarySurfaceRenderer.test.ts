import { describe, expect, it, vi } from 'vitest';
import type { LibraryDefinition, LibraryItem } from './types';
import { LibrarySurfaceRenderer } from './LibrarySurfaceRenderer';

vi.mock('../../components/LibraryItemCard', () => ({
    LibraryItemCard: class {
        constructor(parent: HTMLElement, item: LibraryItem) {
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
        const parent = document.body.createDiv();
        const renderer = new LibrarySurfaceRenderer();

        renderer.render(parent, [item('B', 2), item('A', 5)], definition(), {
            sorts: [{ field: 'yaml:rating', order: 'desc' }],
            group: { mode: 'none', order: 'asc' },
        });

        const cards = Array.from(parent.querySelectorAll('.test-card')).map((node) => node.textContent);
        expect(cards).toEqual(['A', 'B']);
    });
});
