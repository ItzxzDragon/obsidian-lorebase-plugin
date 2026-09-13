import { describe, expect, it, vi } from 'vitest';
import { renderCustomLibraryCard } from './CustomLibraryCard';

const item = {
    file: { basename: 'Fallback title', path: 'Notes/entry.md' } as any,
    values: {
        name: 'Entry title',
        author: 'Alice',
        genres: ['Fantasy', 'Mystery'],
        finished: true,
    },
};

const fields = [
    { id: 'yaml:author', label: 'Author', icon: 'user', type: 'text' as const, source: 'yaml' as const, operators: [] },
    { id: 'yaml:genres', label: 'Genres', icon: 'tags', type: 'list' as const, source: 'yaml' as const, operators: [] },
    { id: 'yaml:finished', label: 'Finished', icon: 'check', type: 'boolean' as const, source: 'yaml' as const, operators: [] },
];

describe('renderCustomLibraryCard', () => {
    it('renders the title and non-empty field values', () => {
        const parent = document.createElement('div');
        const card = renderCustomLibraryCard(parent, item, fields, { onOpen: vi.fn() });

        expect(card.querySelector('.lorebase-custom-library-card-title')?.textContent).toBe('Entry title');
        expect(card.textContent).toContain('Author');
        expect(card.textContent).toContain('Alice');
        expect(card.textContent).toContain('Fantasy, Mystery');
        expect(card.textContent).toContain('Yes');
    });

    it('opens the item on click and keyboard activation', () => {
        const parent = document.createElement('div');
        const onOpen = vi.fn();
        const card = renderCustomLibraryCard(parent, item, fields, { onOpen });

        card.dispatchEvent(new MouseEvent('click'));
        card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        expect(onOpen).toHaveBeenCalledTimes(3);
        expect(onOpen).toHaveBeenCalledWith(item);
    });

    it('falls back to the file basename when no title is present', () => {
        const parent = document.createElement('div');
        const onOpen = vi.fn();
        const card = renderCustomLibraryCard(
            parent,
            { ...item, values: {} },
            [],
            { onOpen },
        );

        expect(card.querySelector('.lorebase-custom-library-card-title')?.textContent).toBe('Fallback title');
    });
});
