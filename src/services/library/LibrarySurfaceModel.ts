import type { LibraryManager } from './LibraryManager';
import {
    buildLibrarySelectionOptions,
    customSelection,
    builtinSelection,
    resolveSelection,
    selectionId,
    type ActiveLibrary,
    type LibrarySelectionOption,
} from './LibrarySelection';
import type { LibraryItem } from './types';
import type { MediaType } from '../../types';

/**
 * UI-neutral state for the single Library surface.
 *
 * Built-in media libraries and folder-backed custom libraries share this model;
 * UI components only need to render the current option and react to selection
 * changes. Loading remains delegated to LibraryManager.
 */
export class LibrarySurfaceModel {
    private active: ActiveLibrary;
    private items: LibraryItem[] = [];

    constructor(
        private readonly manager: LibraryManager,
        initialMediaType: MediaType,
    ) {
        this.active = builtinSelection(initialMediaType);
    }

    getSelection(): ActiveLibrary {
        return this.active;
    }

    getSelectionId(): string {
        return selectionId(this.active);
    }

    getOptions(): LibrarySelectionOption[] {
        return buildLibrarySelectionOptions(this.manager.listLibraries());
    }

    getCurrentOption(): LibrarySelectionOption | null {
        return resolveSelection(this.manager, this.active);
    }

    getItems(): LibraryItem[] {
        return this.items;
    }

    selectBuiltin(mediaType: MediaType): void {
        this.active = builtinSelection(mediaType);
        this.items = [];
    }

    selectCustom(libraryId: string): void {
        const option = resolveSelection(this.manager, customSelection(libraryId));
        if (!option || option.kind !== 'custom') {
            throw new Error(`Custom library not found: ${libraryId}`);
        }
        this.active = customSelection(libraryId);
        this.items = [];
    }

    async load(): Promise<LibraryItem[]> {
        if (this.active.kind === 'builtin') {
            this.items = [];
            return this.items;
        }

        this.items = await this.manager.loadItems(this.active.libraryId);
        return this.items;
    }
}
