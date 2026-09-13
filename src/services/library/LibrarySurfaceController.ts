import type { FieldDefinition, GroupSpec, MediaType } from '../../types';
import type { LibraryManager } from './LibraryManager';
import {
    buildLibrarySelectionOptions,
    builtinSelection,
    customSelection,
    loadSelectionItems,
    resolveSelection,
    selectionId,
    type ActiveLibrary,
    type LibrarySelectionOption,
} from './LibrarySelection';
import { LibrarySurfaceRenderer, type LibrarySurfaceRenderOptions } from './LibrarySurfaceRenderer';
import type { LibraryItem } from './types';

export interface LibrarySurfaceSnapshot {
    selection: ActiveLibrary;
    selectionId: string;
    option: LibrarySelectionOption | null;
    isCustom: boolean;
}

export interface LibrarySurfaceControllerOptions {
    renderer?: LibrarySurfaceRenderer;
}

/** Coordinates selection, loading, and rendering for the single Library surface. */
export class LibrarySurfaceController {
    private active: ActiveLibrary;
    private readonly renderer: LibrarySurfaceRenderer;

    constructor(
        private readonly manager: LibraryManager,
        initialMediaType: MediaType,
        options: LibrarySurfaceControllerOptions = {},
    ) {
        this.active = builtinSelection(initialMediaType);
        this.renderer = options.renderer ?? new LibrarySurfaceRenderer();
    }

    /** All Built-in and Custom libraries available to the same selector. */
    getOptions(): LibrarySelectionOption[] {
        return buildLibrarySelectionOptions(this.manager.listLibraries());
    }

    getSelection(): ActiveLibrary {
        return this.active;
    }

    getSelectionId(): string {
        return selectionId(this.active);
    }

    getCurrentOption(): LibrarySelectionOption | null {
        return resolveSelection(this.manager, this.active);
    }

    getSnapshot(): LibrarySurfaceSnapshot {
        return {
            selection: this.active,
            selectionId: this.getSelectionId(),
            option: this.getCurrentOption(),
            isCustom: this.isCustomSelected(),
        };
    }

    isCustomSelected(): boolean {
        return this.active.kind === 'custom';
    }

    getCurrentCustomLibraryId(): string | null {
        return this.active.kind === 'custom' ? this.active.libraryId : null;
    }

    /** Apply an option emitted by the shared Library selector. */
    selectOption(option: LibrarySelectionOption): void {
        if (option.kind === 'custom') {
            this.selectCustom(option.id);
            return;
        }

        if (option.definition.source.kind !== 'builtin') {
            throw new Error(`Built-in library has an invalid source: ${option.id}`);
        }
        this.selectBuiltin(option.definition.source.mediaType);
    }

    selectBuiltin(mediaType: MediaType): void {
        this.active = builtinSelection(mediaType);
    }

    selectCustom(libraryId: string): void {
        const option = resolveSelection(this.manager, customSelection(libraryId));
        if (!option || option.kind !== 'custom') {
            throw new Error(`Custom library not found: ${libraryId}`);
        }
        this.active = customSelection(libraryId);
    }

    /** Load items for the current selection; built-ins remain owned by their media services. */
    async loadItems(): Promise<LibraryItem[]> {
        return loadSelectionItems(this.manager, this.active);
    }

    /** Render the active custom library through the shared View/Filter/Sort/Group pipeline. */
    async renderCustomLibrary(
        parent: HTMLElement,
        options: LibrarySurfaceRenderOptions = {},
    ): Promise<void> {
        if (!this.isCustomSelected()) {
            parent.empty();
            return;
        }

        const definition = this.getCurrentOption()?.definition;
        if (!definition || definition.kind !== 'custom') {
            parent.empty();
            return;
        }

        const items = await this.loadItems();
        this.renderer.render(parent, items, definition, options);
    }

    /** Resolve the fields used by the active custom library's shared pipeline. */
    getCurrentCustomFields(): FieldDefinition[] {
        const definition = this.getCurrentOption()?.definition;
        return definition?.kind === 'custom' ? definition.schema.fields : [];
    }

    /** Resolve the group configuration used by the active custom library. */
    getCurrentCustomGroup(): GroupSpec | null {
        const definition = this.getCurrentOption()?.definition;
        return definition?.kind === 'custom' && definition.group ? definition.group : null;
    }

    /** @deprecated Use loadItems(). */
    async loadCustomItems(): Promise<LibraryItem[]> {
        return this.loadItems();
    }
}
