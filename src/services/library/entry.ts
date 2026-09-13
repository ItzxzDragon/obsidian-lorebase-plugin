import type { LibraryDefinition } from './types';

export type EntryFieldType = 'auto' | 'boolean' | 'date' | 'datetime' | 'list' | 'number' | 'text';
export type PropertyKind = 'text' | 'multiline' | 'number' | 'boolean' | 'list' | 'date';

export interface EntryFieldConfig {
    property: string;
    type: EntryFieldType;
}

export interface LibraryEntryValues {
    [property: string]: unknown;
}

export function sanitizeFileName(value: string): string {
    const cleaned = value
        .replace(/[\u0000-\u001f]/g, '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/g, '');
    return cleaned || 'Untitled';
}

export function parseFileNameVariables(template: string): string[] {
    const found = new Set<string>();
    const pattern = /%([A-Za-z0-9_-]+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(template)) !== null) found.add(match[1]);
    return [...found];
}

export function renderFileNameTemplate(template: string, values: LibraryEntryValues): string {
    const rendered = template.replace(/%([A-Za-z0-9_-]+)/g, (_all, key: string) => normalizeScalar(values[key]));
    return sanitizeFileName(rendered);
}

export function inferPropertyKinds(values: LibraryEntryValues[]): Record<string, PropertyKind> {
    const kinds: Record<string, PropertyKind> = {};
    for (const entry of values) {
        for (const [key, value] of Object.entries(entry)) {
            if (value == null || kinds[key]) continue;
            kinds[key] = inferKindFromValue(value);
        }
    }
    return kinds;
}

export function inferKindFromValue(value: unknown): PropertyKind {
    if (Array.isArray(value)) return 'list';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return 'date';
    if (typeof value === 'string' && value.includes('\n')) return 'multiline';
    return 'text';
}

export function parseEntryValue(raw: string, kind: PropertyKind): unknown {
    const value = raw.replace(/\r\n/g, '\n').trim();
    if (!value) return '';
    if (kind === 'boolean') return value.toLowerCase() === 'true';
    if (kind === 'number') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
    }
    if (kind === 'list') return value.split(/[,\n]/).map((part) => part.trim()).filter(Boolean);
    return value;
}

export function yamlValue(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => JSON.stringify(normalizeScalar(item))).join(', ')}]`;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value == null) return 'null';
    return JSON.stringify(String(value));
}

export function buildEntryMarkdown(values: LibraryEntryValues): string {
    const lines = ['---'];
    for (const [key, value] of Object.entries(values)) {
        if (!key || key.startsWith('$') || value === '') continue;
        if (typeof value === 'string' && value.includes('\n')) {
            lines.push(`${key}: |-`);
            for (const line of value.split('\n')) lines.push(`  ${line}`);
        } else {
            lines.push(`${key}: ${yamlValue(value)}`);
        }
    }
    lines.push('---', '');
    return lines.join('\n');
}

export function normalizeEntryFieldType(value: unknown): EntryFieldType {
    if (value === 'multiline') return 'text';
    const allowed: EntryFieldType[] = ['auto', 'boolean', 'date', 'datetime', 'list', 'number', 'text'];
    return allowed.includes(value as EntryFieldType) ? value as EntryFieldType : 'auto';
}

export function normalizeEntryFields(raw: unknown): EntryFieldConfig[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: EntryFieldConfig[] = [];
    for (const item of raw) {
        const property = typeof item === 'string'
            ? item.trim()
            : typeof (item as { property?: unknown })?.property === 'string'
                ? String((item as { property: string }).property).trim()
                : '';
        if (!property || property.startsWith('$') || !/^[A-Za-z0-9_-]+$/.test(property) || seen.has(property)) continue;
        seen.add(property);
        out.push({
            property,
            type: normalizeEntryFieldType(typeof item === 'object' && item !== null ? (item as { type?: unknown }).type : 'auto'),
        });
    }
    return out;
}

export function effectiveEntryKind(property: string, library: LibraryDefinition, inferred: Record<string, PropertyKind>): PropertyKind {
    const configured = library.entryFields?.find((field) => field.property === property)?.type ?? 'auto';
    if (configured === 'auto') return inferred[property] ?? 'text';
    if (configured === 'datetime') return 'date';
    return configured;
}

function normalizeScalar(value: unknown): string {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(normalizeScalar).join(', ');
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
}
