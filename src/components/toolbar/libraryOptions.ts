import type { MediaType } from '../../types';
import type { LibraryDefinition } from '../../services/library/types';
import type { LibrarySelectionOption } from '../../services/library/LibrarySelection';

export interface ToolbarLibraryOption {
    id: string;
    label: string;
    icon: string;
    kind: 'builtin' | 'custom';
    mediaType?: MediaType;
    libraryId?: string;
}

/**
 * Builds the single Library selector model used by the existing toolbar.
 * Built-ins and custom libraries deliberately share one option shape so the
 * toolbar does not need a second custom-library control or pane.
 */
export function buildToolbarLibraryOptions(
    options: LibrarySelectionOption[],
): ToolbarLibraryOption[] {
    return options.map((option) => toToolbarLibraryOption(option));
}

export function toToolbarLibraryOption(
    option: LibrarySelectionOption,
): ToolbarLibraryOption {
    if (option.kind === 'custom') {
        return {
            id: option.id,
            label: option.name,
            icon: option.icon,
            kind: 'custom',
            libraryId: option.id,
        };
    }

    const mediaType = option.definition.source.kind === 'builtin'
        ? option.definition.source.mediaType
        : undefined;

    return {
        id: option.id,
        label: option.name,
        icon: option.icon,
        kind: 'builtin',
        mediaType,
    };
}

export function findToolbarLibraryOption(
    options: ToolbarLibraryOption[],
    id: string,
): ToolbarLibraryOption | null {
    return options.find((option) => option.id === id) ?? null;
}

export function customLibraryDefinitions(
    options: LibrarySelectionOption[],
): LibraryDefinition[] {
    return options
        .filter((option) => option.kind === 'custom')
        .map((option) => option.definition);
}
