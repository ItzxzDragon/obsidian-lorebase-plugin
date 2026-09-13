import { describe, expect, it, vi } from 'vitest';
import { CustomLibraryController } from './CustomLibraryController';

const definition = {
    id: 'notes',
    name: 'Notes',
    icon: 'library',
    source: { kind: 'folder' as const, folder: 'Notes' },
    schema: { fields: [] },
};

describe('CustomLibraryController', () => {
    it('starts without an active library', () => {
        const model = { getDefinition: vi.fn(), load: vi.fn(), query: vi.fn() } as any;
        const controller = new CustomLibraryController(model);

        expect(controller.getActiveLibraryId()).toBeNull();
        expect(controller.getActiveDefinition()).toBeUndefined();
    });

    it('selects a known custom library and delegates queries', async () => {
        const groups = [{ key: 'all', label: 'All', items: [] }];
        const model = {
            getDefinition: vi.fn().mockReturnValue(definition),
            load: vi.fn().mockResolvedValue([]),
            query: vi.fn().mockResolvedValue(groups),
        } as any;
        const controller = new CustomLibraryController(model);

        controller.setActiveLibrary('notes');

        expect(controller.getActiveLibraryId()).toBe('notes');
        expect(controller.getActiveDefinition()).toEqual(definition);
        await expect(controller.getActiveItems()).resolves.toEqual([]);
        await expect(controller.query({ rules: [], sorts: [], group: { mode: 'none', order: 'asc' } })).resolves.toEqual(groups);
        expect(model.query).toHaveBeenCalledWith('notes', { rules: [], sorts: [], group: { mode: 'none', order: 'asc' } });
    });

    it('rejects unknown libraries and can clear the selection', () => {
        const model = { getDefinition: vi.fn().mockReturnValue(undefined), load: vi.fn(), query: vi.fn() } as any;
        const controller = new CustomLibraryController(model);

        expect(() => controller.setActiveLibrary('missing')).toThrow('Custom library not found: missing');
        controller.setActiveLibrary(null);
        expect(controller.getActiveLibraryId()).toBeNull();
    });
});
