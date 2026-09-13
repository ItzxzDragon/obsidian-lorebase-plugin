import type { SortOrder } from '../../types';
import type { LibraryItem } from './types';
import { getLibraryValue } from './viewPipeline';

export interface CustomLibraryGroup {
    key: string;
    label: string;
    items: LibraryItem[];
}

/** Groups library items by an arbitrary schema field without coupling the core pipeline to UI-specific group modes. */
export function groupLibraryItemsByField(
    items: LibraryItem[],
    field: string,
    order: SortOrder = 'asc',
): CustomLibraryGroup[] {
    const groups = new Map<string, CustomLibraryGroup>();

    for (const item of items) {
        const rawValue = getLibraryValue(item, field);
        const label = formatGroupLabel(rawValue);
        const key = label.toLocaleLowerCase();
        const existing = groups.get(key);

        if (existing) {
            existing.items.push(item);
        } else {
            groups.set(key, { key, label, items: [item] });
        }
    }

    const result = Array.from(groups.values());
    result.sort((a, b) => {
        if (a.key === 'ungrouped') return order === 'asc' ? 1 : -1;
        if (b.key === 'ungrouped') return order === 'asc' ? -1 : 1;
        const comparison = a.label.localeCompare(b.label, undefined, {
            numeric: true,
            sensitivity: 'base',
        });
        return order === 'desc' ? -comparison : comparison;
    });

    return result;
}

function formatGroupLabel(value: unknown): string {
    if (Array.isArray(value)) {
        const labels = value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
        return labels.length > 0 ? labels.join(', ') : 'Ungrouped';
    }

    const label = String(value ?? '').trim();
    return label || 'Ungrouped';
}
