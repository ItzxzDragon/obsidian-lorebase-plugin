import type { FieldDefinition, FilterRule, GroupSpec, SortSpec } from '../../types';
import type { LibraryDefinition, LibraryItem } from './types';
import { LibraryManager } from './LibraryManager';
import { applyLibraryView, type LibraryGroup } from './viewPipeline';

export interface CustomLibraryViewState {
    rules: FilterRule[];
    sorts: SortSpec[];
    group: GroupSpec;
}

/** Loads a custom library and applies the shared filter/sort/group pipeline. */
export class CustomLibraryViewModel {
    constructor(private readonly manager: LibraryManager) {}

    getDefinition(id: string): LibraryDefinition | undefined {
        const definition = this.manager.registry.get(id);
        return definition?.source.kind === 'folder' ? definition : undefined;
    }

    getFields(id: string): FieldDefinition[] {
        return this.getDefinition(id)?.schema.fields ?? [];
    }

    async load(id: string): Promise<LibraryItem[]> {
        const definition = this.getDefinition(id);
        return definition ? this.manager.loadItems(id) : [];
    }

    async query(id: string, state: CustomLibraryViewState): Promise<LibraryGroup<LibraryItem>[]> {
        const items = await this.load(id);
        return applyLibraryView(items, state.rules, state.sorts, state.group, this.getFields(id));
    }
}
