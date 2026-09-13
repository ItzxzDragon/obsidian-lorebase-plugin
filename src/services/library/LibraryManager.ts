import { App, TFile } from 'obsidian';
import type { FieldDefinition, FilterOperator, LibraryFieldType } from '../../types';
import { buildEntryMarkdown, effectiveEntryKind, normalizeEntryFields, parseEntryValue, inferPropertyKinds, renderFileNameTemplate, type LibraryEntryValues } from './entry';
import { createBuiltinLibraryDefinitions } from './builtinLibraries';
import { LibraryCatalog } from './LibraryCatalog';
import { LibraryRegistry } from './LibraryRegistry';
import { FolderLibrarySource } from './folderLibrarySource';
import { buildLibrarySelectionOptions, type LibrarySelectionOption } from './LibrarySelection';
import { installLibrarySurfaceBridge } from './LibrarySurfaceBridge';
import type { LibraryDefinition, LibraryItem } from './types';

export const CUSTOM_LIBRARIES_KEY = 'customLibraries';

export class LibraryManager {
    readonly registry = new LibraryRegistry();
    readonly catalog: LibraryCatalog;
    private readonly folderSource: FolderLibrarySource;
    private readonly app: App;
    private rootData: Record<string, unknown> = {};

    constructor(
        app: App,
        private readonly loadData: () => unknown | Promise<unknown>,
        private readonly saveData: (data: unknown) => void | Promise<void>,
    ) {
        this.app = app;
        this.folderSource = new FolderLibrarySource(app);
        for (const definition of createBuiltinLibraryDefinitions()) this.registry.register(definition);
        this.catalog = new LibraryCatalog(this.registry, () => this.rootData[CUSTOM_LIBRARIES_KEY], (value) => this.persistCustomLibraries(value));
        installLibrarySurfaceBridge(this);
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

    /** Returns the single selector model used by the Library surface. */
    listLibrarySelectionOptions(): LibrarySelectionOption[] {
        return buildLibrarySelectionOptions(this.registry.list());
    }

    listCustomLibraries(): LibraryDefinition[] {
        return this.registry.list().filter(isCustom);
    }

    getLibrary(id: string): LibraryDefinition | undefined {
        return this.registry.get(id);
    }

    getAvailableProperties(id: string): string[] {
        const definition = this.registry.get(id);
        if (!definition || definition.kind !== 'custom') return [];
        return this.folderSource.getAvailableProperties(definition);
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
        entryFields?: { property: string; type?: string }[];
        titleField?: string;
        coverField?: string;
        propertyScope?: LibraryDefinition['propertyScope'];
        fileNameTemplate?: string;
        orientation?: LibraryDefinition['orientation'];
        cardSize?: LibraryDefinition['cardSize'];
        columns?: number;
        customCardMinWidth?: number;
        customCardMinHeight?: number;
        customCardImageRatio?: number;
        customHorizontalCardMinWidth?: number;
        customHorizontalCardHeight?: number;
        mediaType?: LibraryDefinition['mediaType'];
    }): Promise<LibraryDefinition> {
        const id = input.id.trim();
        const name = input.name.trim();
        const folder = normalizeFolder(input.folder);
        if (!id || !name || !folder) throw new Error('Library id, name, and folder are required');
        if (this.registry.has(id)) throw new Error(`Library already exists: ${id}`);

        const schema = normalizeSchema(input.fields ?? [], input.titleField, input.coverField);
        const created = this.catalog.create({
            kind: 'custom',
            id,
            name,
            icon: input.icon?.trim() || 'library',
            source: { kind: 'folder', folder },
            schema,
            entryFields: normalizeEntryFields(input.entryFields ?? schema.fields.map((field) => ({ property: field.id.replace(/^yaml:/, ''), type: field.type }))),
            propertyScope: input.propertyScope ?? 'folder',
            fileNameTemplate: input.fileNameTemplate?.trim() || undefined,
            orientation: input.orientation ?? 'vertical',
            cardSize: input.cardSize ?? 'medium',
            columns: normalizePositiveInt(input.columns),
            customCardMinWidth: normalizePositiveInt(input.customCardMinWidth),
            customCardMinHeight: normalizePositiveInt(input.customCardMinHeight),
            customCardImageRatio: normalizePositiveNumber(input.customCardImageRatio),
            customHorizontalCardMinWidth: normalizePositiveInt(input.customHorizontalCardMinWidth),
            customHorizontalCardHeight: normalizePositiveInt(input.customHorizontalCardHeight),
            mediaType: input.mediaType,
        });
        await this.save();
        return created;
    }

