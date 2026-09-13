import { LibraryRegistry } from './LibraryRegistry';
import type { LibraryDefinition, LibraryFieldInput } from './types';

export interface PersistedLibraryDefinition extends LibraryDefinition {
    kind: 'custom';
}

/**
 * Owns the set of user-defined libraries while keeping built-ins in the same
 * registry. Persistence is injected so this domain layer stays independent of
 * Obsidian's Plugin class and can be tested in isolation.
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
        if (this.registry.has(normalized.id)) {
            throw new Error(`Library already exists: ${normalized.id}`);
        }
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
        if (!definition || !isCustomLibrary(definition)) {
            throw new Error(`Custom library not found: ${id}`);
        }
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
    const folder = source && source.kind === 'folder' && typeof source.folder === 'string'
        ? source.folder.trim()
        : '';
    if (!id || !name || !folder) return null;

    const schema = isRecord(value.schema) ? value.schema : {};
    const fields = Array.isArray(schema.fields)
        ? schema.fields.map(normalizeField).filter((field): field is LibraryFieldInput => field !== null)
        : [];

    return {
        kind: 'custom',
        id,
        name,
        icon,
        source: { kind: 'folder', folder },
        schema: {
            fields,
            coverField: typeof schema.coverField === 'string' ? schema.coverField : undefined,
            titleField: typeof schema.titleField === 'string' ? schema.titleField : undefined,
        },
    };
}

function normalizeField(value: unknown): LibraryFieldInput | null {
    if (!isRecord(value)) return null;
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    const label = typeof value.label === 'string' ? value.label.trim() : '';
    const type = value.type;
    if (!id || !label || !['text', 'number', 'date', 'boolean', 'list'].includes(String(type))) return null;
    return {
        id,
        label,
        type: type as LibraryFieldInput['type'],
        icon: typeof value.icon === 'string' ? value.icon : undefined,
        source: value.source === 'builtin' ? 'builtin' : 'yaml',
    };
}

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
