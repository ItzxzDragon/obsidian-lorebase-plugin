import { describe, expect, it } from 'vitest';
import type { FilterRule } from '../../types';
import { cloneUnifiedViewState, createEmptyFilterGroup, fromLegacyViewState } from './unifiedViewState';

describe('unified custom library view state', () => {
    it('converts legacy flat state into a root filter group', () => {
        const rule: FilterRule = { id: 'r1', field: 'status', fieldType: 'text', operator: 'equals', value: 'active' };
        const state = fromLegacyViewState({
            rules: [rule],
            sorts: [{ field: 'name', order: 'asc' }],
            group: { mode: 'field', field: 'status', order: 'desc' },
        });

        expect(state.filterGroup.mode).toBe('and');
        expect(state.filterGroup.children).toEqual([rule]);
        expect(state.sorts).toEqual([{ field: 'name', order: 'asc' }]);
        expect(state.groupProperty).toBe('status');
        expect(state.groupDirection).toBe('desc');
    });

    it('deep-clones nested groups and saved views', () => {
        const root = createEmptyFilterGroup('and', 'root');
        const nested = createEmptyFilterGroup('or', 'nested');
        nested.children.push({ id: 'r1', field: 'tag', fieldType: 'text', operator: 'contains', value: ['x'] });
        root.children.push(nested);
        const state = {
            sorts: [{ field: 'name' as const, order: 'asc' as const }],
            filterMode: 'and' as const,
            filters: [],
            filterGroup: root,
            groupProperty: 'tag',
            groupDirection: 'asc' as const,
            savedViews: [],
            activeSavedViewId: '',
        };

        const clone = cloneUnifiedViewState(state);
        const child = clone.filterGroup.children[0];
        if (child.kind !== 'group') throw new Error('expected nested group');
        const rule = child.children[0];
        if (rule.kind === 'group') throw new Error('expected rule');
        (rule.value as string[]).push('y');

        expect((nested.children[0] as FilterRule).value).toEqual(['x']);
        expect((clone.filterGroup.children[0] as typeof nested).children[0]).not.toBe(nested.children[0]);
    });
});
