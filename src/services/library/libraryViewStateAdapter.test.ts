import { describe, expect, it } from 'vitest';
import type { LibraryDefinition } from './types';
import { pipelineStateToLibraryViewState, toLibraryPipelineState } from './libraryViewStateAdapter';
import type { LibraryViewState } from '../../types';

function definition(): LibraryDefinition {
    return {
        id: 'custom',
        name: 'Custom',
        icon: 'library',
        kind: 'custom',
        source: { kind: 'folder', folder: 'Library' },
        propertyScope: 'folder',
        schema: { fields: [] },
    };
}

function state(): LibraryViewState {
    return {
        sort: { field: 'yaml:rating', order: 'desc' },
        group: { mode: 'field', order: 'asc', field: 'yaml:status' },
        rules: [{
            id: 'rule-1',
            field: 'yaml:status',
            fieldType: 'text',
            operator: 'equals',
            value: 'Done',
        }],
        tags: [],
        genres: [],
    };
}

describe('libraryViewStateAdapter', () => {
    it('maps the existing view state into the shared pipeline', () => {
        const pipeline = toLibraryPipelineState(state(), definition());

        expect(pipeline.sorts).toEqual([{ field: 'yaml:rating', order: 'desc' }]);
        expect(pipeline.group).toEqual({ mode: 'field', order: 'asc', field: 'yaml:status' });
        expect(pipeline.filters).toEqual(state().rules);
    });

    it('preserves current state when the pipeline has no explicit sort', () => {
        const current = state();
        const next = pipelineStateToLibraryViewState(current, {
            sorts: [],
            group: { mode: 'none', order: 'asc' },
            filters: [],
        });

        expect(next.sort).toEqual(current.sort);
        expect(next.group).toEqual({ mode: 'none', order: 'asc' });
        expect(next.rules).toEqual([]);
    });
});
