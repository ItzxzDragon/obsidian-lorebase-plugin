import { setIcon } from 'obsidian';
import type { LibraryItem, LibraryDefinition } from '../services/library/types';
import { getLibraryValue } from '../services/library/viewPipeline';

export interface LibraryItemCardCallbacks {
    onClick: (item: LibraryItem) => void;
    onContextMenu?: (item: LibraryItem, event: MouseEvent) => void;
}

/** Generic card for folder-backed libraries. It deliberately knows nothing about media-specific schemas. */
export class LibraryItemCard {
    constructor(
        parent: HTMLElement,
        private readonly item: LibraryItem,
        private readonly definition: LibraryDefinition,
        private readonly callbacks: LibraryItemCardCallbacks,
    ) {
        this.render(parent);
    }

    private render(parent: HTMLElement): void {
        const card = parent.createDiv({ cls: 'lorebase-card lorebase-library-item-card' });
        card.dataset.lorebaseFilePath = this.item.file.path;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', this.title());

        const cover = this.coverUrl();
        if (cover) {
            const image = card.createDiv({ cls: 'lorebase-library-item-card-cover' });
            image.style.backgroundImage = `url("${cover.replace(/(["\\])/g, '\\$1')}")`;
        } else {
            const placeholder = card.createDiv({ cls: 'lorebase-library-item-card-placeholder' });
            setIcon(placeholder, this.definition.icon || 'library');
        }

        const body = card.createDiv({ cls: 'lorebase-library-item-card-body' });
        body.createDiv({ cls: 'lorebase-library-item-card-title', text: this.title() });

        const summary = this.summary();
        if (summary) body.createDiv({ cls: 'lorebase-library-item-card-summary', text: summary });

        const metadata = this.metadata();
        if (metadata) body.createDiv({ cls: 'lorebase-library-item-card-meta', text: metadata });

        const activate = (event?: MouseEvent | KeyboardEvent): void => {
            event?.preventDefault();
            if (event instanceof MouseEvent && event.button === 2) {
                this.callbacks.onContextMenu?.(this.item, event);
                return;
            }
            this.callbacks.onClick(this.item);
        };

        card.addEventListener('click', (event) => activate(event));
        card.addEventListener('contextmenu', (event) => activate(event));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') activate(event);
        });
    }

    private title(): string {
        const field = this.definition.schema.titleField;
        const value = field ? getLibraryValue(this.item, field) : null;
        return String(value ?? getLibraryValue(this.item, 'name') ?? this.item.file.basename).trim() || this.item.file.basename;
    }

    private coverUrl(): string | null {
        const field = this.definition.schema.coverField;
        const value = field ? getLibraryValue(this.item, field) : null;
        const raw = String(value ?? '').trim();
        if (!raw) return null;
        const wiki = raw.match(/^!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/)?.[1];
        const candidate = wiki || raw;
        return /^https?:\/\//i.test(candidate) ? candidate : null;
    }

    private summary(): string {
        const candidates = ['description', 'summary', 'plot', 'overview'];
        for (const field of candidates) {
            const value = String(getLibraryValue(this.item, field) ?? '').trim();
            if (value) return value;
        }
        return '';
    }

    private metadata(): string {
        const values = this.definition.schema.fields
            .map((field) => getLibraryValue(this.item, field.id))
            .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
            .slice(0, 3)
            .map((value) => Array.isArray(value) ? value.join(', ') : String(value));
        return values.join(' · ');
    }
}
