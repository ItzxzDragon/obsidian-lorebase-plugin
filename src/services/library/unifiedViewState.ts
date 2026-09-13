import type { FilterRule, GroupSpec, SortSpec, SortOrder } from '../../types';

export type FilterMode = 'and' | 'or' | 'none';

export interface FilterGroup {
    kind: 'group';
    id: string;
    mode: FilterMode;
    children: FilterNode[];
}

export type FilterNode = FilterRule | FilterGroup;

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
            : { ...child, value: Array.isArray(child.value) ? [...child.value] : child.value }),
    };
}

export function cloneUnifiedViewState(state: UnifiedLibraryViewState): UnifiedLibraryViewState {
    return {
        ...state,
        sorts: state.sorts.map((sort) => ({ ...sort })),
        filters: state.filters.map((rule) => ({ ...rule, value: Array.isArray(rule.value) ? [...rule.value] : rule.value })),
        filterGroup: cloneFilterGroup(state.filterGroup),
        savedViews: state.savedViews.map((view) => ({ ...view, state: cloneSavedViewState(view.state) })),
    };
}

function cloneSavedViewState(state: UnifiedSavedView['state']): UnifiedSavedView['state'] {
    return {
        ...state,
        sorts: state.sorts.map((sort) => ({ ...sort })),
        filters: state.filters.map((rule) => ({ ...rule, value: Array.isArray(rule.value) ? [...rule.value] : rule.value })),
        filterGroup: cloneFilterGroup(state.filterGroup),
    };
}

export function addSavedView(state: UnifiedLibraryViewState, name: string, id = createViewId('view')): UnifiedLibraryViewState {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Saved view name cannot be empty');
    if (state.savedViews.some((view) => view.id === id)) throw new Error(`Saved view already exists: ${id}`);
    const next = cloneUnifiedViewState(state);
    next.savedViews.push({
        id,
        name: trimmedName,
        state: cloneSavedViewState({
            sorts: state.sorts,
            filterMode: state.filterMode,
            filters: state.filters,
            filterGroup: state.filterGroup,
            groupProperty: state.groupProperty,
            groupDirection: state.groupDirection,
            activeSavedViewId: state.activeSavedViewId,
        }),
    });
    return next;
}

export function applySavedView(state: UnifiedLibraryViewState, id: string): UnifiedLibraryViewState {
    const view = state.savedViews.find((candidate) => candidate.id === id);
    if (!view) throw new Error(`Saved view not found: ${id}`);
    return {
        ...cloneSavedViewState(view.state),
        savedViews: state.savedViews.map((candidate) => ({ ...candidate, state: cloneSavedViewState(candidate.state) })),
        activeSavedViewId: id,
    };
}

export function updateSavedView(state: UnifiedLibraryViewState, id: string): UnifiedLibraryViewState {
    const view = state.savedViews.find((candidate) => candidate.id === id);
    if (!view) throw new Error(`Saved view not found: ${id}`);
    if (view.readonly) throw new Error(`Saved view is read-only: ${id}`);
    const next = cloneUnifiedViewState(state);
    const snapshot = cloneSavedViewState({
        sorts: state.sorts,
        filterMode: state.filterMode,
        filters: state.filters,
        filterGroup: state.filterGroup,
        groupProperty: state.groupProperty,
        groupDirection: state.groupDirection,
        activeSavedViewId: id,
    });
    next.savedViews = next.savedViews.map((candidate) => candidate.id === id ? { ...candidate, state: snapshot } : candidate);
    next.activeSavedViewId = id;
    return next;
}

export function renameSavedView(state: UnifiedLibraryViewState, id: string, name: string): UnifiedLibraryViewState {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Saved view name cannot be empty');
    const view = state.savedViews.find((candidate) => candidate.id === id);
    if (!view) throw new Error(`Saved view not found: ${id}`);
    if (view.readonly) throw new Error(`Saved view is read-only: ${id}`);
    return {
        ...cloneUnifiedViewState(state),
        savedViews: state.savedViews.map((candidate) => candidate.id === id ? { ...candidate, name: trimmedName } : candidate),
    };
}

export function deleteSavedView(state: UnifiedLibraryViewState, id: string): UnifiedLibraryViewState {
    const view = state.savedViews.find((candidate) => candidate.id === id);
    if (!view) throw new Error(`Saved view not found: ${id}`);
    if (view.readonly) throw new Error(`Saved view is read-only: ${id}`);
    const next = cloneUnifiedViewState(state);
    next.savedViews = next.savedViews.filter((candidate) => candidate.id !== id);
    if (next.activeSavedViewId === id) next.activeSavedViewId = '';
    return next;
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

export function fromLegacyViewState(state: { rules: FilterRule[]; sorts: SortSpec[]; group: GroupSpec }): UnifiedLibraryViewState {
    const group = createEmptyFilterGroup('and', 'root');
    group.children = state.rules.map((rule) => ({ ...rule, value: Array.isArray(rule.value) ? [...rule.value] : rule.value }));
    return {
        sorts: state.sorts.map((sort) => ({ ...sort })),
        filterMode: 'and',
        filters: state.rules.map((rule) => ({ ...rule, value: Array.isArray(rule.value) ? [...rule.value] : rule.value })),
        filterGroup: group,
        groupProperty: state.group.mode === 'field' ? state.group.field ?? '' : '',
        groupDirection: state.group.order,
        savedViews: [],
        activeSavedViewId: '',
    };
}
