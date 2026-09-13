import type { LibraryDefinition } from './types';

/**
 * UI-neutral selection model for the shared Library surface.
 * Built-in and custom libraries are deliberately represented by the same entry
 * so the toolbar/view layer does not need a second custom-library workflow.
 */
export interface LibrarySelectionOption {
    id: string;
    name: string;
    icon: string;
    kind: 'builtin' | 'custom';
    definition: LibraryDefinition;
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
