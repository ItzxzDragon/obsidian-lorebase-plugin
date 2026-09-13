import type { App } from 'obsidian';
import type { FilterRule, GroupSpec, SortSpec } from '../types';
import { renderCustomLibraryCard } from './CustomLibraryCard';
import { CustomLibrarySelector } from './CustomLibrarySelector';
import { CustomLibraryController } from '../services/library/CustomLibraryController';
import { CustomLibraryViewModel } from '../services/library/CustomLibraryViewModel';
import type { LibraryManager } from '../services/library/LibraryManager';
import type { LibraryDefinition, LibraryItem } from '../services/library/types';

export interface CustomLibraryPaneCallbacks {
    onActiveLibraryChange: (libraryId: string | null) => void;
}

/** First UI surface for custom libraries; it reuses the shared filter/sort/group pipeline. */
export class CustomLibraryPane {
    private readonly container: HTMLElement;
    private readonly controller: CustomLibraryController;
    private selector: CustomLibrarySelector | null = null;
    private controls: HTMLElement | null = null;
    private content: HTMLElement;
    private activeLibraryId: string | null = null;
    private searchTerm = '';
    private filterField = 'name';
    private filterValue = '';
    private sortField = 'name';
    private sortOrder: 'asc' | 'desc' = 'asc';
    private group: GroupSpec = { mode: 'none', order: 'asc' };
    private renderGeneration = 0;

    constructor(
        private readonly app: App,
        private readonly manager: LibraryManager,
        parent: HTMLElement,
        private readonly callbacks: CustomLibraryPaneCallbacks,
    ) {
        this.container = parent.createDiv({ cls: 'lorebase-custom-library-pane' });
        this.controller = new CustomLibraryController(new CustomLibraryViewModel(manager));
        this.content = this.container.createDiv({ cls: 'lorebase-custom-library-content' });
        this.renderChrome();
        this.syncContentVisibility();
        void this.renderContent();
    }

    destroy(): void {
        this.selector?.destroy();
        this.selector = null;
        this.container.remove();
    }

    refreshLibraries(): void {
        this.renderChrome();
        void this.renderContent();
    }

    setContentVisible(visible: boolean): void {
        this.content.toggleClass('is-hidden', !visible);
        this.content.setAttribute('aria-hidden', String(!visible));
    }

    private syncContentVisibility(): void {
        this.setContentVisible(this.activeLibraryId !== null);
    }

    private renderChrome(): void {
        this.selector?.destroy();
        this.controls?.remove();
        this.selector = new CustomLibrarySelector(
            this.container,
            this.manager.listCustomLibraries(),
            this.activeLibraryId,
            { onSelect: (id) => void this.selectLibrary(id) },
        );
        this.renderControls();
    }

    private renderControls(): void {
        this.controls = this.container.createDiv({ cls: 'lorebase-custom-library-controls' });
        const search = this.controls.createEl('input', {
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
        const filterableFields = [
            { value: 'name', label: 'Title' },
            ...fields
                .filter((field) => field.type === 'text' || field.type === 'list')
                .map((field) => ({ value: field.id, label: field.label })),
        ];
        if (!filterableFields.some((field) => field.value === this.filterField)) {
            this.filterField = 'name';
        }
        this.createSelect(this.controls, 'Filter field', filterableFields, this.filterField, (value) => {
            this.filterField = value;
            void this.renderContent();
        });
        const filterInput = this.controls.createEl('input', {
            cls: 'lorebase-custom-library-filter-value',
            attr: { type: 'search', placeholder: 'Filter value', 'aria-label': 'Filter value' },
        });
        filterInput.value = this.filterValue;
        filterInput.addEventListener('input', () => {
            this.filterValue = filterInput.value;
            void this.renderContent();
        });

        this.createSelect(this.controls, 'Sort', [
            { value: 'name', label: 'Name' },
            ...fields.map((field) => ({ value: field.id, label: field.label })),
        ], this.sortField, (value) => {
            this.sortField = value;
            void this.renderContent();
        });
        this.createSelect(this.controls, 'Direction', [
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
        ], this.sortOrder, (value) => {
            this.sortOrder = value as 'asc' | 'desc';
            void this.renderContent();
        });
        this.createSelect(this.controls, 'Group', [
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

    private async selectLibrary(id: string | null): Promise<void> {
        this.activeLibraryId = id;
        this.controller.setActiveLibrary(id);
        this.searchTerm = '';
        this.filterField = 'name';
        this.filterValue = '';
        this.sortField = 'name';
        this.sortOrder = 'asc';
        this.group = { mode: 'none', order: 'asc' };
        this.callbacks.onActiveLibraryChange(id);
        this.renderChrome();
        this.syncContentVisibility();
        await this.renderContent();
    }

    private async renderContent(): Promise<void> {
        const generation = ++this.renderGeneration;
        this.content.empty();
        const definition = this.getActiveDefinition();
        if (!definition) {
            this.content.createDiv({ cls: 'lorebase-custom-library-empty', text: 'Select a custom library to begin.' });
            return;
        }

        this.content.createDiv({ cls: 'lorebase-custom-library-title', text: definition.name });
        const fields = definition.schema.fields;
        const rules = this.createSearchRules();
        const sorts: SortSpec[] = [{ field: this.sortField as SortSpec['field'], order: this.sortOrder }];
        const groups = await this.controller.query({ rules, sorts, group: this.group });
        if (generation !== this.renderGeneration) return;

        if (groups.length === 0 || groups.every((group) => group.items.length === 0)) {
            this.content.createDiv({ cls: 'lorebase-custom-library-empty', text: 'No matching entries.' });
            return;
        }

        for (const group of groups) {
            const section = this.content.createDiv({ cls: 'lorebase-custom-library-group' });
            if (group.label) section.createDiv({ cls: 'lorebase-custom-library-group-title', text: group.label });
            const grid = section.createDiv({ cls: 'lorebase-custom-library-grid' });
            for (const item of group.items) {
                renderCustomLibraryCard(grid, item, fields, { onOpen: (entry) => this.openItem(entry) });
            }
        }
    }

    private createSearchRules(): FilterRule[] {
        const rules: FilterRule[] = [];
        const search = this.searchTerm.trim();
        if (search) {
            rules.push({
                id: 'custom-library-search',
                field: 'name',
                fieldType: 'text',
                operator: 'contains',
                value: search,
            });
        }

        const filter = this.filterValue.trim();
        if (filter) {
            const field = this.getActiveDefinition()?.schema.fields.find((candidate) => candidate.id === this.filterField);
            rules.push({
                id: 'custom-library-filter',
                field: this.filterField,
                fieldType: field?.type ?? 'text',
                operator: 'contains',
                value: filter,
            });
        }
        return rules;
    }

    private getActiveDefinition(): LibraryDefinition | undefined {
        return this.activeLibraryId ? this.controller.getActiveDefinition() : undefined;
    }

    private openItem(item: LibraryItem): void {
        void this.app.workspace.getLeaf(false).openFile(item.file);
    }
}
