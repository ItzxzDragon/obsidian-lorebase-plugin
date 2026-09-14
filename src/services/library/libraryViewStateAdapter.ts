import type { FieldDefinition, LibraryViewState, GroupSpec, SortSpec } from '../../types';
import type { LibraryDefinition } from './types';
import { cloneFilterGroup, createEmptyFilterGroup, type FilterGroup } from './unifiedViewState';

export interface LibraryPipelineState {
    /** Canonical hierarchical filter state. Never flatten nested groups here. */
    filters: FilterGroup;
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
        : createFilterGroupFromLegacyRules(state.rules);

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
    const filterGroup = cloneFilterGroup(pipeline.filters);

    return {
        ...current,
        sort: firstSort
            ? { field: firstSort.field, order: firstSort.order }
            : current.sort,
        group: { ...pipeline.group },
        // Keep the tree as the canonical filter representation. `rules` remains
        // untouched so legacy consumers cannot destroy nested-group structure.
        filterGroup,
    };
}

function createFilterGroupFromLegacyRules(rules: LibraryViewState['rules']): FilterGroup {
    const group = createEmptyFilterGroup('and', 'root');
    group.children = rules.map((rule) => ({
        ...rule,
        value: Array.isArray(rule.value) ? [...rule.value] : rule.value,
    }));
    return group;
}
