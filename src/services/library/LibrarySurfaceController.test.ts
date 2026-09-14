import { describe, expect, it, vi } from 'vitest';
import { LibrarySurfaceController } from './LibrarySurfaceController';
import type { LibraryManager } from './LibraryManager';
import type { LibraryDefinition } from './types';
import type { LibrarySelectionOption } from './LibrarySelection';
import type { LibrarySurfaceRenderer } from './LibrarySurfaceRenderer';

function customLibrary(id = 'my-library'): LibraryDefinition {
    return {
        id,
        name: 'My Library',
        icon: 'library',
        kind: 'custom',
        source: { kind: 'folder', folder: 'Library' },
        propertyScope: 'folder',
        schema: { fields: [] },
    };
}

function builtinLibrary(): LibraryDefinition {
    return {
        id: 'game',
        name: 'Games',
        icon: 'gamepad-2',
        kind: 'builtin',
        source: { kind: 'builtin', mediaType: 'game' },
        schema: { fields: [] },
    };
}

describe('LibrarySurfaceController', () => {
    it('starts on the selected built-in media library', () => {
        const manager = { listLibraries: () => [] } as unknown as LibraryManager;
        const controller = new LibrarySurfaceController(manager, 'game');

        expect(controller.getSelection()).toEqual({ kind: 'builtin', mediaType: 'game' });
    });

    it('selects and resolves a custom library through LibraryManager', () => {
        const definition = customLibrary();
        const manager = {
            getLibrary: vi.fn((id: string) => id === definition.id ? definition : undefined),
            listLibraries: vi.fn(() => [definition]),
            loadItems: vi.fn(async () => []),
        } as unknown as LibraryManager;
        const controller = new LibrarySurfaceController(manager, 'game');

        controller.selectCustom(definition.id);

        expect(controller.getSelection()).toEqual({ kind: 'custom', libraryId: definition.id });
        expect(controller.getCurrentOption()).toMatchObject({
            id: definition.id,
            kind: 'custom',
            name: definition.name,
        });
    });

    it('applies a custom option emitted by the shared selector', () => {
        const definition = customLibrary();
        const option: LibrarySelectionOption = {
            id: definition.id,
            name: definition.name,
            icon: definition.icon,
            kind: 'custom',
            definition,
        };
        const manager = {
            getLibrary: vi.fn((id: string) => id === definition.id ? definition : undefined),
            listLibraries: vi.fn(() => [definition]),
        } as unknown as LibraryManager;
        const controller = new LibrarySurfaceController(manager, 'game');

        controller.selectOption(option);

        expect(controller.getSnapshot()).toMatchObject({
            selectionId: definition.id,
            isCustom: true,
        });
    });

    it('applies a built-in option emitted by the shared selector', () => {
        const definition = builtinLibrary();
        const option: LibrarySelectionOption = {
            id: definition.id,
            name: definition.name,
            icon: definition.icon,
            kind: 'builtin',
            definition,
        };
        const manager = {
            listLibraries: vi.fn(() => [definition]),
        } as unknown as LibraryManager;
        const controller = new LibrarySurfaceController(manager, 'anime');

        controller.selectOption(option);

        expect(controller.getSelection()).toEqual({ kind: 'builtin', mediaType: 'game' });
    });

    it('renders the selected custom library through the shared renderer', async () => {
        const definition = customLibrary();
        const items = [{ file: { path: 'Library/one.md' }, values: { name: 'One' } }];
        const manager = {
            getLibrary: vi.fn((id: string) => id === definition.id ? definition : undefined),
            listLibraries: vi.fn(() => [definition]),
            loadItems: vi.fn(async () => items),
        } as unknown as LibraryManager;
        const renderer = {
            render: vi.fn(),
        } as unknown as LibrarySurfaceRenderer;
        const controller = new LibrarySurfaceController(manager, 'game', { renderer });
        const parent = document.createElement('div');

        controller.selectCustom(definition.id);
        await controller.renderCustomLibrary(parent, { sorts: [] });

        expect(manager.loadItems).toHaveBeenCalledWith(definition.id);
        expect(renderer.render).toHaveBeenCalledWith(
            parent,
            items,
            definition,
            expect.objectContaining({
                sorts: [],
                group: { mode: 'none', order: 'asc' },
                fields: [],
            })
        );
        const renderOptions = renderer.render.mock.calls[0]?.[3] as { rules?: { kind: string; mode: string } };
        expect(renderOptions.rules).toMatchObject({ kind: 'group', mode: 'and' });
    });

    it('restores and synchronizes custom library saved-view state', () => {
        const definition = customLibrary();
        const filterGroup = { kind: 'group' as const, id: 'root', mode: 'or' as const, children: [] };
        definition.filterMode = 'or';
        definition.filterGroup = filterGroup;
        definition.savedViews = [{
            id: 'view-1',
            name: 'Favorites',
            state: {
                sorts: [],
                filterMode: 'or',
                filters: [],
                filterGroup,
                groupProperty: 'yaml:Genre',
                groupDirection: 'desc',
                activeSavedViewId: 'view-1',
            },
        }];
        definition.activeSavedViewId = 'view-1';

        const manager = {
            getLibrary: vi.fn((id: string) => id === definition.id ? definition : undefined),
            listLibraries: vi.fn(() => [definition]),
        } as unknown as LibraryManager;
        const controller = new LibrarySurfaceController(manager, 'game');

        controller.selectCustom(definition.id);
        expect(controller.getViewState().activeSavedViewId).toBe('view-1');
        expect(controller.getViewState().savedViews[0]?.name).toBe('Favorites');

        controller.setGrouping('yaml:Status', 'asc');

        expect(definition.groupProperty).toBe('yaml:Status');
        expect(definition.groupDirection).toBe('asc');
        expect(definition.savedViews?.[0]?.name).toBe('Favorites');
    });

    it('rejects unknown custom libraries', () => {
        const manager = {
            getLibrary: () => undefined,
            listLibraries: () => [],
        } as unknown as LibraryManager;
        const controller = new LibrarySurfaceController(manager, 'game');

        expect(() => controller.selectCustom('missing')).toThrow('Custom library not found: missing');
    });
});
