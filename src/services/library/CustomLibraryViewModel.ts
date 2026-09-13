import type { FieldDefinition, FilterRule, GroupSpec, SortSpec } from '../../types';
import type { LibraryDefinition, LibraryItem } from './types';
import { LibraryManager } from './LibraryManager';
import { applyLibraryView, type LibraryGroup } from './viewPipeline';
import { fromLegacyViewState, type UnifiedLibraryViewState } from './unifiedViewState';

/** Legacy query shape kept temporarily as an adapter for callers not yet migrated to the main Toolbar. */
export interface CustomLibraryViewState {
    rules: FilterRule[];
    sorts: SortSpec[];
    group: GroupSpec;
}

/** Loads custom-library data while keeping view state independent from the eventual UI integration. */
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

    async query(id: string, state: CustomLibraryViewState | UnifiedLibraryViewState): Promise<LibraryGroup<LibraryItem>[]> {
        const items = await this.load(id);
        const legacy = 'rules' in state && 'sorts' in state && 'group' in state;
        const normalized = legacy
            ? fromLegacyViewState(state)
            : state;
        return applyLibraryView(
            items,
            normalized.filterGroup,
            normalized.sorts,
            {
                mode: normalized.groupProperty ? 'field' : 'none',
                field: normalized.groupProperty || undefined,
                order: normalized.groupDirection,
            },
            this.getFields(id),
        );
    }
}