    async updateCustomLibrary(id: string, input: {
        name?: string;
        icon?: string;
        folder?: string;
        fields?: LibraryFieldInput[];
        entryFields?: { property: string; type?: string }[];
        titleField?: string;
        coverField?: string;
        propertyScope?: LibraryDefinition['propertyScope'];
        fileNameTemplate?: string;
        orientation?: LibraryDefinition['orientation'];
        cardSize?: LibraryDefinition['cardSize'];
        columns?: number;
        customCardMinWidth?: number;
        customCardMinHeight?: number;
        customCardImageRatio?: number;
        customHorizontalCardMinWidth?: number;
        customHorizontalCardHeight?: number;
        mediaType?: LibraryDefinition['mediaType'];
    }): Promise<LibraryDefinition> {
        const existing = this.registry.get(id);
        if (!existing || existing.kind !== 'custom' || existing.source.kind !== 'folder') {
            throw new Error(`Custom library not found: ${id}`);
        }
        const name = input.name === undefined ? existing.name : input.name.trim();
        const folder = input.folder === undefined ? existing.source.folder : normalizeFolder(input.folder);
        if (!name || !folder) throw new Error('Library name and folder are required');

        const fields = input.fields === undefined ? existing.schema.fields : input.fields.map(toFieldDefinition);
        const titleField = input.titleField === undefined ? existing.schema.titleField : normalizeOptionalFieldId(input.titleField);
        const coverField = input.coverField === undefined ? existing.schema.coverField : normalizeOptionalFieldId(input.coverField);
        const schema = validateSchema(fields, titleField, coverField);

        const updated: LibraryDefinition = {
            ...existing,
            kind: 'custom',
            name,
            icon: input.icon === undefined ? existing.icon : input.icon.trim() || 'library',
            source: { kind: 'folder', folder },
            schema,
            entryFields: input.entryFields === undefined
                ? existing.entryFields ?? normalizeEntryFields(schema.fields.map((field) => ({ property: field.id.replace(/^yaml:/, ''), type: field.type })))
                : normalizeEntryFields(input.entryFields),
            propertyScope: input.propertyScope ?? existing.propertyScope ?? 'folder',
            fileNameTemplate: input.fileNameTemplate === undefined ? existing.fileNameTemplate : input.fileNameTemplate.trim() || undefined,
            orientation: input.orientation ?? existing.orientation ?? 'vertical',
            cardSize: input.cardSize ?? existing.cardSize ?? 'medium',
            columns: input.columns === undefined ? existing.columns : normalizePositiveInt(input.columns),
            customCardMinWidth: input.customCardMinWidth === undefined ? existing.customCardMinWidth : normalizePositiveInt(input.customCardMinWidth),
            customCardMinHeight: input.customCardMinHeight === undefined ? existing.customCardMinHeight : normalizePositiveInt(input.customCardMinHeight),
            customCardImageRatio: input.customCardImageRatio === undefined ? existing.customCardImageRatio : normalizePositiveNumber(input.customCardImageRatio),
            customHorizontalCardMinWidth: input.customHorizontalCardMinWidth === undefined ? existing.customHorizontalCardMinWidth : normalizePositiveInt(input.customHorizontalCardMinWidth),
            customHorizontalCardHeight: input.customHorizontalCardHeight === undefined ? existing.customHorizontalCardHeight : normalizePositiveInt(input.customHorizontalCardHeight),
            mediaType: input.mediaType === undefined ? existing.mediaType : input.mediaType,
        };
        this.registry.upsert(updated);
        await this.save();
        return updated;
    }

    async createCustomLibraryEntry(id: string, rawValues: Record<string, string>): Promise<TFile> {
        const definition = this.registry.get(id);
        if (!definition || definition.kind !== 'custom' || definition.source.kind !== 'folder') {
            throw new Error(`Custom library not found: ${id}`);
        }

        const entryFields = definition.entryFields ?? normalizeEntryFields(
            definition.schema.fields.map((field) => ({ property: field.id.replace(/^yaml:/, ''), type: field.type })),
        );
        const existingItems = await this.loadItems(id);
        const inferred = inferPropertyKinds(existingItems.map((item) => stripYamlKeys(item.values)));
        const values: LibraryEntryValues = {};

        for (const field of entryFields) {
            const raw = rawValues[field.property] ?? '';
            if (!raw.trim()) continue;
            values[field.property] = parseEntryValue(raw, effectiveEntryKind(field.property, definition, inferred));
        }

        const titleProperty = definition.schema.titleField?.replace(/^yaml:/, '');
        const titleValue = titleProperty ? values[titleProperty] : undefined;
        const fallbackProperty = entryFields[0]?.property;
        const fallbackValue = fallbackProperty ? values[fallbackProperty] : undefined;
        const template = definition.fileNameTemplate?.trim();
        const baseName = template
            ? renderFileNameTemplate(template, values)
            : String(titleValue ?? fallbackValue ?? 'Untitled').trim() || 'Untitled';
        const path = `${definition.source.folder}/${baseName}.md`;
        if (this.app.vault.getAbstractFileByPath(path)) throw new Error(`Entry already exists: ${path}`);

        const markdown = buildEntryMarkdown(values);
        return this.app.vault.create(path, markdown);
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

function normalizeSchema(fields: LibraryFieldInput[], titleField?: string, coverField?: string): LibraryDefinition['schema'] {
    const definitions = fields.map(toFieldDefinition);
    return validateSchema(definitions, normalizeOptionalFieldId(titleField), normalizeOptionalFieldId(coverField));
}

function validateSchema(fields: FieldDefinition[], titleField?: string, coverField?: string): LibraryDefinition['schema'] {
    const fieldIds = new Set<string>();
    for (const field of fields) {
        if (fieldIds.has(field.id)) throw new Error(`Duplicate library field: ${field.id}`);
        fieldIds.add(field.id);
    }
    if (titleField && !fieldIds.has(titleField)) throw new Error(`Unknown title field: ${titleField}`);
    if (coverField && !fieldIds.has(coverField)) throw new Error(`Unknown cover field: ${coverField}`);
    return { fields, titleField, coverField };
}

function normalizeOptionalFieldId(field: string | undefined): string | undefined {
    if (!field?.trim()) return undefined;
    const id = field.trim();
    return id.startsWith('yaml:') ? id : `yaml:${id}`;
}

function normalizeFolder(folder: string): string {
    return folder.trim().replace(/^\/+|\/+$/g, '');
}

function normalizePositiveInt(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function normalizePositiveNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
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

function stripYamlKeys(values: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(/^yaml:/, ''), value]));
}

function isCustom(definition: LibraryDefinition): boolean {
    return definition.kind === 'custom';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
