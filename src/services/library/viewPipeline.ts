import type { FieldDefinition, FilterRule, GroupSpec, LibraryFieldType, SortSpec } from '../../types';
import type { LibraryItem } from './types';
import { isFilterGroup, type FilterGroup, type FilterNode } from './unifiedViewState';

export interface LibraryGroup<T> { key: string; label: string; items: T[]; }

export function getLibraryValue(item: LibraryItem, field: string): unknown {
    if (Object.prototype.hasOwnProperty.call(item.values, field)) return item.values[field];
    if (field.startsWith('yaml:')) {
        const rawField = field.slice(5);
        if (Object.prototype.hasOwnProperty.call(item.values, rawField)) return item.values[rawField];
    }
    return null;
}

export function filterLibraryItems(items: LibraryItem[], rules: FilterRule[]): LibraryItem[];
export function filterLibraryItems(items: LibraryItem[], group: FilterGroup): LibraryItem[];
export function filterLibraryItems(items: LibraryItem[], rulesOrGroup: FilterRule[] | FilterGroup): LibraryItem[] {
    if (Array.isArray(rulesOrGroup)) {
        if (rulesOrGroup.length === 0) return [...items];
        return items.filter((item) => rulesOrGroup.every((rule) => matchesFilterRule(getLibraryValue(item, rule.field), rule)));
    }
    if (rulesOrGroup.children.length === 0 || rulesOrGroup.mode === 'none') return [...items];
    return items.filter((item) => matchesFilterGroup(item, rulesOrGroup));
}

export function sortLibraryItems(items: LibraryItem[], sorts: SortSpec[], fields: FieldDefinition[] = []): LibraryItem[] {
    if (sorts.length === 0) return [...items];
    const fieldTypes = new Map(fields.map((field) => [field.id, field.type]));
    return items.map((item, index) => ({ item, index })).sort((a, b) => {
        for (const spec of sorts) {
            const result = compareValues(getLibraryValue(a.item, spec.field), getLibraryValue(b.item, spec.field), fieldTypeForSort(spec.field, fieldTypes));
            if (result !== 0) return spec.order === 'desc' ? -result : result;
        }
        return a.index - b.index;
    }).map(({ item }) => item);
}

export function groupLibraryItems(items: LibraryItem[], group: GroupSpec): LibraryGroup<LibraryItem>[] {
    if (group.mode === 'none') return [{ key: 'all', label: '', items: [...items] }];
    const groups = new Map<string, LibraryItem[]>();
    for (const item of items) {
        const value = groupValue(item, group);
        const bucket = groups.get(value.key) ?? [];
        bucket.push(item);
        groups.set(value.key, bucket);
    }
    const result = Array.from(groups, ([key, groupItems]) => ({ key, label: groupItems[0] ? groupValue(groupItems[0], group).label : key, items: groupItems }));
    result.sort((a, b) => group.order === 'desc' ? b.key.localeCompare(a.key, undefined, { numeric: true, sensitivity: 'base' }) : a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' }));
    return result;
}

export function applyLibraryView(items: LibraryItem[], rules: FilterRule[] | FilterGroup, sorts: SortSpec[], group: GroupSpec, fields: FieldDefinition[] = []): LibraryGroup<LibraryItem>[] {
    const filtered = isFilterGroup(rules)
        ? filterLibraryItems(items, rules)
        : filterLibraryItems(items, rules);
    return groupLibraryItems(sortLibraryItems(filtered, sorts, fields), group);
}

export function matchesFilterGroup(item: LibraryItem, group: FilterGroup): boolean {
    if (group.children.length === 0 || group.mode === 'none') return true;
    const results = group.children.map((child) => matchesFilterNode(item, child));
    if (group.mode === 'or') return results.some(Boolean);
    return results.every(Boolean);
}

function matchesFilterNode(item: LibraryItem, node: FilterNode): boolean {
    return isFilterGroup(node) ? matchesFilterGroup(item, node) : matchesFilterRule(getLibraryValue(item, node.field), node);
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
    if (type === 'date') { if (typeof value === 'number') return value; const timestamp = Date.parse(String(value ?? '')); return Number.isNaN(timestamp) ? value : timestamp; }
    if (type === 'number') { if (typeof value === 'number') return value; const number = Number(String(value ?? '').trim()); return Number.isNaN(number) ? value : number; }
    if (type === 'boolean') { if (typeof value === 'boolean') return value; const normalized = String(value ?? '').trim().toLowerCase(); if (normalized === 'true') return true; if (normalized === 'false') return false; }
    if (Array.isArray(value)) return value.map((entry) => normalizeValue(entry, type === 'list' ? 'text' : type));
    if (typeof value === 'string') return value.trim().toLowerCase();
    return value;
}

function compareValues(a: unknown, b: unknown, type?: LibraryFieldType): number {
    const left = normalizeValue(a, type); const right = normalizeValue(b, type);
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

function toArray(value: unknown): unknown[] { return Array.isArray(value) ? value : value === null || value === undefined || value === '' ? [] : [value]; }
function isEmpty(value: unknown): boolean { return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0); }

function sameDateBucket(value: unknown, now: Date, bucket: 'month' | 'year'): boolean {
    const timestamp = typeof value === 'number' ? value : Date.parse(String(value ?? ''));
    if (Number.isNaN(timestamp)) return false;
    const date = new Date(timestamp);
    return date.getFullYear() === now.getFullYear() && (bucket === 'year' || date.getMonth() === now.getMonth());
}

function groupValue(item: LibraryItem, group: GroupSpec): { key: string; label: string } {
    if (group.mode === 'field') return fieldGroupValue(getLibraryValue(item, group.field ?? ''));
    const raw = group.mode === 'series' ? getLibraryValue(item, 'series') : getLibraryValue(item, 'dateCompleted') ?? getLibraryValue(item, 'dateFinished');
    if (group.mode === 'series') { const label = String(raw ?? '').trim() || 'Ungrouped'; return { key: label.toLocaleLowerCase(), label }; }
    const timestamp = typeof raw === 'number' ? raw : Date.parse(String(raw ?? ''));
    if (Number.isNaN(timestamp)) return { key: 'ungrouped', label: 'Ungrouped' };
    const date = new Date(timestamp);
    const key = group.mode === 'finishedYear' ? String(date.getFullYear()) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: key };
}

function fieldGroupValue(raw: unknown): { key: string; label: string } {
    const values = toArray(raw).map((value) => String(value ?? '').trim()).filter(Boolean);
    if (values.length === 0) return { key: 'ungrouped', label: 'Ungrouped' };
    const labels = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const label = labels.join(', ');
    return { key: labels.map((value) => value.toLocaleLowerCase()).join('\u001f'), label };
}
