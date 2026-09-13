import { setIcon } from 'obsidian';
import type { LibraryDefinition } from '../services/library/types';

export interface CustomLibrarySelectorCallbacks {
    onSelect: (libraryId: string) => void;
}

/** Small selector for folder-backed custom libraries. */
export class CustomLibrarySelector {
    private readonly container: HTMLElement;

    constructor(
        parent: HTMLElement,
        libraries: LibraryDefinition[],
        activeLibraryId: string | null,
        callbacks: CustomLibrarySelectorCallbacks,
    ) {
        this.container = parent.createDiv({ cls: 'lorebase-custom-library-selector' });
        const select = this.container.createEl('select', {
            cls: 'lorebase-custom-library-select',
            attr: { 'aria-label': 'Select custom library' },
        });
        const placeholder = select.createEl('option', {
            text: 'Custom libraries',
            value: '',
        });
        placeholder.disabled = libraries.length === 0;

        for (const library of libraries) {
            const option = select.createEl('option', {
                text: library.name,
                value: library.id,
            });
            setIcon(option, library.icon || 'library');
        }

        select.value = activeLibraryId ?? '';
        select.addEventListener('change', () => {
            if (select.value) callbacks.onSelect(select.value);
        });
    }

    destroy(): void {
        this.container.remove();
    }
}
