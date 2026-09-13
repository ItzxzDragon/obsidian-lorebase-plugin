import { LibraryRegistry } from './LibraryRegistry';
import type { FieldDefinition, FilterOperator, FilterRule, SortSpec } from '../../types';
import type { FilterGroup, FilterNode } from './unifiedViewState';
import { normalizeEntryFields } from './entry';
import type { LibraryDefinition } from './types';

export interface PersistedLibraryDefinition extends LibraryDefinition {
    kind: 'custom';
}

/**
 * Owns the set of user-defined libraries while keeping built-ins in the same
 * registry. Persistence is injected so this domain layer stays independent
 * of Obsidian's Plugin class and can be tested in isolation.
 */
export class LibraryCatalog {
    constructor(
        private readonly registry: LibraryRegistry,
        private readonly load: () => unknown | Promise<unknown>,
        private readonly save: (data: unknown) => void | Promise<void>,
    ) {}

    async loadCustomLibraries(): Promise<void> {
        const raw = await this.load();
        if (!Array.isArray(raw)) return;
        for (const value of raw) {
            const definition = normalizeCustomLibrary(value);
            if (definition) this.registry.upsert(definition);
        }
    }

    async saveCustomLibraries(): Promise<void> {
        await this.save(this.registry.list().filter(isCustomLibrary));
    }

    create(definition: Omit<PersistedLibraryDefinition, 'kind'>): PersistedLibraryDefinition {
        const normalized = normalizeCustomLibrary({ ...definition, kind: 'custom' });
        if (!normalized) throw new Error('Invalid custom library definition');
        if (this.registry.has(normalized.id)) throw new Error(`Library already exists: ${normalized.id}`);
        this.registry.register(normalized);
        return normalized;
    }

    rename(id: string, name: string): PersistedLibraryDefinition {
        const existing = this.requireCustom(id);
        const normalizedName = name.trim();
        if (!normalizedName) throw new Error('Library name cannot be empty');
        const updated = { ...existing, name: normalizedName };
        this.registry.upsert(updated);
        return updated;
    }

    remove(id: string): boolean {
        const existing = this.requireCustom(id);
        this.registry.unregister(existing.id);
        return true;
    }

    private requireCustom(id: string): PersistedLibraryDefinition {
        const definition = this.registry.get(id);
        if (!definition || !isCustomLibrary(definition)) throw new Error(`Custom library not found: ${id}`);
        return definition;
    }
}

function isCustomLibrary(definition: LibraryDefinition): definition is PersistedLibraryDefinition {
    return (definition as PersistedLibraryDefinition).kind === 'custom';
}

function normalizeCustomLibrary(value: unknown): PersistedLibraryDefinition | null {
    if (!isRecord(value) || value.kind !== 'custom') return null;
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const icon = typeof value.icon === 'string' && value.icon.trim() ? value.icon.trim() : 'library';
    const source = isRecord(value.source);
    const folder = source && source.kind === 'folder' && typeof value.source.folder === 'string' ? value.source.folder.trim() : '';
    if (!id || !name || !folder) return null;

    const schema = isRecord(value.schema) ? value.schema : {};
    const fields = Array.isArray(schema.fields)
        ? schema.fields.map(normalizeField).filter((field): field is FieldDefinition => field !== null)
        : [];

    const sorts = normalizeSorts(value.sorts);
    const filterGroup = normalizeFilterGroup(value.filterGroup);
    const groupProperty = typeof value.groupProperty === 'string' ? value.groupProperty.trim() : '';
    const groupDirection = value.groupDirection === 'desc' ? 'desc' : 'asc';
    const entryFields = normalizeEntryFields(value.entryFields ?? fields.map((field) => ({
        property: field.id.replace(/^yaml:/, ''),
        type: field.type,
    })));

    return {
        kind: 'custom', id, name, icon,
        source: { kind: 'folder', folder },
        schema: {
            fields,
            coverField: typeof schema.coverField === 'string' ? schema.coverField : undefined,
            titleField: typeof schema.titleField === 'string' ? schema.titleField : undefined,
        },
        entryFields,
        propertyScope: value.propertyScope === 'vault' ? 'vault' : 'folder',
        fileNameTemplate: typeof value.fileNameTemplate === 'string' ? value.fileNameTemplate : undefined,
        orientation: value.orientation === 'horizontal' ? 'horizontal' : 'vertical',
        cardSize: ['small', 'medium', 'large'].includes(String(value.cardSize))
            ? value.cardSize as LibraryDefinition['cardSize']
            : 'medium',
        columns: normalizePositiveInt(value.columns),
        customCardMinWidth: normalizePositiveInt(value.customCardMinWidth),
        customCardMinHeight: normalizePositiveInt(value.customCardMinHeight),
        customCardImageRatio: normalizePositiveNumber(value.customCardImageRatio),
        customHorizontalCardMinWidth: normalizePositiveInt(value.customHorizontalCardMinWidth),
        customHorizontalCardHeight: normalizePositiveInt(value.customHorizontalCardHeight),
        mediaType: normalizeMediaType(value.mediaType),
        sorts,
        filterGroup,
        groupProperty: groupProperty || undefined,
        groupDirection,
    };
}

