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

    it('toggles content visibility without destroying the pane', () => {
        const parent = document.createElement('div');
        const manager = {
            listCustomLibraries: vi.fn().mockReturnValue([library]),
            registry: { get: vi.fn() },
            loadItems: vi.fn().mockResolvedValue([]),
        } as any;
        const pane = new CustomLibraryPane({ workspace: {} } as any, manager, parent, { onActiveLibraryChange: vi.fn() });
        const content = parent.querySelector('.lorebase-custom-library-content') as HTMLElement;

        expect(content.classList.contains('is-hidden')).toBe(true);
        expect(content.getAttribute('aria-hidden')).toBe('true');

        pane.setContentVisible(true);
        expect(content.classList.contains('is-hidden')).toBe(false);
        expect(content.getAttribute('aria-hidden')).toBe('false');

        pane.setContentVisible(false);
        expect(content.classList.contains('is-hidden')).toBe(true);
        expect(content.getAttribute('aria-hidden')).toBe('true');

        pane.destroy();
    });
});
