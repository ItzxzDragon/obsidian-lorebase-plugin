import { describe, expect, it } from 'vitest';
import type { FilterRule, GroupSpec, SortSpec } from '../../types';
import type { LibraryItem } from './types';
import { applyLibraryView, filterLibraryItems, groupLibraryItems, sortLibraryItems } from './viewPipeline';

const item = (name: string, values: Record<string, unknown>): LibraryItem => ({
    file: {} as LibraryItem['file'],
    values: { name, ...values },
});

const rule = (field: string, operator: FilterRule['operator'], value?: FilterRule['value']): FilterRule => ({
    id: `${field}-${operator}`,
    field,
    fieldType: 'text',
    operator,
    value,
});

describe('library view pipeline', () => {
    it('filters with AND semantics and supports arrays', () => {
        const items = [
            item('A', { tags: ['rpg', 'co-op'], rating: 9 }),
            item('B', { tags: ['rpg'], rating: 7 }),
            item('C', { tags: ['strategy'], rating: 9 }),
        ];
        expect(filterLibraryItems(items, [
            rule('tags', 'contains', 'rpg'),
            rule('rating', 'greater', 8),
        ]).map((entry) => entry.values.name)).toEqual(['A']);
    });

    it('sorts by multiple fields without mutating the input', () => {
        const items = [item('B', { rating: 8 }), item('A', { rating: 8 }), item('C', { rating: 9 })];
        const sorts: SortSpec[] = [
            { field: 'rating', order: 'desc' },
            { field: 'name', order: 'asc' },
        ];
        expect(sortLibraryItems(items, sorts).map((entry) => entry.values.name)).toEqual(['C', 'A', 'B']);
        expect(items.map((entry) => entry.values.name)).toEqual(['B', 'A', 'C']);
    });

    it('groups by series and sorts group keys', () => {
        const items = [item('A', { series: 'Z' }), item('B', { series: 'A' }), item('C', { series: 'Z' })];
        const group: GroupSpec = { mode: 'series', order: 'asc' };
        const groups = groupLibraryItems(items, group);
        expect(groups.map((entry) => entry.label)).toEqual(['A', 'Z']);
        expect(groups[1].items.map((entry) => entry.values.name)).toEqual(['A', 'C']);
    });

    it('composes filter, sort and group in one pass', () => {
        const items = [
            item('B', { series: 'X', rating: 8 }),
            item('A', { series: 'X', rating: 9 }),
            item('C', { series: 'Y', rating: 6 }),
        ];
        const groups = applyLibraryView(
            items,
            [rule('rating', 'greater', 7)],
            [{ field: 'rating', order: 'desc' }],
            { mode: 'series', order: 'asc' },
        );
        expect(groups.map((entry) => entry.label)).toEqual(['X']);
        expect(groups[0].items.map((entry) => entry.values.name)).toEqual(['A', 'B']);
    });
});
