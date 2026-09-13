import type { FilterRule, GroupSpec, SortSpec } from '../../types';
import { applyLibraryView, type LibraryGroup } from './viewPipeline';
import { LibraryManager } from './LibraryManager';
import type { LibraryDefinition, LibraryItem } from './types';

/** Coordinates a custom library definition, its folder-backed items, and the shared view pipeline. */
export class CustomLibraryViewModel {
    private definition: LibraryDefinition | null = null;
    private items: LibraryItem[] = [];
    private groups: LibraryGroup<LibraryItem>[] = [];

    constructor(private readonly manager: LibraryManager) {}

    async open(id: string): Promise<LibraryDefinition> {
        const definition = this.manager.registry.get(id);
        if (!definition || definition.source.kind !== 'folder') {
            throw new Error(`Custom library not found: ${id}`);
        }

        this.definition = definition;
        this.items = await this.manager.loadItems(id);
        this.groups = [{ key: 'all', label: '', items: [...this.items] }];
        return definition;
    }

    async reload(): Promise<void> {
        if (!this.definition) return;
        this.items = await this.manager.loadItems(this.definition.id);
    }

    apply(
        rules: FilterRule[] = [],
        sorts: SortSpec[] = [],
        group: GroupSpec = { mode: 'none', order: 'asc' },
    ): LibraryGroup<LibraryItem>[] {
        this.groups = applyLibraryView(
            this.items,
            rules,
            sorts,
            group,
            this.definition?.schema.fields ?? [],
        );
        return this.groups;
    }

    getDefinition(): LibraryDefinition | null {
        return this.definition;
    }

    getItems(): LibraryItem[] {
        return [...this.items];
    }

    getGroups(): LibraryGroup<LibraryItem>[] {
        return this.groups.map((group) => ({ ...group, items: [...group.items] }));
    }
}
