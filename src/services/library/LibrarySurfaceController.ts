import type { FieldDefinition, FilterRule, MediaType, SortOrder, SortSpec } from '../../types';
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
import {
    cloneFilterGroup,
    cloneUnifiedViewState,
    countFilterRules,
    createEmptyFilterGroup,
    createViewId,
    type FilterGroup,
    type FilterNode,
    type UnifiedLibraryViewState,
    type UnifiedSavedView,
} from './unifiedViewState';

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
    private viewState: UnifiedLibraryViewState;

    constructor(
        private readonly manager: LibraryManager,
        initialMediaType: MediaType,
        options: LibrarySurfaceControllerOptions = {},
    ) {
        this.active = builtinSelection(initialMediaType);
        this.renderer = options.renderer ?? new LibrarySurfaceRenderer();
        this.viewState = createDefaultViewState();
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
        this.viewState = createDefaultViewState();
    }

    selectCustom(libraryId: string): void {
        const option = resolveSelection(this.manager, customSelection(libraryId));
        if (!option || option.kind !== 'custom') {
            throw new Error(`Custom library not found: ${libraryId}`);
        }
        this.active = customSelection(libraryId);
        this.viewState = viewStateFromDefinition(option.definition);
    }

    /** The canonical View/Filter/Sort/Group state for the active Library. */
    getViewState(): UnifiedLibraryViewState {
        return cloneUnifiedViewState(this.viewState);
    }

    /** Replace the canonical View/Filter/Sort/Group state without sharing mutable references. */
    setViewState(state: UnifiedLibraryViewState): void {
        this.viewState = cloneUnifiedViewState(state);
    }

    /** Update only the multi-sort list. */
    setSorts(sorts: SortSpec[]): void {
        this.viewState = {
            ...this.viewState,
            sorts: sorts.map((sort) => ({ ...sort })),
        };
    }

    /** Update the nested filter tree and derive the legacy flat filter list for consumers that still need it. */
    setFilterGroup(filterGroup: FilterGroup): void {
        const clonedGroup = cloneFilterGroup(filterGroup);
        const filters = flattenFilterRules(clonedGroup);
        this.viewState = {
            ...this.viewState,
            filterMode: clonedGroup.mode,
            filters,
            filterGroup: clonedGroup,
        };
    }

    /** Update the root filter mode while preserving its nested children. */
    setFilterMode(filterMode: UnifiedLibraryViewState['filterMode']): void {
        this.viewState = {
            ...this.viewState,
            filterMode,
            filterGroup: {
                ...cloneFilterGroup(this.viewState.filterGroup),
                mode: filterMode,
            },
        };
    }

    /** Update arbitrary property grouping. An empty property disables grouping. */
    setGrouping(groupProperty: string, groupDirection: SortOrder = 'asc'): void {
        this.viewState = {
            ...this.viewState,
            groupProperty: groupProperty.trim(),
            groupDirection,
        };
    }

    /** Return the number of effective filter rules, including rules inside nested groups. */
    getFilterRuleCount(): number {
        return countFilterRules(this.viewState.filterGroup);
    }

    /** Create or replace a Saved View using the complete unified state. */
    saveView(name: string, id = createViewId('saved-view')): UnifiedSavedView {
        const normalizedName = name.trim();
        if (!normalizedName) throw new Error('Saved view name cannot be empty');

        const state = cloneUnifiedViewState(this.viewState);
        const savedState = {
            sorts: state.sorts,
            filterMode: state.filterMode,
            filters: state.filters,
            filterGroup: state.filterGroup,
            groupProperty: state.groupProperty,
            groupDirection: state.groupDirection,
            activeSavedViewId: id,
        };
        const savedView: UnifiedSavedView = { id, name: normalizedName, state: savedState };
        const existing = this.viewState.savedViews.findIndex((view) => view.id === id);
        const savedViews = [...this.viewState.savedViews];
        if (existing >= 0) savedViews[existing] = savedView;
        else savedViews.push(savedView);
        this.viewState = {
            ...state,
            savedViews,
            activeSavedViewId: id,
        };
        return cloneSavedView(savedView);
    }

    /** Apply a Saved View and restore its complete filter/sort/group state. */
    applySavedView(id: string | null): boolean {
        if (!id) {
            this.viewState = { ...cloneUnifiedViewState(this.viewState), activeSavedViewId: '' };
            return true;
        }
        const saved = this.viewState.savedViews.find((view) => view.id === id);
        if (!saved) return false;
        const restored = cloneUnifiedViewState({
            ...saved.state,
            savedViews: this.viewState.savedViews,
            activeSavedViewId: id,
        });
        this.viewState = restored;
        return true;
    }

    /** Update the name of an existing Saved View. */
    renameSavedView(id: string, name: string): boolean {
        const normalizedName = name.trim();
        if (!normalizedName) throw new Error('Saved view name cannot be empty');
        const index = this.viewState.savedViews.findIndex((view) => view.id === id);
        if (index < 0) return false;
        const savedViews = this.viewState.savedViews.map((view, viewIndex) =>
            viewIndex === index ? { ...view, name: normalizedName } : cloneSavedView(view),
        );
        this.viewState = { ...this.viewState, savedViews };
        return true;
    }

    /** Remove a Saved View and clear the active id if necessary. */
    deleteSavedView(id: string): boolean {
        const next = this.viewState.savedViews.filter((view) => view.id !== id);
        if (next.length === this.viewState.savedViews.length) return false;
        this.viewState = {
            ...this.viewState,
            savedViews: next,
            activeSavedViewId: this.viewState.activeSavedViewId === id ? '' : this.viewState.activeSavedViewId,
        };
        return true;
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

        const state = this.viewState;
        this.renderer.render(parent, items, definition, {
            ...options,
            rules: state.filterGroup,
            sorts: state.sorts,
            group: state.groupProperty
                ? { mode: 'field', field: state.groupProperty, order: state.groupDirection }
                : { mode: 'none', order: state.groupDirection },
            fields: options.fields ?? definition.schema.fields,
        });
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

function createDefaultViewState(): UnifiedLibraryViewState {
    return {
        sorts: [],
        filterMode: 'and',
        filters: [],
        filterGroup: createEmptyFilterGroup('and', 'root'),
        groupProperty: '',
        groupDirection: 'asc',
        savedViews: [],
        activeSavedViewId: '',
    };
}

function viewStateFromDefinition(definition: LibraryDefinition): UnifiedLibraryViewState {
    const filterGroup = definition.filterGroup ?? createEmptyFilterGroup('and', 'root');
    const clonedGroup = cloneFilterGroup(filterGroup);
    return {
        sorts: definition.sorts?.map((sort) => ({ ...sort })) ?? [],
        filterMode: clonedGroup.mode,
        filters: flattenFilterRules(clonedGroup),
        filterGroup: clonedGroup,
        groupProperty: definition.groupProperty ?? '',
        groupDirection: definition.groupDirection ?? 'asc',
        savedViews: [],
        activeSavedViewId: '',
    };
}

function flattenFilterRules(group: FilterGroup): FilterRule[] {
    const rules: FilterRule[] = [];
    for (const child of group.children) {
        if (child.kind === 'group') rules.push(...flattenFilterRules(child));
        else rules.push({
            ...child,
            value: Array.isArray(child.value) ? [...child.value] : child.value,
        });
    }
    return rules;
}

function cloneSavedView(view: UnifiedSavedView): UnifiedSavedView {
    return {
        ...view,
        state: cloneUnifiedViewState({
            ...view.state,
            savedViews: [],
        }),
    };
}
