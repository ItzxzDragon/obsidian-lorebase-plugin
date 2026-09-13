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
        const group = options.group ?? { mode: 'none', order: 'asc' };
        const fields = options.fields ?? definition.schema.fields;
        const groups = applyLibraryView(items, rules, sorts, group, fields);

        parent.empty();
        parent.addClass('lorebase-library-surface');

        for (const result of groups) {
            const section = parent.createDiv({ cls: 'lorebase-library-surface-group' });
            if (result.label) {
                section.createDiv({ cls: 'lorebase-library-surface-group-title', text: result.label });
            }

            const grid = section.createDiv({ cls: 'lorebase-library-surface-grid' });
            for (const item of result.items) {
                new LibraryItemCard(grid, item, {
                    onClick: options.onClick,
                });
            }
        }
    }
}
