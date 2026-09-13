import type { FieldDefinition, MediaType } from '../../types';
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
import type { LibraryDefinition, LibraryItem } from './types';

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

    getCurrentDefinition(): LibraryDefinition | null {
        return this.getCurrentOption()?.definition ?? null;
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

        const selectionAtStart = this.getSelectionId();
        const definition = this.getCurrentDefinition();
        if (!definition || definition.kind !== 'custom') {
            parent.empty();
            return;
        }

        const items = await this.loadItems();
        if (this.getSelectionId() !== selectionAtStart || !this.isCustomSelected()) return;

        this.renderer.render(parent, items, definition, options);
    }

    /** Render the current custom selection without duplicating selection checks in the caller. */
    async renderCurrentCustomLibrary(
        parent: HTMLElement,
        options: LibrarySurfaceRenderOptions = {},
    ): Promise<boolean> {
        if (!this.isCustomSelected()) return false;
        await this.renderCustomLibrary(parent, options);
        return true;
    }

    /** Resolve the schema fields used by the active custom library's shared pipeline. */
    getCurrentCustomFields(): FieldDefinition[] {
        const definition = this.getCurrentDefinition();
        return definition?.kind === 'custom' ? definition.schema.fields : [];
    }

    /** Return properties visible to the active custom library's schema editor. */
    getCurrentCustomProperties(): string[] {
        const definition = this.getCurrentDefinition();
        if (!definition || definition.kind !== 'custom') return [];
        return this.manager.getAvailableProperties(definition.id);
    }

    /** @deprecated Use loadItems(). */
    async loadCustomItems(): Promise<LibraryItem[]> {
        return this.loadItems();
    }
}
