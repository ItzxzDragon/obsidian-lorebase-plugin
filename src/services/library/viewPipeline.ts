import type { FieldDefinition, FilterRule, GroupSpec, LibraryFieldType, SortSpec } from '../../types';
import type { LibraryItem } from './types';

export interface LibraryGroup<T> {
    key: string;
    label: string;
    items: T[];
}

export function getLibraryValue(item: LibraryItem, field: string): unknown {
    return item.values[field] ?? (field.startsWith('yaml:') ? item.values[field.slice(5)] : null);
}

export function filterLibraryItems(items: LibraryItem[], rules: FilterRule[]): LibraryItem[] {
    if (rules.length === 0) return [...items];
    return items.filter((item) => rules.every((rule) => matchesFilterRule(getLibraryValue(item, rule.field), rule)));
}

/**
 * Sorts library items using optional schema metadata. The metadata is important
 * for custom libraries because YAML fields do not carry their type in the
 * persisted SortSpec itself.
 */
export function sortLibraryItems(
    items: LibraryItem[],
    sorts: SortSpec[],
    fields: FieldDefinition[] = [],
): LibraryItem[] {
    if (sorts.length === 0) return [...items];
    const fieldTypes = new Map(fields.map((field) => [field.id, field.type]));
    return items.map((item, index) => ({ item, index })).sort((a, b) => {
        for (const spec of sorts) {
            const result = compareValues(
                getLibraryValue(a.item, spec.field),
                getLibraryValue(b.item, spec.field),
                fieldTypeForSort(spec.field, fieldTypes),
            );
            if (result !== 0) return spec.order === 'desc' ? -result : result;
        }
        return a.index - b.index;
    }).map(({ item }) => item);
}

export function groupLibraryItems(items: LibraryItem[], group: GroupSpec): LibraryGroup<LibraryItem>[] {
    if (group.mode === 'none') return [{ key: 'all', label: '', items: [...items] }];
    const groups = new Map<string, LibraryItem[]>();
    for (const item of items) {
        const value = groupValue(item, group.mode);
        const bucket = groups.get(value.key) ?? [];
        bucket.push(item);
        groups.set(value.key, bucket);
    }
    const result = Array.from(groups, ([key, groupItems]) => ({ key, label: groupItems[0] ? groupValue(groupItems[0], group.mode).label : key, items: groupItems }));
    result.sort((a, b) => group.order === 'desc' ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key, undefined, { numeric: true }));
    return result;
}

export function applyLibraryView(
    items: LibraryItem[],
    rules: FilterRule[],
    sorts: SortSpec[],
    group: GroupSpec,
    fields: FieldDefinition[] = [],
): LibraryGroup<LibraryItem>[] {
    return groupLibraryItems(sortLibraryItems(filterLibraryItems(items, rules), sorts, fields), group);
}

export function matchesFilterRule(rawValue: unknown, rule: FilterRule): boolean {
    const value = normalizeValue(rawValue, rule.fieldType);
    const target = normalizeValue(rule.value, rule.fieldType);
    switch (rule.operator) {
        case 'empty': return isEmpty(value);
        case 'notEmpty': return !isEmpty(value);
        case 'equals': return compareValues(value, target, rule.fieldType) === 0;
        case 'notEquals': return compareValues(value, target, rule.fieldType) !== 0;
        case 'contains': return includesText(value, target);
        case 'notContains': return !includesText(value, target);
        case 'containsAny': return toArray(value).some((entry) => toArray(rule.value).some((wanted) => compareValues(normalizeValue(entry, rule.fieldType), normalizeValue(wanted, rule.fieldType), rule.fieldType) === 0));
        case 'containsAll': return toArray(rule.value).every((wanted) => toArray(value).some((entry) => compareValues(normalizeValue(entry, rule.fieldType), normalizeValue(wanted, rule.fieldType), rule.fieldType) === 0));
        case 'greater': return compareValues(value, target, rule.fieldType) > 0;
        case 'less': return compareValues(value, target, rule.fieldType) < 0;
        case 'between': return compareValues(value, target, rule.fieldType) >= 0 && compareValues(value, normalizeValue(rule.valueTo, rule.fieldType), rule.fieldType) <= 0;
        case 'isTrue': return value === true;
        case 'isFalse': return value === false;
        case 'thisMonth': return sameDateBucket(value, new Date(), 'month');
        case 'thisYear': return sameDateBucket(value, new Date(), 'year');
        default: return false;
    }
}

function normalizeValue(value: unknown, type?: LibraryFieldType): unknown {
    if (value instanceof Date) return value.getTime();
    if (type === 'date') {
        if (typeof value === 'number') return value;
        const timestamp = Date.parse(String(value ?? ''));
        return Number.isNaN(timestamp) ? value : timestamp;
    }
    if (type === 'number') {
        if (typeof value === 'number') return value;
        const number = Number(String(value ?? '').trim());
        return Number.isNaN(number) ? value : number;
    }
    if (type === 'boolean') {
        if (typeof value === 'boolean') return value;
        const normalized = String(value ?? '').trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    if (Array.isArray(value)) return value.map((entry) => normalizeValue(entry, type === 'list' ? 'text' : type));
    if (typeof value === 'string') return value.trim().toLowerCase();
    return value;
}

function compareValues(a: unknown, b: unknown, type?: LibraryFieldType): number {
    const left = normalizeValue(a, type);
    const right = normalizeValue(b, type);
    if (left === right) return 0;
    if (left === null || left === undefined || left === '') return -1;
    if (right === null || right === undefined || right === '') return 1;
    if (typeof left === 'number' && typeof right === 'number') return left < right ? -1 : 1;
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

function fieldTypeForSort(field: string, fieldTypes: Map<string, LibraryFieldType>): LibraryFieldType | undefined {
    if (fieldTypes.has(field)) return fieldTypes.get(field);
    if (field.startsWith('yaml:')) return fieldTypes.get(field.slice(5));
    if (field === 'year' || field === 'rating') return 'number';
    if (field.startsWith('date')) return 'date';
    return undefined;
}

function includesText(value: unknown, target: unknown): boolean {
    const needle = String(target ?? '').toLowerCase();
    if (Array.isArray(value)) return value.some((entry) => String(entry).toLowerCase().includes(needle));
    return String(value ?? '').toLowerCase().includes(needle);
}

function toArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : value === null || value === undefined || value === '' ? [] : [value];
}

function isEmpty(value: unknown): boolean {
    return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function sameDateBucket(value: unknown, now: Date, bucket: 'month' | 'year'): boolean {
    const timestamp = typeof value === 'number' ? value : Date.parse(String(value ?? ''));
    if (Number.isNaN(timestamp)) return false;
    const date = new Date(timestamp);
    return date.getFullYear() === now.getFullYear() && (bucket === 'year' || date.getMonth() === now.getMonth());
}

function groupValue(item: LibraryItem, mode: Exclude<GroupSpec['mode'], 'none'>): { key: string; label: string } {
    const raw = mode === 'series' ? getLibraryValue(item, 'series') : getLibraryValue(item, 'dateCompleted') ?? getLibraryValue(item, 'dateFinished');
    if (mode === 'series') {
        const label = String(raw ?? '').trim() || 'Ungrouped';
        return { key: label.toLocaleLowerCase(), label };
    }
    const timestamp = typeof raw === 'number' ? raw : Date.parse(String(raw ?? ''));
    if (Number.isNaN(timestamp)) return { key: 'ungrouped', label: 'Ungrouped' };
    const date = new Date(timestamp);
    const key = mode === 'finishedYear' ? String(date.getFullYear()) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: key };
}
