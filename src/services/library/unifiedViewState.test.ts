import { describe, expect, it } from 'vitest';
import type { FilterRule } from '../../types';
import {
    addFilterGroup,
    addFilterRule,
    cloneUnifiedViewState,
    createEmptyFilterGroup,
    fromLegacyViewState,
    matchesFilterGroup,
    removeFilterNode,
    updateFilterGroupMode,
    updateFilterRule,
} from './unifiedViewState';

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

    it('adds rules and nested groups without mutating the source tree', () => {
        const root = createEmptyFilterGroup('and', 'root');
        const nested = createEmptyFilterGroup('or', 'nested');
        const rule: FilterRule = { id: 'r1', field: 'status', fieldType: 'text', operator: 'equals', value: 'active' };

        const withGroup = addFilterGroup(root, 'or', undefined, 'nested');
        const withRule = addFilterRule(withGroup, rule);
        expect(root.children).toEqual([]);
        expect(withRule.children).toHaveLength(1);
        expect(withRule.children[0]).toEqual(nested);

        const group = withRule.children[0];
        if (group.kind !== 'group') throw new Error('expected nested group');
        const withNestedRule = addFilterRule(group, rule);
        expect(withNestedRule.children).toEqual([rule]);
        expect(group.children).toEqual([]);
    });

    it('updates a nested group mode and removes nested nodes by id', () => {
        const root = createEmptyFilterGroup('and', 'root');
        const nested = createEmptyFilterGroup('and', 'nested');
        nested.children.push({ id: 'r1', field: 'tag', fieldType: 'text', operator: 'contains', value: 'x' });
        root.children.push(nested);

        const updated = updateFilterGroupMode(root, 'nested', 'or');
        expect((updated.children[0] as typeof nested).mode).toBe('or');
        expect((root.children[0] as typeof nested).mode).toBe('and');

        const removed = removeFilterNode(updated, 'r1');
        expect((removed.children[0] as typeof nested).children).toEqual([]);
        expect((updated.children[0] as typeof nested).children).toHaveLength(1);
    });

    it('updates a nested filter rule without flattening the tree', () => {
        const root = createEmptyFilterGroup('and', 'root');
        const nested = createEmptyFilterGroup('or', 'nested');
        nested.children.push({ id: 'r1', field: 'status', fieldType: 'text', operator: 'equals', value: 'active' });
        root.children.push(nested);

        const updated = updateFilterRule(root, 'r1', { operator: 'contains', value: 'act' });
        const child = updated.children[0];
        if (child.kind !== 'group') throw new Error('expected nested group');
        expect(child.children[0]).toMatchObject({ id: 'r1', operator: 'contains', value: 'act' });
        expect(root.children).toEqual([nested]);
        expect((nested.children[0] as FilterRule).operator).toBe('equals');
    });

    it('evaluates nested groups with the same rule matcher', () => {
        const root = createEmptyFilterGroup('and', 'root');
        const nested = createEmptyFilterGroup('or', 'nested');
        const rules: Record<string, boolean> = { r1: false, r2: true, r3: false };
        nested.children.push(
            { id: 'r1', field: 'status', fieldType: 'text', operator: 'equals', value: 'active' },
            { id: 'r2', field: 'favorite', fieldType: 'boolean', operator: 'isTrue' },
        );
        root.children.push(nested, {
            id: 'r3', field: 'status', fieldType: 'text', operator: 'equals', value: 'completed',
        });

        expect(matchesFilterGroup(root, (rule) => rules[rule.id])).toBe(false);
        expect(matchesFilterGroup(nested, (rule) => rules[rule.id])).toBe(true);

        const none = createEmptyFilterGroup('none', 'none');
        none.children.push({ id: 'r3', field: 'status', fieldType: 'text', operator: 'equals', value: 'completed' });
        expect(matchesFilterGroup(none, () => false)).toBe(true);
    });

    it('does not allow removing the root group', () => {
        const root = createEmptyFilterGroup('and', 'root');
        expect(() => removeFilterNode(root, 'root')).toThrow('Cannot remove the root filter group');
    });
});
