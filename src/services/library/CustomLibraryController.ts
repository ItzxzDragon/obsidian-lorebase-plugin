import type { FilterRule, GroupSpec, SortSpec } from '../../types';
import { CustomLibraryViewModel } from './CustomLibraryViewModel';
import type { LibraryDefinition, LibraryItem } from './types';
import type { LibraryGroup } from './viewPipeline';

export interface CustomLibraryQueryState {
    rules: FilterRule[];
    sorts: SortSpec[];
    group: GroupSpec;
}

/** Coordinates the active custom library without coupling the UI to storage details. */
export class CustomLibraryController {
    private activeLibraryId: string | null = null;

    constructor(private readonly model: CustomLibraryViewModel) {}

    getActiveLibraryId(): string | null {
        return this.activeLibraryId;
    }

    setActiveLibrary(id: string | null): void {
        if (id === null) {
            this.activeLibraryId = null;
            return;
        }

        const definition = this.model.getDefinition(id);
        if (!definition) throw new Error(`Custom library not found: ${id}`);
        this.activeLibraryId = id;
    }

    getActiveDefinition(): LibraryDefinition | undefined {
        return this.activeLibraryId ? this.model.getDefinition(this.activeLibraryId) : undefined;
    }

    getActiveItems(): Promise<LibraryItem[]> {
        if (!this.activeLibraryId) return Promise.resolve([]);
        return this.model.load(this.activeLibraryId);
    }

    query(state: CustomLibraryQueryState): Promise<LibraryGroup<LibraryItem>[]> {
        if (!this.activeLibraryId) return Promise.resolve([]);
        return this.model.query(this.activeLibraryId, state);
    }
}
