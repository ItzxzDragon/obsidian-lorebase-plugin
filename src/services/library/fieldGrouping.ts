import type { SortOrder } from '../../types';
import type { LibraryItem } from './types';
import { getLibraryValue, type LibraryGroup } from './viewPipeline';

/** Groups custom-library items by an arbitrary schema field. */
export function groupLibraryItemsByField(
    items: LibraryItem[],
    field: string,
    order: SortOrder,
): LibraryGroup<LibraryItem>[] {
    const groups = new Map<string, { label: string; items: LibraryItem[] }>();

    for (const item of items) {
        const raw = getLibraryValue(item, field);
        const values = Array.isArray(raw) ? raw : [raw];
        const keys = values.length > 0 ? values : [null];

        for (const value of keys) {
            const label = formatGroupLabel(value);
            const key = label.toLocaleLowerCase();
            const existing = groups.get(key);
            if (existing) {
                if (!existing.items.includes(item)) existing.items.push(item);
            } else {
                groups.set(key, { label, items: [item] });
            }
        }
    }

    return Array.from(groups, ([key, group]) => ({ key, label: group.label, items: group.items }))
        .sort((a, b) => order === 'desc'
            ? b.label.localeCompare(a.label, undefined, { numeric: true, sensitivity: 'base' })
            : a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
}

function formatGroupLabel(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'Ungrouped';
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value).trim() || 'Ungrouped';
}
