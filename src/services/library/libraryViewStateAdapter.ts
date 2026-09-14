import type { FieldDefinition, FilterRule, GroupSpec, LibraryViewState, SortSpec } from '../../types';
import type { LibraryDefinition } from './types';
import { createEmptyFilterGroup, type FilterGroup } from './unifiedViewState';

export interface LibraryPipelineState {
    filters: FilterRule[] | FilterGroup;
    sorts: SortSpec[];
    group: GroupSpec;
    fields: FieldDefinition[];
}

/** Converts the existing LibraryView state into the shared custom-library pipeline. */
export function toLibraryPipelineState(
    state: LibraryViewState,
    definition: LibraryDefinition,
): LibraryPipelineState {
    const fields = definition.schema.fields;
    const filters = state.filterGroup
        ? cloneFilterGroup(state.filterGroup)
        : state.rules.length > 0
            ? state.rules.map((rule) => ({ ...rule }))
            : createEmptyFilterGroup('and', 'root');

    const sorts: SortSpec[] = state.sort.field
        ? [{ field: state.sort.field, order: state.sort.order }]
        : [];

    return {
        filters,
        sorts,
        group: { ...state.group },
        fields,
    };
}

export function pipelineStateToLibraryViewState(
    current: LibraryViewState,
    pipeline: Pick<LibraryPipelineState, 'sorts' | 'group' | 'filters'>,
): LibraryViewState {
    const firstSort = pipeline.sorts[0];
    const filterGroup = Array.isArray(pipeline.filters)
        ? createFilterGroupFromRules(pipeline.filters)
        : cloneFilterGroup(pipeline.filters);

    return {
        ...current,
        sort: firstSort
            ? { field: firstSort.field, order: firstSort.order }
            : current.sort,
        group: { ...pipeline.group },
        rules: flattenFilterRules(filterGroup),
        filterGroup,
    };
}

function cloneFilterGroup(group: FilterGroup): FilterGroup {
    return {
        kind: 'group',
        id: group.id,
        mode: group.mode,
        children: group.children.map((child) => child.kind === 'group'
            ? cloneFilterGroup(child)
            : { ...child, value: Array.isArray(child.value) ? [...child.value] : child.value }),
    };
}

function createFilterGroupFromRules(rules: FilterRule[]): FilterGroup {
    const group = createEmptyFilterGroup('and', 'root');
    group.children = rules.map((rule) => ({
        ...rule,
        value: Array.isArray(rule.value) ? [...rule.value] : rule.value,
    }));
    return group;
}

function flattenFilterRules(group: FilterGroup): FilterRule[] {
    const rules: FilterRule[] = [];
    for (const child of group.children) {
        if (child.kind === 'group') rules.push(...flattenFilterRules(child));
        else rules.push({ ...child, value: Array.isArray(child.value) ? [...child.value] : child.value });
    }
    return rules;
}
