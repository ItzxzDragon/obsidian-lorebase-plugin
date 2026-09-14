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

function state(filterGroup?: NonNullable<LibraryViewState['filterGroup']>): LibraryViewState {
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
        ...(filterGroup ? { filterGroup } : {}),
        tags: [],
        genres: [],
    };
}

describe('libraryViewStateAdapter', () => {
    it('maps legacy flat rules into the root filter group', () => {
        const pipeline = toLibraryPipelineState(state(), definition());

        expect(pipeline.sorts).toEqual([{ field: 'yaml:rating', order: 'desc' }]);
        expect(pipeline.group).toEqual({ mode: 'field', order: 'asc', field: 'yaml:status' });
        expect(pipeline.filters).toMatchObject({ kind: 'group', mode: 'and' });
        expect(pipeline.filters.children).toEqual(state().rules);
    });

    it('preserves nested filter groups through the adapter round trip', () => {
        const filterGroup = {
            kind: 'group' as const,
            id: 'root',
            mode: 'and' as const,
            children: [
                {
                    kind: 'group' as const,
                    id: 'nested',
                    mode: 'or' as const,
                    children: [
                        { id: 'rule-a', field: 'genre', operator: 'equals', value: 'A', fieldType: 'text' },
                        { id: 'rule-b', field: 'genre', operator: 'equals', value: 'B', fieldType: 'text' },
                    ],
                },
            ],
        };
        const current = state(filterGroup);
        const pipeline = toLibraryPipelineState(current, definition());
        const next = pipelineStateToLibraryViewState(current, pipeline);

        expect(next.filterGroup).toEqual(filterGroup);
        expect(next.rules).toEqual(current.rules);
        expect(next.filterGroup?.children[0]).toMatchObject({
            kind: 'group',
            id: 'nested',
            mode: 'or',
        });
    });
});
