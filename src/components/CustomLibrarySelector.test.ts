import { describe, expect, it, vi } from 'vitest';
import { CustomLibrarySelector } from './CustomLibrarySelector';

const library = {
    id: 'notes',
    name: 'Notes',
    icon: 'library',
    source: { kind: 'folder' as const, folder: 'Notes' },
    schema: { fields: [] },
};

describe('CustomLibrarySelector', () => {
    it('renders available custom libraries and selects the active one', () => {
        const parent = document.createElement('div');
        const onSelect = vi.fn();
        new CustomLibrarySelector(parent, [library], 'notes', { onSelect });

        const select = parent.querySelector('select');
        expect(select).not.toBeNull();
        expect(select?.value).toBe('notes');
        expect(select?.options).toHaveLength(2);
        expect(select?.options[1]?.textContent).toBe('Notes');
    });

    it('emits the selected library id', () => {
        const parent = document.createElement('div');
        const onSelect = vi.fn();
        new CustomLibrarySelector(parent, [library], null, { onSelect });

        const select = parent.querySelector('select') as HTMLSelectElement;
        select.value = 'notes';
        select.dispatchEvent(new Event('change'));

        expect(onSelect).toHaveBeenCalledWith('notes');
    });

    it('can be destroyed cleanly', () => {
        const parent = document.createElement('div');
        const selector = new CustomLibrarySelector(parent, [library], null, { onSelect: vi.fn() });

        selector.destroy();

        expect(parent.querySelector('.lorebase-custom-library-selector')).toBeNull();
    });
});
