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
        app: ConstructorParameters<typeof FolderLibrarySource>[0],
        private readonly loadData: () => unknown | Promise<unknown>,
        private readonly saveData: (data: unknown) => void | Promise<void>,
    ) {
        this.folderSource = new FolderLibrarySource(app);
        for (const definition of createBuiltinLibraryDefinitions()) this.registry.register(definition);
        this.catalog = new LibraryCatalog(
            this.registry,
            () => this.rootData[CUSTOM_LIBRARIES_KEY],
            (value) => this.persistCustomLibraries(value),
        );
    }

    async load(): Promise<void> {
        const raw = await this.loadData();
        this.rootData = isRecord(raw) ? { ...raw } : {};
        await this.catalog.loadCustomLibraries();
    }

    async save(): Promise<void> {
        await this.persistCustomLibraries(this.registry.list().filter((definition) => definition.id !== '' && isCustom(definition)));
    }

    async loadItems(id: string): Promise<LibraryItem[]> {
        const definition = this.registry.get(id);
        if (!definition) return [];
        if (definition.source.kind === 'folder') return this.folderSource.load(definition);
        return [];
    }

    createCustomLibrary(input: {
        id: string;
        name: string;
        icon?: string;
        folder: string;
        fields?: LibraryFieldInput[];
        titleField?: string;
        coverField?: string;
    }): LibraryDefinition {
        const fields = (input.fields ?? []).map(toFieldDefinition);
        return this.catalog.create({
            id: input.id,
            name: input.name,
            icon: input.icon?.trim() || 'library',
            source: { kind: 'folder', folder: input.folder.trim() },
            schema: {
                fields,
                titleField: input.titleField,
                coverField: input.coverField,
            },
        });
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

function defaultOperators(type: LibraryFieldType): FilterOperator[] {
    switch (type) {
        case 'number':
        case 'date':
            return ['equals', 'notEquals', 'greater', 'less', 'between', 'empty', 'notEmpty'];
        case 'boolean':
            return ['isTrue', 'isFalse', 'empty', 'notEmpty'];
        case 'list':
            return ['contains', 'containsAny', 'containsAll', 'notContains', 'empty', 'notEmpty'];
        default:
            return ['contains', 'equals', 'notEquals', 'empty', 'notEmpty'];
    }
}

function isCustom(definition: LibraryDefinition): boolean {
    return (definition as LibraryDefinition & { kind?: string }).kind === 'custom';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
