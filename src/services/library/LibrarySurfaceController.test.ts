import { describe, expect, it, vi } from 'vitest';
import { LibrarySurfaceController } from './LibrarySurfaceController';
import type { LibraryManager } from './LibraryManager';
import type { LibraryDefinition } from './types';
import type { LibrarySelectionOption } from './LibrarySelection';

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

    it('rejects unknown custom libraries', () => {
        const manager = {
            getLibrary: () => undefined,
            listLibraries: () => [],
        } as unknown as LibraryManager;
        const controller = new LibrarySurfaceController(manager, 'game');

        expect(() => controller.selectCustom('missing')).toThrow('Custom library not found: missing');
    });
});
