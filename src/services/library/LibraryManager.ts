import { App } from 'obsidian';
import type { FieldDefinition, FilterOperator, LibraryFieldType } from '../../types';
import { createBuiltinLibraryDefinitions } from './builtinLibraries';
import { LibraryCatalog } from './LibraryCatalog';
import { LibraryRegistry } from './LibraryRegistry';
import { FolderLibrarySource } from './folderLibrarySource';
import type { LibraryDefinition, LibraryItem } from './types';

export const CUSTOM_LIBRARIES_KEY = 'customLibraries';

export class LibraryManager {
    readonly registry = new LibraryRegistry();
    readonly catalog: LibraryCatalog;
    private readonly folderSource: FolderLibrarySource;
    private rootData: Record<string, unknown> = {};

    constructor(
        app: App,
        private readonly loadData: () => unknown | Promise<unknown>,
        private readonly saveData: (data: unknown) => void | Promise<void>,
    ) {
        this.folderSource = new FolderLibrarySource(app);
        for (const definition of createBuiltinLibraryDefinitions()) this.registry.register(definition);
        this.catalog = new LibraryCatalog(this.registry, () => this.rootData[CUSTOM_LIBRARIES_KEY], (value) => this.persistCustomLibraries(value));
    }

    async load(): Promise<void> {
        const raw = await this.loadData();
        this.rootData = isRecord(raw) ? { ...raw } : {};
        await this.catalog.loadCustomLibraries();
    }

    async save(): Promise<void> {
        await this.persistCustomLibraries(this.registry.list().filter(isCustom));
    }

    listLibraries(): LibraryDefinition[] {
        return this.registry.list();
    }

    listCustomLibraries(): LibraryDefinition[] {
        return this.registry.list().filter(isCustom);
    }

    async loadItems(id: string): Promise<LibraryItem[]> {
        const definition = this.registry.get(id);
        if (!definition || definition.source.kind !== 'folder') return [];
        return this.folderSource.load(definition);
    }

    async createCustomLibrary(input: {
        id: string;
        name: string;
        icon?: string;
        folder: string;
        fields?: LibraryFieldInput[];
        titleField?: string;
        coverField?: string;
    }): Promise<LibraryDefinition> {
        const id = input.id.trim();
        const name = input.name.trim();
        const folder = normalizeFolder(input.folder);
        if (!id || !name || !folder) throw new Error('Library id, name, and folder are required');
        if (this.registry.has(id)) throw new Error(`Library already exists: ${id}`);

        const fields = (input.fields ?? []).map(toFieldDefinition);
        const fieldIds = new Set<string>();
        for (const field of fields) {
            if (fieldIds.has(field.id)) throw new Error(`Duplicate library field: ${field.id}`);
            fieldIds.add(field.id);
        }

        const titleField = normalizeOptionalFieldId(input.titleField);
        const coverField = normalizeOptionalFieldId(input.coverField);
        if (titleField && !fieldIds.has(titleField)) throw new Error(`Unknown title field: ${titleField}`);
        if (coverField && !fieldIds.has(coverField)) throw new Error(`Unknown cover field: ${coverField}`);

        const created = this.catalog.create({
            id,
            name,
            icon: input.icon?.trim() || 'library',
            source: { kind: 'folder', folder },
            schema: { fields, titleField, coverField },
        });
        await this.save();
        return created;
    }

    async renameCustomLibrary(id: string, name: string): Promise<LibraryDefinition> {
        const updated = this.catalog.rename(id, name);
        await this.save();
        return updated;
    }

    async removeCustomLibrary(id: string): Promise<boolean> {
        const removed = this.catalog.remove(id);
        await this.save();
        return removed;
    }

    private async persistCustomLibraries(value: unknown): Promise<void> {
        this.rootData[CUSTOM_LIBRARIES_KEY] = value;
        await this.saveData({ ...this.rootData });
    }
}

export interface LibraryFieldInput {
    id: string;
    label: string;
    icon?: string;
    type: LibraryFieldType;
    operators?: FilterOperator[];
}

function toFieldDefinition(field: LibraryFieldInput): FieldDefinition {
    const id = field.id.trim();
    const label = field.label.trim();
    if (!id || !label) throw new Error('Library field id and label are required');
    return {
        id: id.startsWith('yaml:') ? id : `yaml:${id}`,
        label,
        icon: field.icon?.trim() || 'list',
        type: field.type,
        source: 'yaml',
        operators: field.operators ?? defaultOperators(field.type),
    };
}

function normalizeOptionalFieldId(field: string | undefined): string | undefined {
    if (!field?.trim()) return undefined;
    const id = field.trim();
    return id.startsWith('yaml:') ? id : `yaml:${id}`;
}

function normalizeFolder(folder: string): string {
    return folder.trim().replace(/^\/+|\/+$/g, '');
}

function defaultOperators(type: LibraryFieldType): FilterOperator[] {
    switch (type) {
        case 'number':
        case 'date': return ['equals', 'notEquals', 'greater', 'less', 'between', 'empty', 'notEmpty'];
        case 'boolean': return ['isTrue', 'isFalse', 'empty', 'notEmpty'];
        case 'list': return ['contains', 'containsAny', 'containsAll', 'notContains', 'empty', 'notEmpty'];
        default: return ['contains', 'equals', 'notEquals', 'empty', 'notEmpty'];
    }
}

function isCustom(definition: LibraryDefinition): boolean {
    return (definition as LibraryDefinition & { kind?: string }).kind === 'custom';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
