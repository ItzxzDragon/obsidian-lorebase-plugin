import type { MediaType } from '../../types';
import type { LibraryManager } from './LibraryManager';
import type { LibraryDefinition, LibraryItem } from './types';
import { LibrarySelector } from '../../components/toolbar/LibrarySelector';
import { LibrarySurfaceRenderer } from './LibrarySurfaceRenderer';

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

/**
 * Installs the shared selector on the existing LibraryView instead of creating
 * another pane. Built-ins continue through the existing media renderer; selecting
 * a custom library switches the same content surface to LibrarySurfaceRenderer.
 */
function installLibrarySurfaceBridge(): void {
    const globalObject = globalThis as typeof globalThis & {
        __lorebaseLibrarySurfaceBridgeInstalled?: boolean;
    };
    if (globalObject.__lorebaseLibrarySurfaceBridgeInstalled) return;
    globalObject.__lorebaseLibrarySurfaceBridgeInstalled = true;

    void import('../../views/LibraryView').then(({ LibraryView }) => {
        const prototype = LibraryView.prototype as LibraryViewRuntime;
        const originalOpen = prototype.onOpen;
        const originalClose = prototype.onClose;

        prototype.onOpen = async function patchedOpen(this: LibraryViewRuntime): Promise<void> {
            await originalOpen.call(this);
            installSelector(this);
        };

        prototype.onClose = async function patchedClose(this: LibraryViewRuntime): Promise<void> {
            this.__lorebaseLibrarySurfaceCleanup?.();
            this.__lorebaseLibrarySurfaceCleanup = undefined;
            await originalClose.call(this);
        };
    }).catch((error) => {
        console.error('Failed to install LOREBASE Library selector bridge', error);
    });
}

interface LibraryViewRuntime {
    onOpen(): Promise<void>;
    onClose(): Promise<void>;
    contentEl: HTMLElement;
    plugin: {
        getLibraryManager?: () => LibraryManager | null;
        getMediaType: () => MediaType;
        switchMediaType: (mediaType: MediaType) => Promise<void> | void;
    };
    libraryContentEl?: HTMLElement | null;
    viewState?: {
        sort: { field: string; order: 'asc' | 'desc' };
        group: { mode: 'none' | 'series' | 'finishedMonth' | 'finishedYear' | 'field'; order: 'asc' | 'desc'; field?: string };
        rules: unknown[];
    };
    isDestroyed?: boolean;
    __lorebaseLibrarySurfaceCleanup?: () => void;
}

function installSelector(view: LibraryViewRuntime): void {
    const manager = view.plugin.getLibraryManager?.();
    if (!manager || view.isDestroyed) return;

    const toolbarLeft = view.contentEl.querySelector<HTMLElement>('.lorebase-toolbar-left');
    if (!toolbarLeft) return;

    const options = manager.listLibrarySelectionOptions();
    if (options.length === 0) return;

    toolbarLeft.querySelector('.lorebase-library-selector-host')?.remove();
    const selectedId = view.plugin.getMediaType();
    const host = toolbarLeft.createDiv({ cls: 'lorebase-library-selector-host' });
    const selector = new LibrarySelector(host, options, selectedId, {
        onSelect: (option) => {
            if (option.kind === 'builtin' && option.definition.source.kind === 'builtin') {
                void view.plugin.switchMediaType(option.definition.source.mediaType);
                return;
            }
            void renderCustomLibrary(view, manager, option.id);
        },
    });
    selector.render();

    view.__lorebaseLibrarySurfaceCleanup = () => host.remove();
}

async function renderCustomLibrary(
    view: LibraryViewRuntime,
    manager: LibraryManager,
    libraryId: string,
): Promise<void> {
    const definition = manager.getLibrary(libraryId);
    if (!definition || definition.kind !== 'custom' || definition.source.kind !== 'folder') return;

    const content = view.libraryContentEl;
    if (!content || view.isDestroyed) return;

    const items = await manager.loadItems(libraryId);
    if (view.isDestroyed || view.libraryContentEl !== content) return;

    const renderer = new LibrarySurfaceRenderer();
    renderer.render(content, items, definition, {
        rules: view.viewState?.rules as never[] | undefined,
        sorts: view.viewState ? [{ field: view.viewState.sort.field as never, order: view.viewState.sort.order }] : [],
        group: view.viewState
            ? { mode: view.viewState.group.mode, order: view.viewState.group.order, field: view.viewState.group.field }
            : { mode: 'none', order: 'asc' },
        fields: definition.schema.fields,
    });
    content.addClass('lorebase-custom-library-active');
}

installLibrarySurfaceBridge();
