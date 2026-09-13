import { describe, expect, it, vi } from 'vitest';
import type { LibraryDefinition } from '../../services/library/types';
import { LibrarySelector } from './LibrarySelector';
import type { LibrarySelectionOption } from '../../services/library/LibrarySelection';

function option(id: string, kind: 'builtin' | 'custom'): LibrarySelectionOption {
    const definition: LibraryDefinition = kind === 'custom'
        ? {
            id,
            name: 'Custom Library',
            icon: 'library',
            kind: 'custom',
            source: { kind: 'folder', folder: 'Library' },
            propertyScope: 'folder',
            schema: { fields: [] },
        }
        : {
            id,
            name: 'Games',
            icon: 'gamepad-2',
            kind: 'builtin',
            source: { kind: 'builtin', mediaType: 'game' },
            schema: { fields: [] },
        };

    return {
        id,
        name: definition.name,
        icon: definition.icon,
        kind,
        definition,
    };
}

describe('LibrarySelector', () => {
    it('renders built-in and custom options in the same list', () => {
        const parent = document.body.createDiv();
        const callbacks = { onSelect: vi.fn() };
        const selector = new LibrarySelector(
            parent,
            [option('game', 'builtin'), option('my-library', 'custom')],
            'my-library',
            callbacks,
        );

        const root = selector.render();
        const items = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="option"]'));

        expect(items).toHaveLength(2);
        expect(items[0].dataset.libraryId).toBe('game');
        expect(items[1].dataset.libraryId).toBe('my-library');
        expect(items[1].getAttribute('aria-selected')).toBe('true');
        expect(items[1].textContent).toContain('Custom');
    });

    it('emits the selected library option', () => {
        const parent = document.body.createDiv();
        const callbacks = { onSelect: vi.fn() };
        const custom = option('my-library', 'custom');
        const selector = new LibrarySelector(parent, [custom], 'my-library', callbacks);
        const root = selector.render();

        root.querySelector<HTMLButtonElement>('[data-library-id="my-library"]')?.click();

        expect(callbacks.onSelect).toHaveBeenCalledWith(custom);
    });
});
