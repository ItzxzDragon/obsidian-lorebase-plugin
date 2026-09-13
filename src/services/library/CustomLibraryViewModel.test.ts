import { describe, expect, it, vi } from 'vitest';
import type { LibraryDefinition, LibraryItem } from './types';
import { CustomLibraryViewModel } from './CustomLibraryViewModel';

const definition: LibraryDefinition = {
    id: 'custom',
    name: 'Custom',
    icon: 'library',
    source: { kind: 'folder', folder: 'Library' },
    schema: {
        fields: [
            { id: 'yaml:rating', label: 'Rating', icon: 'star', type: 'number', source: 'yaml', operators: ['equals'] },
        ],
    },
};

const item = (name: string, rating: number): LibraryItem => ({
    file: {} as LibraryItem['file'],
    values: { name, 'yaml:rating': rating },
});

describe('CustomLibraryViewModel', () => {
    it('exposes the custom definition and schema fields', () => {
        const manager = {
            registry: { get: vi.fn().mockReturnValue(definition) },
            loadItems: vi.fn(),
        } as unknown as ConstructorParameters<typeof CustomLibraryViewModel>[0];
        const model = new CustomLibraryViewModel(manager);

        expect(model.getDefinition('custom')).toEqual(definition);
        expect(model.getFields('custom')).toEqual(definition.schema.fields);
    });

    it('loads items through the manager and applies the shared view pipeline', async () => {
        const items = [item('Low', 2), item('High', 9)];
        const manager = {
            registry: { get: vi.fn().mockReturnValue(definition) },
            loadItems: vi.fn().mockResolvedValue(items),
        } as unknown as ConstructorParameters<typeof CustomLibraryViewModel>[0];
        const model = new CustomLibraryViewModel(manager);

        const groups = await model.query('custom', {
            rules: [],
            sorts: [{ field: 'yaml:rating', order: 'desc' }],
            group: { mode: 'field', field: 'yaml:rating', order: 'asc' },
        });

        expect(manager.loadItems).toHaveBeenCalledWith('custom');
        expect(groups.map((group) => group.label)).toEqual(['2', '9']);
        expect(groups[1].items[0].values.name).toBe('High');
    });
});
