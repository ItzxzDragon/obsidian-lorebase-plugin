import type { FilterRule, GroupSpec, SortSpec, SortOrder } from '../../types';

/** Logical mode used by a filter group, matching the Custom Libraries reference runtime. */
export type FilterMode = 'and' | 'or' | 'none';

/** A nested filter group. Groups may contain rules and other groups. */
export interface FilterGroup {
    kind: 'group';
    id: string;
    mode: FilterMode;
    children: FilterNode[];
}

export type FilterNode = FilterRule | FilterGroup;

/** The complete view state Custom Libraries need to share with the main Library UI. */
export interface UnifiedLibraryViewState {
    sorts: SortSpec[];
    filterMode: FilterMode;
    filters: FilterRule[];
    filterGroup: FilterGroup;
    groupProperty: string;
    groupDirection: SortOrder;
    savedViews: UnifiedSavedView[];
    activeSavedViewId: string;
}

export interface UnifiedSavedView {
    id: string;
    name: string;
    state: Omit<UnifiedLibraryViewState, 'savedViews'>;
    readonly?: boolean;
}

export function createEmptyFilterGroup(mode: FilterMode = 'and', id = createViewId('filter-group')): FilterGroup {
    return { kind: 'group', id, mode, children: [] };
}

export function isFilterGroup(node: FilterNode): node is FilterGroup {
    return node.kind === 'group';
}

export function cloneFilterGroup(group: FilterGroup): FilterGroup {
    return {
        kind: 'group',
        id: group.id,
        mode: group.mode,
        children: group.children.map((child) => isFilterGroup(child)
            ? cloneFilterGroup(child)
            : {
                ...child,
                value: Array.isArray(child.value) ? [...child.value] : child.value,
            }),
    };
}

export function cloneUnifiedViewState(state: UnifiedLibraryViewState): UnifiedLibraryViewState {
    return {
        sorts: state.sorts.map((sort) => ({ ...sort })),
        filterMode: state.filterMode,
        filters: state.filters.map((rule) => ({
            ...rule,
            value: Array.isArray(rule.value) ? [...rule.value] : rule.value,
        })),
        filterGroup: cloneFilterGroup(state.filterGroup),
        groupProperty: state.groupProperty,
        groupDirection: state.groupDirection,
        savedViews: state.savedViews.map((view) => ({
            ...view,
            state: {
                ...view.state,
                sorts: view.state.sorts.map((sort) => ({ ...sort })),
                filters: view.state.filters.map((rule) => ({
                    ...rule,
                    value: Array.isArray(rule.value) ? [...rule.value] : rule.value,
                })),
                filterGroup: cloneFilterGroup(view.state.filterGroup),
            },
        })),
        activeSavedViewId: state.activeSavedViewId,
    };
}

export function countFilterRules(group: FilterGroup): number {
    return group.children.reduce((count, child) => count + (isFilterGroup(child) ? countFilterRules(child) : 1), 0);
}

export function collectFilterProperties(group: FilterGroup, target = new Set<string>()): Set<string> {
    for (const child of group.children) {
        if (isFilterGroup(child)) collectFilterProperties(child, target);
        else if (child.field.trim()) target.add(child.field);
    }
    return target;
}

export function createViewId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Convert the legacy flat custom-library state without throwing away any existing rules. */
export function fromLegacyViewState(state: {
    rules: FilterRule[];
    sorts: SortSpec[];
    group: GroupSpec;
}): UnifiedLibraryViewState {
    const group = createEmptyFilterGroup('and', 'root');
    group.children = state.rules.map((rule) => ({
        ...rule,
        value: Array.isArray(rule.value) ? [...rule.value] : rule.value,
    }));

    const firstGroupField = state.group.mode === 'field' ? state.group.field ?? '' : '';
    return {
        sorts: state.sorts.map((sort) => ({ ...sort })),
        filterMode: 'and',
        filters: state.rules.map((rule) => ({
            ...rule,
            value: Array.isArray(rule.value) ? [...rule.value] : rule.value,
        })),
        filterGroup: group,
        groupProperty: firstGroupField,
        groupDirection: state.group.order,
        savedViews: [],
        activeSavedViewId: '',
    };
}
