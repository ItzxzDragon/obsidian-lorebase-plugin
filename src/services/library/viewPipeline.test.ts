import { describe, expect, it } from 'vitest';
import type { FilterRule, GroupSpec, SortSpec } from '../../types';
import type { LibraryItem } from './types';
import { createEmptyFilterGroup } from './unifiedViewState';
import { applyLibraryView, filterLibraryItems, groupLibraryItems, sortLibraryItems } from './viewPipeline';

const item = (name: string, values: Record<string, unknown>): LibraryItem => ({ file: {} as LibraryItem['file'], values: { name, ...values } });
const rule = (field: string, operator: FilterRule['operator'], value?: FilterRule['value']): FilterRule => ({ id: `${field}-${operator}`, field, fieldType: 'text', operator, value });

describe('library view pipeline', () => {
    it('filters with AND semantics and supports arrays', () => {
        const items = [item('A', { tags: ['rpg', 'co-op'], rating: 9 }), item('B', { tags: ['rpg'], rating: 7 }), item('C', { tags: ['strategy'], rating: 9 })];
        expect(filterLibraryItems(items, [rule('tags', 'contains', 'rpg'), rule('rating', 'greater', 8)]).map((entry) => entry.values.name)).toEqual(['A']);
    });

    it('supports nested AND/OR filter groups', () => {
        const root = createEmptyFilterGroup('and', 'root');
        const alternatives = createEmptyFilterGroup('or', 'alternatives');
        alternatives.children.push(rule('status', 'equals', 'active'), rule('status', 'equals', 'planned'));
        root.children.push(alternatives, rule('rating', 'greater', 7));

        const items = [
            item('A', { status: 'active', rating: 8 }),
            item('B', { status: 'planned', rating: 9 }),
            item('C', { status: 'dropped', rating: 10 }),
            item('D', { status: 'active', rating: 6 }),
        ];

        expect(filterLibraryItems(items, root).map((entry) => entry.values.name)).toEqual(['A', 'B']);
    });

    it('sorts by multiple fields without mutating the input', () => {
        const items = [item('B', { rating: 8 }), item('A', { rating: 8 }), item('C', { rating: 9 })];
        const sorts: SortSpec[] = [{ field: 'rating', order: 'desc' }, { field: 'name', order: 'asc' }];
        expect(sortLibraryItems(items, sorts).map((entry) => entry.values.name)).toEqual(['C', 'A', 'B']);
        expect(items.map((entry) => entry.values.name)).toEqual(['B', 'A', 'C']);
    });

    it('supports yaml-prefixed sort fields', () => {
        const items = [item('A', { 'yaml:priority': 2 }), item('B', { priority: 1 })];
        expect(sortLibraryItems(items, [{ field: 'yaml:priority', order: 'asc' }]).map((entry) => entry.values.name)).toEqual(['B', 'A']);
    });

    it('groups by series and sorts group keys', () => {
        const items = [item('A', { series: 'Z' }), item('B', { series: 'A' }), item('C', { series: 'Z' })];
        const group: GroupSpec = { mode: 'series', order: 'asc' };
        const groups = groupLibraryItems(items, group);
        expect(groups.map((entry) => entry.label)).toEqual(['A', 'Z']);
        expect(groups[1].items.map((entry) => entry.values.name)).toEqual(['A', 'C']);
    });

    it('groups by an arbitrary field and keeps array values stable', () => {
        const items = [item('A', { status: 'Active' }), item('B', { status: 'completed' }), item('C', { status: ['Active', 'Featured'] }), item('D', { status: undefined })];
        const group: GroupSpec = { mode: 'field', field: 'status', order: 'asc' };
        const groups = groupLibraryItems(items, group);
        expect(groups.map((entry) => entry.label)).toEqual(['Active', 'Active, Featured', 'completed', 'Ungrouped']);
        expect(groups[0].items.map((entry) => entry.values.name)).toEqual(['A']);
        expect(groups[1].items.map((entry) => entry.values.name)).toEqual(['C']);
        expect(groups[3].items.map((entry) => entry.values.name)).toEqual(['D']);
    });

    it('supports yaml-prefixed field grouping', () => {
        const items = [item('A', { priority: 'High' }), item('B', { 'yaml:priority': 'Low' })];
        const group: GroupSpec = { mode: 'field', field: 'yaml:priority', order: 'asc' };
        expect(groupLibraryItems(items, group).map((entry) => entry.label)).toEqual(['High', 'Low']);
    });

    it('composes filter, sort and group', () => {
        const items = [item('B', { series: 'X', rating: 8 }), item('A', { series: 'X', rating: 9 }), item('C', { series: 'Y', rating: 6 })];
        const groups = applyLibraryView(items, [rule('rating', 'greater', 7)], [{ field: 'rating', order: 'desc' }], { mode: 'series', order: 'asc' });
        expect(groups.map((entry) => entry.label)).toEqual(['X']);
        expect(groups[0].items.map((entry) => entry.values.name)).toEqual(['A', 'B']);
    });
});
