import type { MediaType } from '../../types';
import type { LibraryManager } from './LibraryManager';
import type { LibraryDefinition, LibraryItem } from './types';

/** UI-neutral identity for the single active Library surface. */
export type ActiveLibrary =
    | { kind: 'builtin'; mediaType: MediaType }
    | { kind: 'custom'; libraryId: string };

export interface LibrarySelectionOption {
    id: string;
    name: string;
    icon: string;
    kind: 'builtin' | 'custom';
    definition: LibraryDefinition;
}

export interface LibrarySelectionSnapshot {
    active: ActiveLibrary;
    option: LibrarySelectionOption | null;
    items: LibraryItem[];
}

export function builtinSelection(mediaType: MediaType): ActiveLibrary {
    return { kind: 'builtin', mediaType };
}

export function customSelection(libraryId: string): ActiveLibrary {
    return { kind: 'custom', libraryId };
}

export function selectionId(selection: ActiveLibrary): string {
    return selection.kind === 'builtin' ? selection.mediaType : selection.libraryId;
}

export function toLibrarySelectionOption(definition: LibraryDefinition): LibrarySelectionOption {
    return {
        id: definition.id,
        name: definition.name,
        icon: definition.icon,
        kind: definition.kind === 'custom' ? 'custom' : 'builtin',
        definition,
    };
}

export function buildLibrarySelectionOptions(definitions: LibraryDefinition[]): LibrarySelectionOption[] {
    return definitions.map(toLibrarySelectionOption);
}

export function findLibrarySelection(
    definitions: LibraryDefinition[],
    id: string | null | undefined,
): LibrarySelectionOption | null {
    if (!id) return null;
    const definition = definitions.find((candidate) => candidate.id === id);
    return definition ? toLibrarySelectionOption(definition) : null;
}

export function resolveSelection(
    manager: LibraryManager,
    selection: ActiveLibrary,
): LibrarySelectionOption | null {
    if (selection.kind === 'builtin') {
        const definition = manager.listLibraries().find(
            (candidate) => candidate.kind === 'builtin'
                && candidate.source.kind === 'builtin'
                && candidate.source.mediaType === selection.mediaType,
        );
        return definition ? toLibrarySelectionOption(definition) : null;
    }

    const definition = manager.getLibrary(selection.libraryId);
    return definition ? toLibrarySelectionOption(definition) : null;
}

/** Load the data owned by the active Library surface. Built-ins stay with their media services. */
export async function loadSelectionItems(
    manager: LibraryManager,
    selection: ActiveLibrary,
): Promise<LibraryItem[]> {
    if (selection.kind !== 'custom') return [];
    return manager.loadItems(selection.libraryId);
}
