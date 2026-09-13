import { setIcon } from 'obsidian';
import type { LibrarySelectionOption } from '../../services/library/LibrarySelection';

export interface LibrarySelectorCallbacks {
    onSelect: (option: LibrarySelectionOption) => void;
}

/** Renders the shared Library selector without creating a second Custom Library surface. */
export class LibrarySelector {
    constructor(
        private readonly parent: HTMLElement,
        private readonly options: LibrarySelectionOption[],
        private readonly selectedId: string,
        private readonly callbacks: LibrarySelectorCallbacks,
    ) {}

    render(): HTMLElement {
        const root = this.parent.createDiv({ cls: 'lorebase-library-selector' });
        root.setAttribute('role', 'listbox');
        root.setAttribute('aria-label', 'Library');

        for (const option of this.options) {
            const active = option.id === this.selectedId;
            const item = root.createEl('button', {
                cls: `lorebase-library-selector-option ${active ? 'is-active' : ''}`,
                attr: {
                    type: 'button',
                    role: 'option',
                    'aria-selected': String(active),
                    'data-library-id': option.id,
                },
            });
            const icon = item.createSpan({ cls: 'lorebase-library-selector-icon' });
            setIcon(icon, option.icon || (option.kind === 'custom' ? 'library' : 'books'));
            item.createSpan({ cls: 'lorebase-library-selector-label', text: option.name });
            item.createSpan({
                cls: `lorebase-library-selector-kind ${option.kind}`,
                text: option.kind === 'custom' ? 'Custom' : 'Built-in',
            });
            item.addEventListener('click', () => this.callbacks.onSelect(option));
        }

        return root;
    }
}
