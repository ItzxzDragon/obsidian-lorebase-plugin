import type { App } from 'obsidian';
import type { FieldDefinition, FilterRule, GroupSpec, SortSpec } from '../types';
import { renderCustomLibraryCard } from './CustomLibraryCard';
import { CustomLibrarySelector } from './CustomLibrarySelector';
import { CustomLibraryController } from '../services/library/CustomLibraryController';
import { CustomLibraryViewModel } from '../services/library/CustomLibraryViewModel';
import type { LibraryManager } from '../services/library/LibraryManager';
import type { LibraryDefinition, LibraryItem } from '../services/library/types';

/** First UI surface for custom libraries; it reuses the shared filter/sort/group pipeline. */
export class CustomLibraryPane {
    private readonly container: HTMLElement;
    private readonly controller: CustomLibraryController;
    private selector: CustomLibrarySelector | null = null;
    private activeLibraryId: string | null = null;
    private searchTerm = '';
    private sortField = 'name';
    private sortOrder: 'asc' | 'desc' = 'asc';
    private group: GroupSpec = { mode: 'none', order: 'asc' };
    private renderGeneration = 0;

    constructor(
        private readonly app: App,
        private readonly manager: LibraryManager,
        parent: HTMLElement,
    ) {
        this.container = parent.createDiv({ cls: 'lorebase-custom-library-pane' });
        this.controller = new CustomLibraryController(new CustomLibraryViewModel(manager));
        this.renderSelector();
        this.renderControls();
        void this.renderContent();
    }

    destroy(): void {
        this.selector?.destroy();
        this.selector = null;
        this.container.remove();
    }

    private renderSelector(): void {
        this.selector?.destroy();
        this.selector = new CustomLibrarySelector(
            this.container,
            this.manager.listCustomLibraries(),
            this.activeLibraryId,
            { onSelect: (id) => void this.selectLibrary(id) },
        );
    }

    private renderControls(): void {
        const controls = this.container.createDiv({ cls: 'lorebase-custom-library-controls' });
        const search = controls.createEl('input', {
            cls: 'lorebase-custom-library-search',
            attr: { type: 'search', placeholder: 'Search by title', 'aria-label': 'Search by title' },
        });
        search.value = this.searchTerm;
        search.addEventListener('input', () => {
            this.searchTerm = search.value;
            void this.renderContent();
        });

        const definition = this.getActiveDefinition();
        const fields = definition?.schema.fields ?? [];
        this.createSelect(controls, 'Sort', [
            { value: 'name', label: 'Name' },
            ...fields.map((field) => ({ value: field.id, label: field.label })),
        ], this.sortField, (value) => {
            this.sortField = value;
            void this.renderContent();
        });
        this.createSelect(controls, 'Direction', [
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
        ], this.sortOrder, (value) => {
            this.sortOrder = value as 'asc' | 'desc';
            void this.renderContent();
        });
        this.createSelect(controls, 'Group', [
            { value: 'none', label: 'No grouping' },
            ...fields.map((field) => ({ value: `field:${field.id}`, label: field.label })),
        ], this.group.mode === 'field' ? `field:${this.group.field ?? ''}` : 'none', (value) => {
            this.group = value.startsWith('field:')
                ? { mode: 'field', field: value.slice(6), order: 'asc' }
                : { mode: 'none', order: 'asc' };
            void this.renderContent();
        });
    }

    private createSelect(
        parent: HTMLElement,
        label: string,
        options: Array<{ value: string; label: string }>,
        value: string,
        onChange: (value: string) => void,
    ): void {
        const wrapper = parent.createDiv({ cls: 'lorebase-custom-library-control' });
        wrapper.createSpan({ cls: 'lorebase-custom-library-control-label', text: label });
        const select = wrapper.createEl('select', { attr: { 'aria-label': label } });
        for (const option of options) select.createEl('option', { text: option.label, value: option.value });
        select.value = value;
        select.addEventListener('change', () => onChange(select.value));
    }

    private async selectLibrary(id: string): Promise<void> {
        this.activeLibraryId = id;
        this.controller.setActiveLibrary(id);
        this.searchTerm = '';
        this.sortField = 'name';
        this.sortOrder = 'asc';
        this.group = { mode: 'none', order: 'asc' };
        this.container.empty();
        this.selector = null;
        this.renderSelector();
        this.renderControls();
        await this.renderContent();
    }

    private async renderContent(): Promise<void> {
        const generation = ++this.renderGeneration;
        const content = this.container.createDiv({ cls: 'lorebase-custom-library-content' });
        const definition = this.getActiveDefinition();
        if (!definition) {
            content.createDiv({ cls: 'lorebase-custom-library-empty', text: 'Select a custom library to begin.' });
            return;
        }

        content.createDiv({ cls: 'lorebase-custom-library-title', text: definition.name });
        const fields = definition.schema.fields;
        const rules = this.createSearchRules();
        const sorts: SortSpec[] = [{ field: this.sortField as SortSpec['field'], order: this.sortOrder }];
        const groups = await this.controller.query({ rules, sorts, group: this.group });
        if (generation !== this.renderGeneration) return;

        if (groups.length === 1 && groups[0].items.length === 0) {
            content.createDiv({ cls: 'lorebase-custom-library-empty', text: 'No matching entries.' });
            return;
        }

        for (const group of groups) {
            const section = content.createDiv({ cls: 'lorebase-custom-library-group' });
            if (group.label) section.createDiv({ cls: 'lorebase-custom-library-group-title', text: group.label });
            const grid = section.createDiv({ cls: 'lorebase-custom-library-grid' });
            for (const item of group.items) {
                renderCustomLibraryCard(grid, item, fields, { onOpen: (entry) => this.openItem(entry) });
            }
        }
    }

    private createSearchRules(): FilterRule[] {
        const value = this.searchTerm.trim();
        if (!value) return [];
        return [{
            id: 'custom-library-search',
            field: 'name',
            fieldType: 'text',
            operator: 'contains',
            value,
        }];
    }

    private getActiveDefinition(): LibraryDefinition | undefined {
        return this.activeLibraryId ? this.controller.getActiveDefinition() : undefined;
    }

    private openItem(item: LibraryItem): void {
        void this.app.workspace.getLeaf(false).openFile(item.file);
    }
}
