import { describe, expect, it, vi } from 'vitest';
import { CustomLibraryPane } from './CustomLibraryPane';

const library = {
    id: 'notes',
    name: 'Notes',
    icon: 'library',
    source: { kind: 'folder' as const, folder: 'Notes' },
    schema: { fields: [] },
};

describe('CustomLibraryPane', () => {
    it('renders the built-in selector state and notifies when a custom library is selected', async () => {
        const parent = document.createElement('div');
        const manager = {
            listCustomLibraries: vi.fn().mockReturnValue([library]),
            registry: { get: vi.fn((id: string) => id === 'notes' ? library : undefined) },
            loadItems: vi.fn().mockResolvedValue([]),
        } as any;
        const callbacks = { onActiveLibraryChange: vi.fn() };
        const pane = new CustomLibraryPane({ workspace: {} } as any, manager, parent, callbacks);

        const select = parent.querySelector('select') as HTMLSelectElement;
        expect(select.value).toBe('');
        expect(select.options[1]?.textContent).toBe('Notes');

        select.value = 'notes';
        select.dispatchEvent(new Event('change'));
        await Promise.resolve();
        await Promise.resolve();
        expect(callbacks.onActiveLibraryChange).toHaveBeenCalledWith('notes');

        pane.destroy();
        expect(parent.querySelector('.lorebase-custom-library-pane')).toBeNull();
    });
});