function normalizeField(value: unknown): FieldDefinition | null {
    if (!isRecord(value)) return null;
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    const label = typeof value.label === 'string' ? value.label.trim() : '';
    const type = value.type;
    if (!id || !label || !['text', 'number', 'date', 'boolean', 'list'].includes(String(type))) return null;
    const operators = Array.isArray(value.operators)
        ? value.operators.filter((operator): operator is FilterOperator => typeof operator === 'string')
        : [];
    return {
        id, label,
        icon: typeof value.icon === 'string' && value.icon ? value.icon : 'list',
        type: type as FieldDefinition['type'],
        source: value.source === 'builtin' ? 'builtin' : 'yaml',
        operators,
        options: Array.isArray(value.options)
            ? value.options.filter(isRecord).filter((option) => typeof option.value === 'string' && typeof option.label === 'string')
                .map((option) => ({ value: option.value as string, label: option.label as string }))
            : undefined,
    };
}

function normalizeSorts(value: unknown): SortSpec[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const result: SortSpec[] = [];
    for (const entry of value) {
        if (!isRecord(entry)) continue;
        const field = typeof entry.field === 'string'
            ? entry.field.trim()
            : typeof entry.property === 'string'
                ? entry.property.trim()
                : '';
        if (!field) continue;
        const order = entry.order === 'desc' || entry.direction === 'desc' ? 'desc' : 'asc';
        result.push({ field: field as SortSpec['field'], order });
    }
    return result;
}

function normalizeFilterGroup(value: unknown): FilterGroup | undefined {
    if (!isRecord(value) || value.kind !== 'group' || typeof value.id !== 'string') return undefined;
    const mode = value.mode === 'or' || value.mode === 'none' ? value.mode : 'and';
    const children = Array.isArray(value.children)
        ? value.children.map(normalizeFilterNode).filter((node): node is FilterNode => node !== null)
        : [];
    return { kind: 'group', id: value.id.trim() || 'root', mode, children };
}

function normalizeFilterNode(value: unknown): FilterNode | null {
    if (!isRecord(value)) return null;
    if (value.kind === 'group') return normalizeFilterGroup(value) ?? null;
    return normalizeFilterRule(value);
}

function normalizeFilterRule(value: Record<string, unknown>): FilterRule | null {
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    const field = typeof value.field === 'string'
        ? value.field.trim()
        : typeof value.property === 'string'
            ? value.property.trim()
            : '';
    const fieldType = value.fieldType;
    const operator = value.operator;
    if (!id || !field || !['text', 'number', 'date', 'boolean', 'list'].includes(String(fieldType))) return null;
    if (!isFilterOperator(operator)) return null;
    return {
        id,
        field,
        fieldType: fieldType as FilterRule['fieldType'],
        operator,
        value: normalizeFilterValue(value.value),
        valueTo: typeof value.valueTo === 'string' || typeof value.valueTo === 'number' ? value.valueTo : null,
    };
}

function normalizeFilterValue(value: unknown): FilterRule['value'] {
    if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
    return null;
}

function isFilterOperator(value: unknown): value is FilterOperator {
    return ['contains', 'equals', 'notEquals', 'empty', 'notEmpty', 'greater', 'less', 'between', 'isTrue', 'isFalse', 'containsAny', 'containsAll', 'notContains', 'thisMonth', 'thisYear'].includes(String(value));
}

function normalizePositiveInt(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function normalizePositiveNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizeMediaType(value: unknown): LibraryDefinition['mediaType'] {
    return ['game', 'anime', 'movie', 'series', 'book', 'manga'].includes(String(value))
        ? value as LibraryDefinition['mediaType']
        : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
