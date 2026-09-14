import type { FilterGroup, FilterMode, FilterNode, FilterRule, GroupSpec, SortSpec, SortOrder } from '../../types';

export type { FilterGroup, FilterMode, FilterNode } from '../../types';

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
    return 'kind' in node && node.kind === 'group';
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

export function addFilterRule(group: FilterGroup, rule: FilterRule, index?: number): FilterGroup {
    const next = cloneFilterGroup(group);
    const insertAt = index === undefined ? next.children.length : Math.max(0, Math.min(index, next.children.length));
    next.children.splice(insertAt, 0, {
        ...rule,
        value: Array.isArray(rule.value) ? [...rule.value] : rule.value,
    });
    return next;
}

export function addFilterGroup(group: FilterGroup, mode: FilterMode = 'and', index?: number, id = createViewId('filter-group')): FilterGroup {
    const next = cloneFilterGroup(group);
    const insertAt = index === undefined ? next.children.length : Math.max(0, Math.min(index, next.children.length));
    next.children.splice(insertAt, 0, createEmptyFilterGroup(mode, id));
    return next;
}

export function updateFilterGroupMode(group: FilterGroup, groupId: string, mode: FilterMode): FilterGroup {
    const next = cloneFilterGroup(group);
    const target = findFilterGroup(next, groupId);
    if (!target) throw new Error(`Filter group not found: ${groupId}`);
    target.mode = mode;
    return next;
}

export function updateFilterRule(group: FilterGroup, ruleId: string, update: Partial<FilterRule>): FilterGroup {
    const next = cloneFilterGroup(group);
    const rule = findFilterRule(next, ruleId);
    if (!rule) throw new Error(`Filter rule not found: ${ruleId}`);
    Object.assign(rule, update);
    if (Array.isArray(rule.value)) rule.value = [...rule.value];
    return next;
}

export function removeFilterNode(group: FilterGroup, nodeId: string): FilterGroup {
    if (group.id === nodeId) throw new Error('Cannot remove the root filter group');
    const next = cloneFilterGroup(group);
    if (!removeFilterNodeInPlace(next, nodeId)) throw new Error(`Filter node not found: ${nodeId}`);
    return next;
}

export function matchesFilterGroup(
    group: FilterGroup,
    matchesRule: (rule: FilterRule) => boolean
): boolean {
    if (group.mode === 'none') return true;
    const results = group.children.map((child) => isFilterGroup(child)
        ? matchesFilterGroup(child, matchesRule)
        : matchesRule(child));
    if (group.mode === 'or') return results.some(Boolean);
    return results.every(Boolean);
}

function findFilterGroup(group: FilterGroup, id: string): FilterGroup | undefined {
    if (group.id === id) return group;
    for (const child of group.children) {
        if (!isFilterGroup(child)) continue;
        const found = findFilterGroup(child, id);
        if (found) return found;
    }
    return undefined;
}

function findFilterRule(group: FilterGroup, id: string): FilterRule | undefined {
    for (const child of group.children) {
        if (isFilterGroup(child)) {
            const found = findFilterRule(child, id);
            if (found) return found;
        } else if (child.id === id) {
            return child;
        }
    }
    return undefined;
}

function removeFilterNodeInPlace(group: FilterGroup, nodeId: string): boolean {
    const index = group.children.findIndex((child) => child.id === nodeId);
    if (index !== -1) {
        group.children.splice(index, 1);
        return true;
    }
    for (const child of group.children) {
        if (isFilterGroup(child) && removeFilterNodeInPlace(child, nodeId)) return true;
    }
    return false;
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
