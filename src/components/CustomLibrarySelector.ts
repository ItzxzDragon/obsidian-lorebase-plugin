import type { LibraryDefinition } from '../services/library/types';

export interface CustomLibrarySelectorCallbacks {
    onSelect: (libraryId: string | null) => void;
}

/** Small selector for switching between built-in and folder-backed libraries. */
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
            attr: { 'aria-label': 'Select library' },
        });
        select.createEl('option', {
            text: 'Built-in libraries',
            value: '',
        });

        for (const library of libraries) {
            select.createEl('option', {
                text: library.name,
                value: library.id,
            });
        }

        select.value = activeLibraryId ?? '';
        select.addEventListener('change', () => callbacks.onSelect(select.value || null));
    }

    destroy(): void {
        this.container.remove();
    }
}
