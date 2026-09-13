import type { FieldDefinition, FilterRule, GroupSpec, LibraryViewState, SortSpec } from '../../types';
import type { LibraryDefinition } from './types';
import { emptyFilterGroup, type FilterGroup } from './unifiedViewState';

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
    const filters = state.rules.length > 0
        ? state.rules.map((rule) => ({ ...rule }))
        : emptyFilterGroup('and');

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
    const rules = Array.isArray(pipeline.filters) ? pipeline.filters : [];

    return {
        ...current,
        sort: firstSort
            ? { field: firstSort.field, order: firstSort.order }
            : current.sort,
        group: { ...pipeline.group },
        rules: rules.map((rule) => ({ ...rule })),
    };
}
