import type { FieldDefinition, GroupSpec } from '../../types';
import { applyLibraryView } from './viewPipeline';
import type { LibraryDefinition, LibraryItem } from './types';
import { LibraryItemCard } from '../../components/LibraryItemCard';

export interface LibrarySurfaceRenderOptions {
    rules?: Parameters<typeof applyLibraryView>[1];
    sorts?: Parameters<typeof applyLibraryView>[2];
    group?: GroupSpec;
    fields?: FieldDefinition[];
    onClick?: (item: LibraryItem) => void;
    onContextMenu?: (item: LibraryItem, event: MouseEvent) => void;
}

/** Renders folder-backed library items through the shared View/Filter/Sort/Group pipeline. */
export class LibrarySurfaceRenderer {
    render(
        parent: HTMLElement,
        items: LibraryItem[],
        definition: LibraryDefinition,
        options: LibrarySurfaceRenderOptions = {},
    ): void {
        const rules = options.rules ?? [];
        const sorts = options.sorts ?? [];
        const group: GroupSpec = options.group ?? { mode: 'none', order: 'asc' };
        const fields = options.fields ?? definition.schema.fields;
        const orientation = definition.orientation ?? 'vertical';
        const cardSize = definition.cardSize ?? 'medium';
        const columns = Math.max(1, definition.columns ?? 3);
        const groups = applyLibraryView(items, rules, sorts, group, fields);

        parent.empty();
        parent.addClass('lorebase-library-surface');
        parent.dataset.libraryId = definition.id;
        parent.dataset.libraryKind = definition.kind === 'custom' ? 'custom' : 'builtin';
        parent.dataset.libraryOrientation = orientation;
        parent.dataset.libraryCardSize = cardSize;

        for (const result of groups) {
            const section = parent.createDiv({ cls: 'lorebase-library-surface-group' });
            if (result.label) {
                section.createDiv({ cls: 'lorebase-library-surface-group-title', text: result.label });
            }

            const grid = section.createDiv({ cls: 'lorebase-library-surface-grid' });
            grid.dataset.libraryOrientation = orientation;
            grid.dataset.libraryCardSize = cardSize;
            if (orientation === 'horizontal') {
                grid.addClass('is-horizontal');
                if (definition.customHorizontalCardMinWidth) {
                    grid.style.setProperty('--lorebase-library-card-min-width', `${definition.customHorizontalCardMinWidth}px`);
                }
                if (definition.customHorizontalCardHeight) {
                    grid.style.setProperty('--lorebase-library-card-height', `${definition.customHorizontalCardHeight}px`);
                }
            } else {
                grid.addClass('is-vertical');
                grid.style.setProperty('--lorebase-library-columns', String(columns));
                if (definition.customCardMinWidth) {
                    grid.style.setProperty('--lorebase-library-card-min-width', `${definition.customCardMinWidth}px`);
                }
                if (definition.customCardMinHeight) {
                    grid.style.setProperty('--lorebase-library-card-min-height', `${definition.customCardMinHeight}px`);
                }
                if (definition.customCardImageRatio) {
                    grid.style.setProperty('--lorebase-library-card-image-ratio', String(definition.customCardImageRatio));
                }
            }

            for (const item of result.items) {
                new LibraryItemCard(grid, item, definition, {
                    onClick: options.onClick ?? (() => undefined),
                    onContextMenu: options.onContextMenu,
                });
            }
        }
    }
}
