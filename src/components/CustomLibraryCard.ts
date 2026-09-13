import { setIcon } from 'obsidian';
import type { FieldDefinition } from '../types';
import type { LibraryItem } from '../services/library/types';

export interface CustomLibraryCardCallbacks {
    onOpen: (item: LibraryItem) => void;
}

/** Renders a folder-backed library item without coupling it to MediaItem cards. */
export function renderCustomLibraryCard(
    parent: HTMLElement,
    item: LibraryItem,
    fields: FieldDefinition[],
    callbacks: CustomLibraryCardCallbacks,
): HTMLElement {
    const card = parent.createDiv({ cls: 'lorebase-custom-library-card' });
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const title = String(item.values.name ?? item.file.basename);
    const header = card.createDiv({ cls: 'lorebase-custom-library-card-header' });
    const icon = header.createSpan({ cls: 'lorebase-custom-library-card-icon' });
    setIcon(icon, 'file-text');
    header.createDiv({ cls: 'lorebase-custom-library-card-title', text: title });

    const values = card.createDiv({ cls: 'lorebase-custom-library-card-values' });
    for (const field of fields) {
        const raw = item.values[field.id];
        if (raw === undefined || raw === null || raw === '') continue;
        const row = values.createDiv({ cls: 'lorebase-custom-library-card-field' });
        row.createSpan({ cls: 'lorebase-custom-library-card-field-label', text: field.label });
        row.createSpan({ cls: 'lorebase-custom-library-card-field-value', text: formatValue(raw) });
    }

    const open = (): void => callbacks.onOpen(item);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open();
    });

    return card;
}

function formatValue(value: unknown): string {
    if (Array.isArray(value)) return value.map((entry) => String(entry)).join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
}
