import type { MediaType } from '../../types';
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
import type { LibraryItem } from './types';

export interface LibrarySurfaceSnapshot {
    selection: ActiveLibrary;
    selectionId: string;
    option: LibrarySelectionOption | null;
    isCustom: boolean;
}

/** Coordinates selection and loading for the single Library surface. */
export class LibrarySurfaceController {
    private active: ActiveLibrary;

    constructor(
        private readonly manager: LibraryManager,
        initialMediaType: MediaType,
    ) {
        this.active = builtinSelection(initialMediaType);
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

    /** @deprecated Use loadItems(). */
    async loadCustomItems(): Promise<LibraryItem[]> {
        return this.loadItems();
    }
}
