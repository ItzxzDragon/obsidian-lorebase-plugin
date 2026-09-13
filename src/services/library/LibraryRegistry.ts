import type { LibraryDefinition } from './types';

/**
 * Central registry for every library visible to the plugin.
 *
 * The registry deliberately knows nothing about cards, filters, providers, or
 * settings UI. Those systems consume LibraryDefinition instead of maintaining
 * separate built-in/custom implementations.
 */
export class LibraryRegistry {
    private readonly definitions = new Map<string, LibraryDefinition>();

    register(definition: LibraryDefinition): void {
        const id = definition.id.trim();
        if (!id) throw new Error('Library id cannot be empty');
        if (this.definitions.has(id)) {
            throw new Error(`Library already registered: ${id}`);
        }
        this.definitions.set(id, { ...definition, id });
    }

    upsert(definition: LibraryDefinition): void {
        const id = definition.id.trim();
        if (!id) throw new Error('Library id cannot be empty');
        this.definitions.set(id, { ...definition, id });
    }

    unregister(id: string): boolean {
        return this.definitions.delete(id);
    }

    get(id: string): LibraryDefinition | undefined {
        return this.definitions.get(id);
    }

    has(id: string): boolean {
        return this.definitions.has(id);
    }

    list(): LibraryDefinition[] {
        return Array.from(this.definitions.values());
    }

    clear(): void {
        this.definitions.clear();
    }
}
