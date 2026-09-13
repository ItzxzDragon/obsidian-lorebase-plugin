import { Menu, Modal, Notice, Setting, TFile, setIcon } from 'obsidian';

const HOST_VIEW_TYPE = 'lorebase-library-view';
const LEGACY_VIEW_TYPE = 'lorebase-custom-library-view';
const SPECIAL_PROPERTIES = ['$file.name', '$file.path', '$file.ctime', '$file.mtime', '$file.size'];
function specialPropertyLabel(property: string): string {
  if (property === '$file.name') return 'File name';
  if (property === '$file.path') return 'File path';
  if (property === '$file.ctime') return 'Created time';
  if (property === '$file.mtime') return 'Modified time';
  if (property === '$file.size') return 'File size';
  return property;
}

type Direction = 'asc' | 'desc';
type PropertyScope = 'folder' | 'vault';
type FilterMode = 'and' | 'or' | 'none';
type FilterOperator = 'contains' | 'equals' | 'notEquals' | 'greater' | 'less' | 'between' | 'empty' | 'notEmpty' | 'isTrue' | 'isFalse' | 'containsAny' | 'containsAll' | 'notContains' | 'thisMonth' | 'thisYear';
type EntryFieldType = 'auto' | 'boolean' | 'date' | 'datetime' | 'list' | 'number' | 'text';
type EntryFieldConfig = { property: string; type: EntryFieldType };
type CompletionDateFormat = 'short' | 'full';
type RatingStyle = 'emoji' | 'star';
type HorizontalImageSide = 'left' | 'right';
type CardOrientation = 'vertical' | 'horizontal';
type BadgeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type BadgePlacement = { corner: BadgeCorner; offsetX: number; offsetY: number };
type CustomBadgeLayout = { favorite: BadgePlacement; rating: BadgePlacement; completion: BadgePlacement };
type OverlayTextRole = 'title' | 'description' | 'text';
type OverlayFieldConfig = {
  id: string;
  property: string;
  role: OverlayTextRole;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: number;
};

type SortSpec = { property: string; direction: Direction };
type FilterRule = { kind?: 'rule'; id: string; property: string; fieldType?: PropertyKind; operator: FilterOperator; value?: unknown; valueTo?: unknown };
type FilterGroup = { kind: 'group'; id: string; mode: FilterMode; children: FilterNode[] };
type FilterNode = FilterRule | FilterGroup;
type SavedView = {
  id: string;
  name: string;
  sorts: SortSpec[];
  filterMode: FilterMode;
  filters: FilterRule[];
  filterGroup: FilterGroup;
  groupProperty: string;
  groupDirection: Direction;
};

type BuiltinOverlayFieldKey = 'title' | 'year' | 'format' | 'description';
type BuiltinCardLayout = {
  active: boolean;
  fields: Partial<Record<BuiltinOverlayFieldKey, OverlayFieldConfig>>;
  badges: { favorite: BadgePlacement; rating: BadgePlacement; status: BadgePlacement };
};
type BuiltinCardLayouts = Record<CardOrientation, BuiltinCardLayout>;

type LibraryDefinition = {
  id: string;
  name: string;
  icon: string;
  sourceFolder: string;
  propertyScope: PropertyScope;
  fileNameTemplate: string;
  coverProperty: string;
  columns: number;
  orientation: 'vertical' | 'horizontal';
  cardSize: 'small' | 'medium' | 'large';
  customCardSize: boolean;
  customCardMinWidth: number;
  customCardMinHeight: number;
  customCardImageRatio: number;
  customHorizontalCardMinWidth: number;
  customHorizontalCardHeight: number;
  horizontalSideCover: boolean;
  horizontalImageSide: HorizontalImageSide;
  horizontalImageWidth: number;
  favoriteEnabled: boolean;
  favoriteSubtlePulse: boolean;
  ratingEnabled: boolean;
  ratingStyle: RatingStyle;
  completionDateEnabled: boolean;
  completionDateProperty: string;
  completionDateFormat: CompletionDateFormat;
  overlayFields: OverlayFieldConfig[];
  overlayLayouts: Record<CardOrientation, OverlayFieldConfig[]>;
  badgeLayouts: Record<CardOrientation, CustomBadgeLayout>;
  statusAsIconOnly: boolean;
  entryFields: EntryFieldConfig[];
  sorts: SortSpec[];
  filterMode: FilterMode;
  filters: FilterRule[];
  filterGroup: FilterGroup;
  groupProperty: string;
  groupDirection: Direction;
  savedViews: SavedView[];
  activeSavedViewId: string;
};

type UnifiedViewState = {
  sorts: SortSpec[];
  filterGroup: FilterGroup;
  groupProperty: string;
  groupDirection: Direction;
  savedViews: SavedView[];
  activeSavedViewId: string;
};
type PluginSettings = { libraries: LibraryDefinition[]; builtinViews: Partial<Record<HostMediaType, UnifiedViewState>>; builtinInitialized: Partial<Record<HostMediaType, boolean>>; builtinCardLayouts: Partial<Record<HostMediaType, BuiltinCardLayouts>> };
type LibraryItem = { file: TFile; fields: Record<string, unknown> };

const DEFAULT_SETTINGS: PluginSettings = { libraries: [], builtinViews: {}, builtinInitialized: {}, builtinCardLayouts: {} };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function cloneSorts(sorts: SortSpec[]): SortSpec[] { return sorts.map((s) => ({ ...s })); }
function cloneRule(rule: FilterRule): FilterRule {
  return { ...rule, value: Array.isArray(rule.value) ? [...rule.value] : rule.value };
}
function cloneFilterGroup(group: FilterGroup): FilterGroup {
  return {
    kind: 'group',
    id: group.id,
    mode: group.mode,
    children: group.children.map((node) => isFilterGroup(node) ? cloneFilterGroup(node) : cloneRule(node)),
  };
}
function emptyFilterGroup(mode: FilterMode = 'and'): FilterGroup {
  return { kind: 'group', id: uid('filter-group'), mode, children: [] };
}
function isFilterGroup(node: FilterNode): node is FilterGroup {
  return Boolean(node && (node as FilterGroup).kind === 'group' && Array.isArray((node as FilterGroup).children));
}
function countFilterRules(group: FilterGroup): number {
  return group.children.reduce((total, node) => total + (isFilterGroup(node) ? countFilterRules(node) : (node.property.trim() ? 1 : 0)), 0);
}
function hasEffectiveFilterNode(node: FilterNode): boolean {
  return isFilterGroup(node) ? node.children.some(hasEffectiveFilterNode) : Boolean(node.property.trim());
}
function collectFilterProperties(group: FilterGroup, target = new Set<string>()): Set<string> {
  for (const node of group.children) {
    if (isFilterGroup(node)) collectFilterProperties(node, target);
    else if (node.property) target.add(node.property);
  }
  return target;
}
function normalizePath(path: string): string { return path.trim().replace(/^\/+|\/+$/g, ''); }
function isSimple(value: unknown): boolean {
  return value == null || ['string', 'number', 'boolean'].includes(typeof value)
    || (Array.isArray(value) && value.every((v) => ['string', 'number', 'boolean'].includes(typeof v)));
}
function normalizeScalar(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(normalizeScalar).join(', ');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

type PropertyKind = 'text' | 'multiline' | 'number' | 'boolean' | 'list' | 'date';

function sanitizeFileName(value: string): string {
  const cleaned = value
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return cleaned || 'Untitled';
}
function parseFileNameVariables(template: string): string[] {
  const found = new Set<string>();
  const pattern = /%([A-Za-z0-9_-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) found.add(match[1]);
  return [...found];
}
function renderFileNameTemplate(template: string, values: Record<string, unknown>): string {
  const rendered = template.replace(/%([A-Za-z0-9_-]+)/g, (_all, key: string) => normalizeScalar(values[key]));
  return sanitizeFileName(rendered);
}
function isValidEntryPropertyName(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}
function inferPropertyKinds(items: LibraryItem[]): Record<string, PropertyKind> {
  const kinds: Record<string, PropertyKind> = {};
  for (const item of items) {
    for (const [key, value] of Object.entries(item.fields)) {
      if (value == null || kinds[key]) continue;
      if (Array.isArray(value)) kinds[key] = 'list';
      else if (typeof value === 'number') kinds[key] = 'number';
      else if (typeof value === 'boolean') kinds[key] = 'boolean';
      else if (typeof value === 'string' && value.includes('\n')) kinds[key] = 'multiline';
      else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) kinds[key] = 'date';
      else kinds[key] = 'text';
    }
  }
  return kinds;
}
function inferKindFromValue(value: unknown): PropertyKind {
  if (Array.isArray(value)) return 'list';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return 'date';
  if (typeof value === 'string' && value.includes('\n')) return 'multiline';
  return 'text';
}
function parseEntryValue(raw: string, kind: PropertyKind): unknown {
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
function yamlValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => JSON.stringify(normalizeScalar(item))).join(', ')}]`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value == null) return 'null';
  return JSON.stringify(String(value));
}
function buildEntryMarkdown(fields: Record<string, unknown>): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
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
function normalizeEntryFieldType(value: unknown): EntryFieldType {
  if (value === 'multiline') return 'text';
  const allowed: EntryFieldType[] = ['auto','boolean','date','datetime','list','number','text'];
  return allowed.includes(value as EntryFieldType) ? value as EntryFieldType : 'auto';
}
function normalizeEntryFields(raw: any): EntryFieldConfig[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: EntryFieldConfig[] = [];
  for (const item of raw) {
    const property = typeof item === 'string' ? item.trim() : typeof item?.property === 'string' ? item.property.trim() : '';
    if (!property || property.startsWith('$') || !isValidEntryPropertyName(property) || seen.has(property)) continue;
    seen.add(property);
    out.push({ property, type: normalizeEntryFieldType(typeof item === 'object' ? item.type : 'auto') });
  }
  return out;
}

function normalizePropertyList(raw: unknown): string[] {
  const source = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\r?\n|,/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of source) {
    const property = String(value ?? '').trim();
    if (!property || seen.has(property) || property.startsWith('$')) continue;
    seen.add(property);
    out.push(property);
  }
  return out;
}
function propertyListToText(values: string[]): string { return values.join('\n'); }

function effectiveEntryKind(property: string, library: LibraryDefinition, inferred: Record<string, PropertyKind>): PropertyKind {
  const configured = library.entryFields.find((field) => field.property === property)?.type ?? 'auto';
  if (configured === 'auto') return inferred[property] ?? 'text';
  if (configured === 'datetime') return 'date';
  return configured;
}
function normalizeCompletionDateFormat(value: unknown): CompletionDateFormat {
  // 0.5/0.6 exposed medium/long/iso. Migrate those to Lorebase's native full format.
  return value === 'full' || value === 'medium' || value === 'long' || value === 'iso' ? 'full' : 'short';
}

function normalizeRatingStyle(value: unknown): RatingStyle {
  // Older custom builds used number/both. Lorebase itself exposes star/emoji.
  return value === 'star' || value === 'number' || value === 'both' ? 'star' : 'emoji';
}
function normalizeOverlayRole(value: unknown): OverlayTextRole {
  return value === 'title' || value === 'description' ? value : 'text';
}
function defaultOverlayField(property: string, role: OverlayTextRole = 'text', index = 0): OverlayFieldConfig {
  const defaults = role === 'title'
    ? { fontSize: 18, fontWeight: 700, width: 88, height: 28 }
    : role === 'description'
      ? { fontSize: 12, fontWeight: 400, width: 88, height: 72 }
      : { fontSize: 13, fontWeight: 500, width: 70, height: 26 };
  return {
    id: uid('overlay'),
    property,
    role,
    x: 6,
    y: Math.min(88, 8 + index * 12),
    width: defaults.width,
    height: defaults.height,
    fontSize: defaults.fontSize,
    fontWeight: defaults.fontWeight,
  };
}
function normalizeOverlayFields(raw: unknown, legacyCardProperties: unknown): OverlayFieldConfig[] {
  if (Array.isArray(raw)) {
    const out: OverlayFieldConfig[] = [];
    for (const [index, item] of raw.entries()) {
      if (!item || typeof item !== 'object') continue;
      const property = typeof (item as any).property === 'string' ? (item as any).property.trim() : '';
      if (!property || property.startsWith('$')) continue;
      const role = normalizeOverlayRole((item as any).role);
      const fallback = defaultOverlayField(property, role, index);
      out.push({
        id: typeof (item as any).id === 'string' && (item as any).id ? (item as any).id : fallback.id,
        property,
        role,
        x: Math.max(0, Math.min(100, Number.isFinite(Number((item as any).x)) ? Number((item as any).x) : fallback.x)),
        y: Math.max(0, Math.min(100, Number.isFinite(Number((item as any).y)) ? Number((item as any).y) : fallback.y)),
        width: Math.max(4, Math.min(100, Number.isFinite(Number((item as any).width)) ? Number((item as any).width) : fallback.width)),
        height: Math.max(16, Math.min(4000, Number.isFinite(Number((item as any).height)) ? Number((item as any).height) : fallback.height)),
        fontSize: Math.max(8, Math.min(72, Number.isFinite(Number((item as any).fontSize)) ? Number((item as any).fontSize) : fallback.fontSize)),
        fontWeight: Math.max(100, Math.min(900, Math.round((Number.isFinite(Number((item as any).fontWeight)) ? Number((item as any).fontWeight) : fallback.fontWeight) / 100) * 100)),
      });
    }
    if (out.length) return out;
  }
  const legacy = normalizePropertyList(legacyCardProperties);
  return legacy.map((property, index) => defaultOverlayField(property, index === 0 ? 'title' : index === 1 ? 'description' : 'text', index));
}

function cloneOverlayFields(fields: OverlayFieldConfig[]): OverlayFieldConfig[] {
  return fields.map((field) => ({ ...field }));
}
function getOverlayFields(library: LibraryDefinition, orientation: CardOrientation): OverlayFieldConfig[] {
  return library.overlayLayouts?.[orientation] ?? library.overlayFields;
}
function defaultBadgePlacement(corner: BadgeCorner): BadgePlacement { return { corner, offsetX: 3, offsetY: 3 }; }
function defaultBadgeLayout(): CustomBadgeLayout {
  return {
    favorite: defaultBadgePlacement('top-right'),
    rating: defaultBadgePlacement('bottom-right'),
    completion: defaultBadgePlacement('bottom-right'),
  };
}
function normalizeBadgePlacement(raw: any, fallbackCorner: BadgeCorner): BadgePlacement {
  const corners: BadgeCorner[] = ['top-left','top-right','bottom-left','bottom-right'];
  return {
    corner: corners.includes(raw?.corner) ? raw.corner : fallbackCorner,
    offsetX: Math.max(0, Math.min(45, Number.isFinite(Number(raw?.offsetX)) ? Number(raw.offsetX) : 3)),
    offsetY: Math.max(0, Math.min(45, Number.isFinite(Number(raw?.offsetY)) ? Number(raw.offsetY) : 3)),
  };
}
function normalizeBadgeLayout(raw: any): CustomBadgeLayout {
  return {
    favorite: normalizeBadgePlacement(raw?.favorite, 'top-right'),
    rating: normalizeBadgePlacement(raw?.rating, 'bottom-right'),
    completion: normalizeBadgePlacement(raw?.completion, 'bottom-right'),
  };
}
function getBadgeLayout(library: LibraryDefinition, orientation: CardOrientation): CustomBadgeLayout {
  return library.badgeLayouts?.[orientation] ?? defaultBadgeLayout();
}
function hasStrongRtl(text: string): boolean {
  return /[֐-ࣿיִ-﷿ﹰ-ﻼ]/.test(text);
}
function applyBadgePlacement(element: HTMLElement, placement: BadgePlacement): void {
  element.classList.remove('is-top-left','is-top-right','is-bottom-left','is-bottom-right','is-top-badge');
  element.classList.add(`is-${placement.corner}`);
  if (placement.corner.startsWith('top')) element.classList.add('is-top-badge');
  element.style.position = 'absolute';
  element.style.top = placement.corner.startsWith('top') ? `${placement.offsetY}%` : '';
  element.style.bottom = placement.corner.startsWith('bottom') ? `${placement.offsetY}%` : '';
  element.style.left = placement.corner.endsWith('left') ? `${placement.offsetX}%` : '';
  element.style.right = placement.corner.endsWith('right') ? `${placement.offsetX}%` : '';
}

function defaultBuiltinField(key: BuiltinOverlayFieldKey, index: number): OverlayFieldConfig {
  const role: OverlayTextRole = key === 'title' ? 'title' : key === 'description' ? 'description' : 'text';
  const field = defaultOverlayField(key, role, index);
  if (key === 'year') { field.y = 18; field.width = 40; field.height = 24; field.fontSize = 12; field.fontWeight = 400; }
  if (key === 'format') { field.y = 26; field.width = 40; field.height = 24; field.fontSize = 12; field.fontWeight = 400; }
  if (key === 'description') { field.y = 38; field.height = 92; }
  return field;
}
function defaultBuiltinCardLayout(): BuiltinCardLayout {
  return {
    active: false,
    fields: {
      title: defaultBuiltinField('title', 0),
      year: defaultBuiltinField('year', 1),
      format: defaultBuiltinField('format', 2),
      description: defaultBuiltinField('description', 3),
    },
    badges: {
      favorite: defaultBadgePlacement('top-right'),
      rating: defaultBadgePlacement('bottom-right'),
      status: defaultBadgePlacement('bottom-right'),
    },
  };
}
function normalizeBuiltinCardLayout(raw: any): BuiltinCardLayout {
  const fallback = defaultBuiltinCardLayout();
  const fields: Partial<Record<BuiltinOverlayFieldKey, OverlayFieldConfig>> = {};
  for (const key of ['title','year','format','description'] as BuiltinOverlayFieldKey[]) {
    const normalized = normalizeOverlayFields(raw?.fields?.[key] ? [raw.fields[key]] : [], []);
    fields[key] = normalized[0] ?? { ...(fallback.fields[key] as OverlayFieldConfig) };
  }
  return {
    active: raw?.active === true,
    fields,
    badges: {
      favorite: normalizeBadgePlacement(raw?.badges?.favorite, 'top-right'),
      rating: normalizeBadgePlacement(raw?.badges?.rating, 'bottom-right'),
      status: normalizeBadgePlacement(raw?.badges?.status, 'bottom-right'),
    },
  };
}
function normalizeBuiltinCardLayouts(raw: any): BuiltinCardLayouts {
  return {
    vertical: normalizeBuiltinCardLayout(raw?.vertical),
    horizontal: normalizeBuiltinCardLayout(raw?.horizontal),
  };
}
function ensureEntryField(library: LibraryDefinition, property: string, type: EntryFieldType): void {
  const existing = library.entryFields.find((field) => field.property === property);
  if (existing) {
    if (existing.type === 'auto') existing.type = type;
    return;
  }
  library.entryFields.push({ property, type });
}
function isFeatureOwnedEntryProperty(library: LibraryDefinition, property: string): boolean {
  return (property === 'favorite' && library.favoriteEnabled)
    || (property === 'rating' && library.ratingEnabled)
    || (property === 'finished' && library.completionDateEnabled);
}
function replaceTemplateVariable(template: string, oldProperty: string, nextProperty: string): string {
  const escaped = oldProperty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return template.replace(new RegExp(`%${escaped}(?![A-Za-z0-9_-])`, 'g'), `%${nextProperty}`);
}
function renameFilterProperty(group: FilterGroup, oldProperty: string, nextProperty: string): void {
  for (const node of group.children) {
    if (isFilterGroup(node)) renameFilterProperty(node, oldProperty, nextProperty);
    else if (node.property === oldProperty) node.property = nextProperty;
  }
}
function renameLibraryPropertyReferences(library: LibraryDefinition, oldProperty: string, nextProperty: string): void {
  if (!oldProperty || oldProperty === nextProperty) return;
  library.fileNameTemplate = replaceTemplateVariable(library.fileNameTemplate, oldProperty, nextProperty);
  if (library.coverProperty === oldProperty) library.coverProperty = nextProperty;
  if (library.completionDateProperty === oldProperty) library.completionDateProperty = nextProperty;
  if (library.groupProperty === oldProperty) library.groupProperty = nextProperty;
  for (const orientation of ['vertical','horizontal'] as CardOrientation[]) {
    for (const field of getOverlayFields(library, orientation)) if (field.property === oldProperty) field.property = nextProperty;
  }
  for (const sort of library.sorts) if (sort.property === oldProperty) sort.property = nextProperty;
  renameFilterProperty(library.filterGroup, oldProperty, nextProperty);
  for (const view of library.savedViews) {
    for (const sort of view.sorts) if (sort.property === oldProperty) sort.property = nextProperty;
    if (view.groupProperty === oldProperty) view.groupProperty = nextProperty;
    renameFilterProperty(view.filterGroup, oldProperty, nextProperty);
    for (const rule of view.filters) if (rule.property === oldProperty) rule.property = nextProperty;
  }
}
function propertyValue(item: LibraryItem, property: string): unknown {
  if (property === '$file.name') return item.file.basename;
  if (property === '$file.path') return item.file.path;
  if (property === '$file.ctime') return item.file.stat?.ctime ?? null;
  if (property === '$file.mtime') return item.file.stat?.mtime ?? null;
  if (property === '$file.size') return item.file.stat?.size ?? null;
  if (Object.prototype.hasOwnProperty.call(item.fields, property)) return item.fields[property];
  const wanted = property.toLocaleLowerCase();
  const match = Object.keys(item.fields).find((key) => key.toLocaleLowerCase() === wanted);
  return match ? item.fields[match] : undefined;
}
function normalizeCoverReference(raw: unknown): string {
  const value = Array.isArray(raw) ? raw.find((item) => normalizeScalar(item).trim()) : raw;
  let text = normalizeScalar(value).trim();
  if (!text) return '';
  const markdownImage = text.match(/^!\[[^\]]*\]\((.+?)(?:\s+["'][^"']*["'])?\)$/);
  if (markdownImage) text = markdownImage[1].trim();
  const markdownLink = text.match(/^\[[^\]]+\]\((.+?)\)$/);
  if (markdownLink) text = markdownLink[1].trim();
  const wiki = text.match(/^!?\[\[([^\]]+)\]\]$/);
  if (wiki) text = wiki[1].split('|')[0].trim();
  text = text.replace(/^<|>$/g, '').trim();
  return text;
}
function resolveCoverSource(app: any, item: LibraryItem, raw: unknown): string {
  const cover = normalizeCoverReference(raw);
  if (!cover) return '';
  if (/^(https?:|data:|blob:|app:|file:)/i.test(cover)) return encodeURI(cover);
  const clean = cover.split('#')[0].trim().replace(/^\.\//, '');
  const decoded = (() => { try { return decodeURIComponent(clean); } catch { return clean; } })();
  const exactCandidates = [clean, decoded].filter(Boolean);
  for (const candidate of exactCandidates) {
    const exact = app.vault.getAbstractFileByPath?.(normalizePath(candidate));
    if (exact instanceof TFile) return app.vault.getResourcePath(exact);
  }
  for (const candidate of exactCandidates) {
    const dest = app.metadataCache.getFirstLinkpathDest?.(candidate, item.file.path);
    if (dest) return app.vault.getResourcePath(dest);
  }
  return '';
}
function isEmptyValue(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}
function compareLoose(left: unknown, right: unknown): number {
  if (isEmptyValue(left) && isEmptyValue(right)) return 0;
  if (isEmptyValue(left)) return 1;
  if (isEmptyValue(right)) return -1;
  const ln = Number(left); const rn = Number(right);
  if (Number.isFinite(ln) && Number.isFinite(rn) && normalizeScalar(left).trim() !== '' && normalizeScalar(right).trim() !== '') return ln - rn;
  const ld = Date.parse(normalizeScalar(left)); const rd = Date.parse(normalizeScalar(right));
  const dateLike = /^\d{4}-\d{1,2}-\d{1,2}/;
  if (dateLike.test(normalizeScalar(left)) && dateLike.test(normalizeScalar(right)) && Number.isFinite(ld) && Number.isFinite(rd)) return ld - rd;
  return normalizeScalar(left).localeCompare(normalizeScalar(right), undefined, { numeric: true, sensitivity: 'base' });
}
function normalizeText(value: unknown): string { return normalizeScalar(value).trim().toLocaleLowerCase(); }
function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(normalizeScalar(value));
  return Number.isFinite(n) ? n : null;
}
function toDateNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(normalizeScalar(value));
  return Number.isFinite(parsed) ? parsed : null;
}
function inferRuleType(raw: unknown, rule: FilterRule): PropertyKind {
  return rule.fieldType ?? inferKindFromValue(raw);
}
function matchRawValue(raw: unknown, rule: FilterRule, now = new Date()): boolean {
  const empty = isEmptyValue(raw);
  if (rule.operator === 'empty') return empty;
  if (rule.operator === 'notEmpty') return !empty;
  if (empty) return false;
  if (rule.operator === 'isTrue') return raw === true || normalizeText(raw) === 'true';
  if (rule.operator === 'isFalse') return raw === false || normalizeText(raw) === 'false';

  const kind = inferRuleType(raw, rule);
  if (kind === 'list' || Array.isArray(raw)) {
    const actual = (Array.isArray(raw) ? raw : [raw]).map(normalizeText);
    const expectedRaw = Array.isArray(rule.value) ? rule.value : normalizeScalar(rule.value).split(',');
    const expected = expectedRaw.map(normalizeText).filter(Boolean);
    if (rule.operator === 'containsAll') return expected.every((value) => actual.some((entry) => entry.includes(value)));
    if (rule.operator === 'notContains') return expected.every((value) => actual.every((entry) => !entry.includes(value)));
    if (rule.operator === 'equals') return expected.length === actual.length && expected.every((value) => actual.includes(value));
    if (rule.operator === 'notEquals') return !(expected.length === actual.length && expected.every((value) => actual.includes(value)));
    return expected.some((value) => actual.some((entry) => entry.includes(value)));
  }

  if (kind === 'date') {
    const actual = toDateNumber(raw);
    if (actual === null) return false;
    if (rule.operator === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return actual >= start && actual < end;
    }
    if (rule.operator === 'thisYear') {
      const start = new Date(now.getFullYear(), 0, 1).getTime();
      const end = new Date(now.getFullYear() + 1, 0, 1).getTime();
      return actual >= start && actual < end;
    }
    const from = toDateNumber(rule.value);
    const to = toDateNumber(rule.valueTo);
    if (rule.operator === 'between') return from !== null && to !== null && actual >= from && actual <= to;
    if (rule.operator === 'greater') return from !== null && actual > from;
    if (rule.operator === 'less') return from !== null && actual < from;
    if (rule.operator === 'notEquals') return from !== null && actual !== from;
    return from !== null && actual === from;
  }

  if (kind === 'number') {
    const actual = toFiniteNumber(raw);
    const from = toFiniteNumber(rule.value);
    const to = toFiniteNumber(rule.valueTo);
    if (actual === null) return false;
    if (rule.operator === 'between') return from !== null && to !== null && actual >= from && actual <= to;
    if (rule.operator === 'greater') return from !== null && actual > from;
    if (rule.operator === 'less') return from !== null && actual < from;
    if (rule.operator === 'notEquals') return from !== null && actual !== from;
    return from !== null && actual === from;
  }

  const actual = normalizeText(raw);
  const expected = normalizeText(rule.value);
  if (rule.operator === 'equals') return actual === expected;
  if (rule.operator === 'notEquals') return actual !== expected;
  if (rule.operator === 'notContains') return !actual.includes(expected);
  return actual.includes(expected);
}
function matchRule(item: LibraryItem, rule: FilterRule): boolean { return matchRawValue(propertyValue(item, rule.property), rule); }
function matchesFilterGroup<T>(item: T, group: FilterGroup, getter: (item: T, property: string) => unknown): boolean {
  const active = group.children.filter(hasEffectiveFilterNode);
  if (!active.length) return true;
  const results = active.map((node) => isFilterGroup(node)
    ? matchesFilterGroup(item, node, getter)
    : matchRawValue(getter(item, node.property), node));
  if (group.mode === 'or') return results.some(Boolean);
  if (group.mode === 'none') return !results.some(Boolean);
  return results.every(Boolean);
}
function applyFilterGroup<T>(items: T[], group: FilterGroup, getter: (item: T, property: string) => unknown): T[] {
  if (!group.children.length) return [...items];
  return items.filter((item) => matchesFilterGroup(item, group, getter));
}
function applySortsGeneric<T>(items: T[], sorts: SortSpec[], getter: (item: T, property: string) => unknown, tieBreaker?: (item: T) => string): T[] {
  const activeSorts = sorts.filter((spec) => spec.property.trim());
  if (!activeSorts.length) return [...items];
  return [...items].sort((a, b) => {
    for (const spec of activeSorts) {
      const cmp = compareLoose(getter(a, spec.property), getter(b, spec.property));
      if (cmp !== 0) return spec.direction === 'asc' ? cmp : -cmp;
    }
    return (tieBreaker?.(a) ?? '').localeCompare(tieBreaker?.(b) ?? '', undefined, { numeric: true });
  });
}
function applyFilters(items: LibraryItem[], group: FilterGroup): LibraryItem[] { return applyFilterGroup(items, group, propertyValue); }
function applySorts(items: LibraryItem[], sorts: SortSpec[]): LibraryItem[] { return applySortsGeneric(items, sorts, propertyValue, (item) => item.file.path); }
function formatCustomDate(value: unknown, format: CompletionDateFormat): string {
  const raw=normalizeScalar(value).trim();if(!raw)return'';const date=new Date(raw);if(Number.isNaN(date.getTime()))return raw;
  const options:Intl.DateTimeFormatOptions=format==='full'
    ? {year:'numeric',month:'short',day:'numeric'}
    : {month:'short',day:'numeric'};
  try{return new Intl.DateTimeFormat(undefined,options).format(date);}catch{return raw;}
}

function groupItems(items: LibraryItem[], property: string, direction: Direction = 'asc'): Map<string, LibraryItem[]> {
  const groups = new Map<string, LibraryItem[]>();
  if (!property) { groups.set('', items); return groups; }
  for (const item of items) {
    const raw = propertyValue(item, property);
    const keys = Array.isArray(raw) && raw.length ? raw.map(normalizeScalar) : [normalizeScalar(raw) || '(Empty)'];
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
  }
  return new Map([...groups.entries()].sort((a, b) => { const cmp = a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }); return direction === 'asc' ? cmp : -cmp; }));
}

function applyOverlayFieldStyles(element: HTMLElement, field: OverlayFieldConfig, value = element.textContent ?? ''): void {
  const rtl = hasStrongRtl(value);
  const x = rtl ? Math.max(0, 100 - field.x - field.width) : field.x;
  element.style.left = `${x}%`;
  element.style.top = `${field.y}%`;
  element.style.width = `${field.width}%`;
  element.style.height = `${field.height}px`;
  element.style.fontSize = `${field.fontSize}px`;
  element.style.fontWeight = String(field.fontWeight);
  element.dir = rtl ? 'rtl' : 'ltr';
  element.style.textAlign = rtl ? 'right' : 'left';
}

function applyBuiltinOverlayFieldStyles(element: HTMLElement, field: OverlayFieldConfig, value = element.textContent ?? ''): void {
  const rtl = hasStrongRtl(value);
  element.style.position = 'absolute';
  element.style.top = `${field.y}%`;
  element.style.width = `${field.width}%`;
  element.style.height = `${field.height}px`;
  element.style.maxWidth = 'none';
  element.style.removeProperty('--overlay-max-width');
  element.style.removeProperty('--overlay-x');
  element.style.removeProperty('--overlay-y');
  if (rtl) {
    element.style.left = 'auto';
    element.style.right = `${field.x}%`;
  } else {
    element.style.left = `${field.x}%`;
    element.style.right = 'auto';
  }
  element.dir = rtl ? 'rtl' : 'ltr';
  element.style.textAlign = rtl ? 'right' : 'left';
}

function captureBuiltinOverlayField(surface: HTMLElement, element: HTMLElement, key: BuiltinOverlayFieldKey, index: number): OverlayFieldConfig {
  const fallback = defaultBuiltinField(key, index);
  const surfaceRect = surface.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  if (!surfaceRect.width || !surfaceRect.height || !rect.width || !rect.height) return { ...fallback };
  const style = getComputedStyle(element);
  const fontSize = Number.parseFloat(style.fontSize) || fallback.fontSize;
  const fontWeightRaw = Number.parseInt(style.fontWeight, 10);
  const fontWeight = Number.isFinite(fontWeightRaw) ? fontWeightRaw : fallback.fontWeight;
  const rtl = hasStrongRtl(element.textContent ?? '');
  const visualLeft = Math.max(0, Math.min(surfaceRect.width, rect.left - surfaceRect.left));
  const visualRight = Math.max(0, Math.min(surfaceRect.width, surfaceRect.right - rect.right));
  return {
    ...fallback,
    x: Math.max(0, Math.min(96, ((rtl ? visualRight : visualLeft) / surfaceRect.width) * 100)),
    y: Math.max(0, Math.min(96, ((rect.top - surfaceRect.top) / surfaceRect.height) * 100)),
    width: Math.max(4, Math.min(100, (rect.width / surfaceRect.width) * 100)),
    height: Math.max(16, rect.height),
    fontSize,
    fontWeight,
  };
}

function placementFromElement(surface: DOMRect, element: DOMRect): BadgePlacement {
  const centerX = element.left + element.width / 2;
  const centerY = element.top + element.height / 2;
  const left = centerX <= surface.left + surface.width / 2;
  const top = centerY <= surface.top + surface.height / 2;
  const corner: BadgeCorner = `${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}` as BadgeCorner;
  const offsetX = left
    ? ((element.left - surface.left) / surface.width) * 100
    : ((surface.right - element.right) / surface.width) * 100;
  const offsetY = top
    ? ((element.top - surface.top) / surface.height) * 100
    : ((surface.bottom - element.bottom) / surface.height) * 100;
  return {
    corner,
    offsetX: Math.max(0, Math.min(45, offsetX)),
    offsetY: Math.max(0, Math.min(45, offsetY)),
  };
}

function customTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = normalizeScalar(value).trim().toLocaleLowerCase();
  if (!text) return false;
  return !['false','0','no','off','null','undefined'].includes(text);
}

function ratingEmoji(value: unknown): string {
  const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return ['', '🤢', '😕', '😐', '🙂', '😍'][rating] || '⭐';
}

function createLorebasePathIcon(pathD: string): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  svg.appendChild(path);
  return svg;
}

function createLorebaseFavoriteIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', '#ffffff');
  svg.setAttribute('stroke', 'none');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
  svg.appendChild(path);
  return svg;
}

function createCustomCardSurface(
  app: any,
  item: LibraryItem | null,
  library: LibraryDefinition,
  orientation: 'vertical' | 'horizontal'
): HTMLElement {
  const sideCover = orientation === 'horizontal' && library.horizontalSideCover;
  const sideClass = sideCover ? ` lcl-horizontal-side-cover lcl-horizontal-cover-${library.horizontalImageSide}` : '';
  const card = document.createElement('article');
  card.className = `lorebase-card lcl-card lcl-card-${orientation} lcl-card-size-${library.cardSize}${orientation === 'horizontal' ? ' lorebase-card-horizontal' : ''}${sideClass}`;
  card.style.setProperty('--lcl-horizontal-image-width', `${library.horizontalImageWidth}%`);

  if (library.favoriteEnabled && customTruthy(item ? propertyValue(item, 'favorite') : true) && library.favoriteSubtlePulse) {
    card.classList.add('lorebase-card-favorite-pulse');
  }

  const imageContainer = document.createElement('div');
  imageContainer.className = 'lorebase-card-image lcl-cover';
  card.appendChild(imageContainer);
  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'lorebase-card-image-wrapper';
  imageContainer.appendChild(imageWrapper);

  const cover = item && library.coverProperty
    ? resolveCoverSource(app, item, propertyValue(item, library.coverProperty))
    : '';
  const fallback = document.createElement('div');
  fallback.className = 'lcl-cover-fallback';
  setIcon(fallback, library.icon || 'image');
  imageWrapper.appendChild(fallback);
  if (cover) {
    const img = document.createElement('img');
    img.alt = item?.file.basename ?? library.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = cover;
    img.onload = () => fallback.remove();
    img.onerror = () => { img.remove(); fallback.classList.add('is-error'); };
    imageWrapper.appendChild(img);
  }

  const overlay = document.createElement('div');
  overlay.className = 'lorebase-card-overlay lcl-card-overlay lcl-free-overlay';
  imageContainer.appendChild(overlay);

  for (const field of getOverlayFields(library, orientation)) {
    const raw = item ? propertyValue(item, field.property) : '';
    const value = normalizeScalar(raw).trim() || (!item ? field.property : '');
    if (!value) continue;
    const element = document.createElement('div');
    element.className = `lcl-overlay-value is-${field.role}`;
    element.dataset.lclOverlayId = field.id;
    element.textContent = value;
    applyOverlayFieldStyles(element, field);
    overlay.appendChild(element);
  }

  const badgeLayout = getBadgeLayout(library, orientation);
  const createBadgeGroup = (kind: 'favorite' | 'rating' | 'completion'): HTMLElement => {
    const placement = badgeLayout[kind];
    const group = document.createElement('div');
    group.className = `lorebase-card-badge-group is-${placement.corner}${placement.corner.startsWith('top') ? ' is-top-badge' : ''} lcl-custom-badge-group`;
    group.dataset.lclBadgeKind = kind;
    applyBadgePlacement(group, placement);
    imageContainer.appendChild(group);
    return group;
  };

  if (library.completionDateEnabled) {
    const raw = item ? propertyValue(item, library.completionDateProperty || 'finished') : new Date().toISOString().slice(0, 10);
    const formatted = formatCustomDate(raw, library.completionDateFormat);
    if (formatted) {
      const group = createBadgeGroup('completion');
      group.classList.add('has-status');
      const badge = document.createElement('div');
      badge.className = `lorebase-card-status lorebase-status-completed${library.statusAsIconOnly ? ' is-icon-only' : ''}`;
      badge.appendChild(createLorebasePathIcon('M20 6L9 17l-5-5'));
      if (!library.statusAsIconOnly) {
        const value = document.createElement('span');
        value.textContent = `Completed | ${formatted}`;
        badge.appendChild(value);
      }
      group.appendChild(badge);
    }
  }

  if (library.ratingEnabled) {
    const raw = item ? propertyValue(item, 'rating') : 4;
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) {
      const group = createBadgeGroup('rating');
      const badge = document.createElement('div');
      badge.className = `lorebase-card-rating${library.ratingStyle === 'emoji' ? ' is-emoji' : ''}`;
      badge.textContent = library.ratingStyle === 'star' ? `★${numeric}` : ratingEmoji(numeric);
      group.appendChild(badge);
    }
  }

  if (library.favoriteEnabled && customTruthy(item ? propertyValue(item, 'favorite') : true)) {
    const group = createBadgeGroup('favorite');
    const badge = document.createElement('div');
    badge.className = `lorebase-card-favorite-badge${library.favoriteSubtlePulse ? ' is-subtle-pulse' : ''}`;
    badge.appendChild(createLorebaseFavoriteIcon());
    group.appendChild(badge);
  }

  return card;
}

export interface LorebaseHostPlugin {
  app: any;
  settings: Record<string, any>;
  saveSettings(): Promise<void>;
  addCommand(command: any): void;
  registerEvent?(event: any): void;
  register?(cleanup: () => void): void;
  getMediaType?(): HostMediaType;
  getEnabledMediaTypes?(): HostMediaType[];
  switchMediaType?(mediaType: HostMediaType): Promise<void>;
}

type HostMediaType = 'game' | 'anime' | 'movie' | 'series' | 'book' | 'manga';
const BUILTIN_MEDIA: Record<HostMediaType, { label: string; icon: string }> = {
  game: { label: 'Games', icon: 'gamepad-2' },
  anime: { label: 'Anime', icon: 'clapperboard' },
  movie: { label: 'Movies', icon: 'film' },
  series: { label: 'Series', icon: 'tv' },
  book: { label: 'Books', icon: 'book-open' },
  manga: { label: 'Manga', icon: 'book-open-text' },
};

type ExtensionSettings = { version: 10; libraries: LibraryDefinition[]; builtinViews: Partial<Record<HostMediaType, UnifiedViewState>>; builtinInitialized: Partial<Record<HostMediaType, boolean>>; builtinCardLayouts: Partial<Record<HostMediaType, BuiltinCardLayouts>> };
const EXTENSION_KEY = 'customLibraries';
const CONTROLLER_SYMBOL = Symbol.for('lorebase.customLibraries.controller');

export class CustomLibrariesController {
  host: LorebaseHostPlugin;
  settings: PluginSettings;
  bridges = new Map<any, IntegratedLibraryBridge>();
  destroyed = false;
  originalShowLibraryMenu: ((evt: MouseEvent) => void) | null = null;
  patchedSettingTab: any = null;
  originalSettingDisplay: (() => void) | null = null;
  settingsSyncQueued = false;
  settingsInjecting = false;
  activeMediaSettingsLibraryId = '';
  activeCustomizationLibraryId = '';
  customizationPreviewOrientation = new Map<string, 'vertical' | 'horizontal'>();

  constructor(host: LorebaseHostPlugin) {
    this.host = host;
    const raw = host.settings?.[EXTENSION_KEY];
    const rawLibraries = Array.isArray(raw?.libraries) ? raw.libraries : Array.isArray(raw) ? raw : [];
    const builtinViews: Partial<Record<HostMediaType, UnifiedViewState>> = {};
    const builtinInitialized: Partial<Record<HostMediaType, boolean>> = {};
    const builtinCardLayouts: Partial<Record<HostMediaType, BuiltinCardLayouts>> = {};
    for (const mediaType of Object.keys(BUILTIN_MEDIA) as HostMediaType[]) {
      if (raw?.builtinViews?.[mediaType]) builtinViews[mediaType] = normalizeUnifiedViewState(raw.builtinViews[mediaType]);
      if (raw?.builtinInitialized?.[mediaType] === true) builtinInitialized[mediaType] = true;
      builtinCardLayouts[mediaType] = normalizeBuiltinCardLayouts(raw?.builtinCardLayouts?.[mediaType]);
    }
    this.settings = { libraries: rawLibraries.map(normalizeLibrary).filter(Boolean) as LibraryDefinition[], builtinViews, builtinInitialized, builtinCardLayouts };
    this.persistIntoHost();
  }

  get app(): any { return this.host.app; }

  persistIntoHost(): void {
    const extension: ExtensionSettings = { version: 10, libraries: this.settings.libraries, builtinViews: this.settings.builtinViews, builtinInitialized: this.settings.builtinInitialized, builtinCardLayouts: this.settings.builtinCardLayouts };
    this.host.settings[EXTENSION_KEY] = extension;
  }

  async saveSettings(): Promise<void> {
    this.persistIntoHost();
    await this.host.saveSettings();
  }

  start(): void {
    const workspace = this.app.workspace;
    this.cleanupLegacyViews();
    this.installRibbonMenuPatch();
    this.installSettingsIntegration();
    const sync = () => this.syncHostViews();
    if (workspace?.on && this.host.registerEvent) {
      this.host.registerEvent(workspace.on('layout-change', sync));
      this.host.registerEvent(workspace.on('active-leaf-change', sync));
    }
    if (this.app.metadataCache?.on && this.host.registerEvent) {
      this.host.registerEvent(this.app.metadataCache.on('changed', () => this.refreshViews()));
    }
    if (this.app.vault?.on && this.host.registerEvent) {
      this.host.registerEvent(this.app.vault.on('create', () => this.refreshViews()));
      this.host.registerEvent(this.app.vault.on('delete', () => this.refreshViews()));
      this.host.registerEvent(this.app.vault.on('rename', () => this.refreshViews()));
    }
    this.host.register?.(() => this.destroy());
    globalThis.setTimeout(sync, 0);
  }


  cleanupLegacyViews(): void {
    const leaves = this.app.workspace?.getLeavesOfType?.(LEGACY_VIEW_TYPE) ?? [];
    for (const leaf of leaves) {
      try { leaf?.detach?.(); } catch (error) { console.warn('[Lorebase Custom Libraries] could not detach legacy custom-library tab', error); }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const bridge of this.bridges.values()) bridge.destroy();
    this.bridges.clear();
    if (this.originalShowLibraryMenu) (this.host as any).showLibraryMenu = this.originalShowLibraryMenu;
    if (this.patchedSettingTab && this.originalSettingDisplay) this.patchedSettingTab.display = this.originalSettingDisplay;
  }

  installRibbonMenuPatch(): void {
    const hostAny = this.host as any;
    if (typeof hostAny.showLibraryMenu !== 'function' || this.originalShowLibraryMenu) return;
    this.originalShowLibraryMenu = hostAny.showLibraryMenu.bind(this.host);
    hostAny.showLibraryMenu = (evt: MouseEvent): void => {
      const enabled = this.host.getEnabledMediaTypes?.() ?? (Object.keys(BUILTIN_MEDIA) as HostMediaType[]);
      const menu = new Menu();
      for (const mediaType of enabled) {
        const option = BUILTIN_MEDIA[mediaType];
        menu.addItem((item: any) => {
          item.setTitle(option.label).setIcon(option.icon).onClick(() => { void this.activateBuiltinLibrary(mediaType); });
        });
      }
      if (enabled.length && this.settings.libraries.length) menu.addSeparator();
      for (const library of this.settings.libraries) {
        menu.addItem((item: any) => {
          item.setTitle(library.name).setIcon(library.icon || 'library').onClick(() => { void this.activateCustomLibrary(library.id); });
        });
      }
      const target = evt.currentTarget;
      if (!(target instanceof HTMLElement)) return;
      const rect = target.getBoundingClientRect();
      menu.showAtPosition({ x: rect.right, y: rect.top });
    };
  }

  async activateBuiltinLibrary(mediaType: HostMediaType): Promise<void> {
    for (const bridge of this.bridges.values()) bridge.prepareBuiltinMedia(mediaType);
    if (this.host.switchMediaType) await this.host.switchMediaType(mediaType);
    this.syncHostViews();
    for (const bridge of this.bridges.values()) bridge.augmentBuiltinUi();
  }

  getBuiltinViewState(mediaType: HostMediaType, hostView?: any): UnifiedViewState {
    let state = this.settings.builtinViews[mediaType];
    const initialized = this.settings.builtinInitialized[mediaType] === true;
    if (!initialized && hostView?.viewState) {
      state = this.seedBuiltinViewState(hostView);
      this.settings.builtinViews[mediaType] = state;
      this.settings.builtinInitialized[mediaType] = true;
      void this.saveSettings();
      return state;
    }
    if (!state) {
      state = defaultUnifiedViewState();
      this.settings.builtinViews[mediaType] = state;
    }
    return state;
  }

  seedBuiltinViewState(hostView?: any): UnifiedViewState {
    const state = defaultUnifiedViewState();
    const nativeState = hostView?.viewState;
    if (nativeState?.sort?.field) state.sorts = [{ property: this.nativeFieldToProperty(nativeState.sort.field), direction: nativeState.sort.order === 'desc' ? 'desc' : 'asc' }];
    const nativeRules = Array.isArray(nativeState?.rules) ? nativeState.rules : [];
    state.filterGroup = normalizeFilterGroup(null, nativeRules.map((rule: any) => ({ ...rule, property: this.nativeFieldToProperty(rule.field) })), 'and');
    if (nativeState?.group?.mode && nativeState.group.mode !== 'none') state.groupProperty = `@${nativeState.group.mode}`;
    state.groupDirection = nativeState?.group?.order === 'desc' ? 'desc' : 'asc';
    const settings = hostView?.getActiveSettings?.();
    if (Array.isArray(settings?.savedViews)) {
      state.savedViews = settings.savedViews.map((view: any) => ({
        id: view.id || uid('view'),
        name: view.name || 'View',
        sorts: view.state?.sort?.field ? [{ property: this.nativeFieldToProperty(view.state.sort.field), direction: view.state.sort.order === 'desc' ? 'desc' : 'asc' }] : [],
        filterMode: 'and',
        filters: [],
        filterGroup: normalizeFilterGroup(null, (view.state?.rules ?? []).map((rule: any) => ({ ...rule, property: this.nativeFieldToProperty(rule.field) })), 'and'),
        groupProperty: view.state?.group?.mode && view.state.group.mode !== 'none' ? `@${view.state.group.mode}` : '',
        groupDirection: view.state?.group?.order === 'desc' ? 'desc' : 'asc',
      }));
      state.activeSavedViewId = settings.activeSavedViewId ?? '';
    }
    return state;
  }

  getBuiltinBaseViewState(hostView?: any): UnifiedViewState {
    const nativeState = hostView?.getDefaultViewState?.() ?? hostView?.viewState;
    const state = defaultUnifiedViewState();
    if (nativeState?.sort?.field) state.sorts = [{ property: this.nativeFieldToProperty(nativeState.sort.field), direction: nativeState.sort.order === 'desc' ? 'desc' : 'asc' }];
    const nativeRules = Array.isArray(nativeState?.rules) ? nativeState.rules : [];
    state.filterGroup = normalizeFilterGroup(null, nativeRules.map((rule: any) => ({ ...rule, property: this.nativeFieldToProperty(rule.field) })), 'and');
    if (nativeState?.group?.mode && nativeState.group.mode !== 'none') state.groupProperty = `@${nativeState.group.mode}`;
    state.groupDirection = nativeState?.group?.order === 'desc' ? 'desc' : 'asc';
    return state;
  }

  nativeFieldToProperty(field: string): string {
    if (!field) return '$file.name';
    if (field === 'name') return 'name';
    if (field.startsWith('yaml:')) {
      const payload = field.slice(5); const idx = payload.indexOf(':'); const prefix = idx > 0 ? payload.slice(0, idx) : '';
      return ['text','number','date','boolean','list'].includes(prefix) ? payload.slice(idx + 1) : payload;
    }
    return field;
  }

  installSettingsIntegration(): void {
    const settingApi = (this.app as any).setting;
    const tabs = settingApi?.pluginTabs;
    if (!Array.isArray(tabs)) return;
    const tab = tabs.find((entry: any) => entry?.plugin === this.host || entry?.id === (this.host as any).manifest?.id);
    if (!tab || typeof tab.display !== 'function') return;
    if (!this.patchedSettingTab) {
      this.patchedSettingTab = tab;
      this.originalSettingDisplay = tab.display.bind(tab);
      tab.display = (): void => {
        this.originalSettingDisplay?.();
        this.injectSettingsExtensions(tab.containerEl);
      };
    }
    this.injectSettingsExtensions(tab.containerEl);
  }

  injectSettingsExtensions(container: HTMLElement): void {
    if (this.settingsInjecting) return;
    this.settingsInjecting = true;
    try {
      this.injectCustomMediaSettings(container);
      this.injectCustomCardCustomizationSettings(container);
    } finally {
      this.settingsInjecting = false;
    }
  }

  openLibrarySettings(libraryId: string): void {
    const settingApi = (this.app as any).setting;
    try {
      settingApi?.open?.();
      this.installSettingsIntegration();
      const pluginId = (this.host as any).manifest?.id ?? 'lorebase';
      settingApi?.openTabById?.(pluginId);
      globalThis.setTimeout(() => {
        const container = this.patchedSettingTab?.containerEl as HTMLElement | undefined;
        if (!container) return;
        container.querySelector<HTMLButtonElement>('[aria-controls="lorebase-settings-panel-media"]')?.click();
        const mediaAccordion = container.querySelector<HTMLDetailsElement>('.lorebase-settings-accordion-section.is-media');
        if (mediaAccordion) mediaAccordion.open = true;
        this.injectSettingsExtensions(container);
        globalThis.setTimeout(() => container.querySelector<HTMLButtonElement>(`[data-lcl-settings-library="${libraryId}"]`)?.click(), 0);
      }, 60);
      if (this.patchedSettingTab) return;
    } catch (error) { console.warn('[Lorebase Custom Libraries] could not open integrated settings', error); }
    const library = this.settings.libraries.find((item) => item.id === libraryId) ?? null;
    new LibraryModal(this.app, this, library, () => this.refreshViews()).open();
  }

  injectCustomMediaSettings(container: HTMLElement): void {
    const mediaScope = container.querySelector<HTMLElement>('#lorebase-settings-panel-media')
      ?? container.querySelector<HTMLElement>('.lorebase-settings-accordion-section.is-media .lorebase-settings-accordion-body');
    if (!mediaScope) return;
    const nativePanels = mediaScope.querySelector<HTMLElement>('.lorebase-media-settings-panels');
    if (!nativePanels) return;
    this.enhanceNativeCardSizeControls(mediaScope);

    const signature = this.settings.libraries.map((library) => [
      library.id, library.name, library.icon, library.sourceFolder, library.columns, library.orientation,
      library.cardSize, library.customCardSize, library.fileNameTemplate, library.coverProperty,
      library.customCardMinWidth, library.customCardMinHeight, library.customCardImageRatio,
      library.customHorizontalCardMinWidth, library.customHorizontalCardHeight,
      library.horizontalSideCover, library.horizontalImageSide, library.horizontalImageWidth,
      library.entryFields.map((field) => `${field.property}:${field.type}`).join(','),
    ].join(':')).join('|');

    let root = mediaScope.querySelector<HTMLElement>('.lcl-media-custom-settings');
    if (root?.dataset.lclSignature === signature) return;
    const previousActive = this.activeMediaSettingsLibraryId
      || root?.querySelector<HTMLElement>('[data-lcl-settings-library].is-active')?.dataset.lclSettingsLibrary
      || this.settings.libraries[0]?.id || '';
    root?.remove();

    root = document.createElement('div');
    root.className = 'lcl-media-custom-settings';
    root.dataset.lclSignature = signature;
    nativePanels.insertAdjacentElement('afterend', root);

    const header = document.createElement('div'); header.className = 'lcl-settings-section-header'; root.appendChild(header);
    const headingWrap = document.createElement('div'); headingWrap.className = 'lcl-settings-heading-wrap'; header.appendChild(headingWrap);
    const heading = document.createElement('div'); heading.className = 'lcl-settings-subheading'; heading.textContent = 'Custom libraries'; headingWrap.appendChild(heading);
    const desc = document.createElement('div'); desc.className = 'lorebase-settings-section-description'; desc.textContent = 'Schema-driven libraries. Built-in media settings remain unchanged above.'; headingWrap.appendChild(desc);
    const create = document.createElement('button'); create.type='button'; create.className='mod-cta lcl-new-library-button'; create.textContent='+ New library';
    create.onclick=()=>new LibraryModal(this.app,this,null,()=>{this.refreshViews();this.injectSettingsExtensions(container);}).open(); header.appendChild(create);

    if (!this.settings.libraries.length) {
      const empty=document.createElement('div');empty.className='lorebase-settings-section-description lcl-settings-empty';empty.textContent='No custom libraries yet.';root.appendChild(empty);return;
    }

    const tabsHost=document.createElement('div');tabsHost.className='lorebase-media-settings-tabs lcl-custom-media-tabs';root.appendChild(tabsHost);
    const tabs=document.createElement('div');tabs.className='lorebase-media-tabs';tabsHost.appendChild(tabs);
    const panels=document.createElement('div');panels.className='lcl-custom-media-panels';root.appendChild(panels);

    const activate=(id:string):void=>{
      this.activeMediaSettingsLibraryId=id;
      tabs.querySelectorAll<HTMLElement>('[data-lcl-settings-library]').forEach((button)=>button.classList.toggle('is-active',button.dataset.lclSettingsLibrary===id));
      panels.querySelectorAll<HTMLElement>('[data-lcl-settings-library-panel]').forEach((panel)=>{const active=panel.dataset.lclSettingsLibraryPanel===id;panel.classList.toggle('is-active',active);panel.hidden=!active;});
    };

    for(const library of this.settings.libraries){
      const button=document.createElement('button');button.type='button';button.className='lorebase-media-tab';button.dataset.lclSettingsLibrary=library.id;
      const icon=document.createElement('span');icon.className='lorebase-media-tab-icon';setIcon(icon,library.icon||'library');button.appendChild(icon);
      const label=document.createElement('span');label.className='lorebase-media-tab-label';label.textContent=library.name;button.appendChild(label);
      button.onclick=()=>activate(library.id);tabs.appendChild(button);
      const panel=document.createElement('div');panel.className='lcl-custom-media-panel';panel.dataset.lclSettingsLibraryPanel=library.id;panels.appendChild(panel);
      this.renderCustomSettingsPanel(panel,library);
    }
    const selected=this.settings.libraries.some((library)=>library.id===previousActive)?previousActive:this.settings.libraries[0].id;
    activate(selected);
  }


  enhanceNativeCardSizeControls(mediaScope: HTMLElement): void {
    const labelMatchers = [
      /card min width|card width target/i,
      /card min height|card minimum height/i,
      /horizontal card min width|horizontal minimum width|horizontal width target/i,
      /horizontal card height/i,
    ];
    const nativeRanges = new Set(['140:480', '180:900', '240:700', '120:520']);
    mediaScope.querySelectorAll<HTMLElement>('.setting-item').forEach((setting) => {
      const range = setting.querySelector<HTMLInputElement>('input[type="range"]');
      if (!range) return;
      const name = setting.querySelector<HTMLElement>('.setting-item-name')?.textContent?.trim() ?? '';
      const signature = `${range.min}:${range.max}`;
      if (!labelMatchers.some((matcher) => matcher.test(name)) && !nativeRanges.has(signature)) return;
      range.min = '100';
      // Preserve Lorebase's native slider, maximum, step, tooltip, styling and value display.
    });
  }



  enhanceBuiltinCardCustomizationPreview(scope: HTMLElement, settingsContainer: HTMLElement): void {
    // 0.8.1: the native Lorebase preview itself is the free-layout editor.
    scope.querySelector('.lcl-builtin-free-layout-settings')?.remove();
    const modeRaw = scope.dataset.previewMode ?? 'game';
    const mediaType: HostMediaType = (modeRaw in BUILTIN_MEDIA ? modeRaw : 'game') as HostMediaType;
    const orientation: CardOrientation = scope.dataset.previewOrientation === 'horizontal' ? 'horizontal' : 'vertical';
    const layouts = this.settings.builtinCardLayouts[mediaType] ?? normalizeBuiltinCardLayouts(null);
    this.settings.builtinCardLayouts[mediaType] = layouts;
    const layout = layouts[orientation];

    const card = scope.querySelector<HTMLElement>('.lorebase-badges-editor-card');
    const surface = card?.querySelector<HTMLElement>('.lorebase-card-image');
    if (!card || !surface) return;
    card.classList.add('lcl-builtin-enhanced-preview');
    surface.classList.add('lcl-builtin-enhanced-surface');

    const definitions: Array<[BuiltinOverlayFieldKey,string]> = [
      ['title','.lorebase-card-title'],
      ['year','.lorebase-card-year:not(.lorebase-card-format)'],
      ['format','.lorebase-card-format'],
      ['description','.lorebase-card-description'],
    ];
    for (const [index,[key,selector]] of definitions.entries()) {
      const element = card.querySelector<HTMLElement>(selector);
      if (!element || getComputedStyle(element).display === 'none') continue;
      let field = layout.fields[key];
      if (!layout.active || !field) {
        field = captureBuiltinOverlayField(surface, element, key, index);
        layout.fields[key] = field;
      }
      element.dataset.lclBuiltinField = key;
      element.classList.add('lcl-builtin-free-field');
      element.querySelector(':scope > .lcl-overlay-resize-handle')?.remove();
      applyBuiltinOverlayFieldStyles(element, field, element.textContent ?? '');
      const handle = document.createElement('span');
      handle.className = 'lcl-overlay-resize-handle';
      handle.dataset.lclBuiltinResize = 'true';
      element.appendChild(handle);
    }

    const badgeDefinitions: Array<[keyof BuiltinCardLayout['badges'],string]> = [
      ['favorite','.lorebase-card-favorite-badge'],
      ['rating','.lorebase-card-rating'],
      ['status','.lorebase-card-status'],
    ];
    for (const [kind, selector] of badgeDefinitions) {
      const content = card.querySelector<HTMLElement>(selector);
      const group = content?.closest<HTMLElement>('.lorebase-card-badge-group');
      if (!group || getComputedStyle(group).display === 'none') continue;
      if (!layout.active) layout.badges[kind] = placementFromElement(surface.getBoundingClientRect(), group.getBoundingClientRect());
      group.dataset.lclBuiltinBadgeKind = kind;
      group.classList.add('lcl-editable-badge');
      group.draggable = false;
      content!.draggable = false;
      applyBadgePlacement(group, layout.badges[kind]);
    }

    if (card.dataset.lclBuiltinFreeBound !== 'true') {
      card.dataset.lclBuiltinFreeBound = 'true';
      card.addEventListener('pointerdown', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const badge = target.closest<HTMLElement>('[data-lcl-builtin-badge-kind]');
        if (badge) {
          const kind = badge.dataset.lclBuiltinBadgeKind as keyof BuiltinCardLayout['badges'];
          this.startBuiltinBadgeDrag(scope, badge, kind, event);
          return;
        }
        const fieldElement = target.closest<HTMLElement>('[data-lcl-builtin-field]');
        if (!fieldElement) return;
        const key = fieldElement.dataset.lclBuiltinField as BuiltinOverlayFieldKey;
        const resize = Boolean(target.closest('[data-lcl-builtin-resize]'));
        this.startBuiltinFieldDrag(scope, fieldElement, key, resize, event);
      }, { capture: true });
    }

    if (scope.dataset.lclBuiltinPreviewEvents !== 'true') {
      scope.dataset.lclBuiltinPreviewEvents = 'true';
      const resync = (): void => { globalThis.setTimeout(() => this.enhanceBuiltinCardCustomizationPreview(scope, settingsContainer), 0); };
      scope.addEventListener('lorebase-preview-mode-change', resync);
      scope.addEventListener('lorebase-preview-orientation-change', resync);
      scope.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest('.lorebase-overlay-reset-btn')) {
          const currentMode = (scope.dataset.previewMode ?? 'game') as HostMediaType;
          const currentOrientation: CardOrientation = scope.dataset.previewOrientation === 'horizontal' ? 'horizontal' : 'vertical';
          const currentLayouts = this.settings.builtinCardLayouts[currentMode] ?? normalizeBuiltinCardLayouts(null);
          currentLayouts[currentOrientation] = defaultBuiltinCardLayout();
          currentLayouts[currentOrientation].active = false;
          this.settings.builtinCardLayouts[currentMode] = currentLayouts;
          void this.saveSettings().then(() => this.refreshViews());
        }
        resync();
      });
      scope.addEventListener('change', resync);
    }
  }

  private getBuiltinPreviewContext(scope: HTMLElement): { mediaType: HostMediaType; orientation: CardOrientation; layout: BuiltinCardLayout } {
    const raw = scope.dataset.previewMode ?? 'game';
    const mediaType: HostMediaType = (raw in BUILTIN_MEDIA ? raw : 'game') as HostMediaType;
    const orientation: CardOrientation = scope.dataset.previewOrientation === 'horizontal' ? 'horizontal' : 'vertical';
    const layouts = this.settings.builtinCardLayouts[mediaType] ?? normalizeBuiltinCardLayouts(null);
    this.settings.builtinCardLayouts[mediaType] = layouts;
    return { mediaType, orientation, layout: layouts[orientation] };
  }

  private startBuiltinFieldDrag(scope: HTMLElement, element: HTMLElement, key: BuiltinOverlayFieldKey, resize: boolean, event: PointerEvent): void {
    const card = element.closest<HTMLElement>('.lorebase-badges-editor-card');
    const surface = card?.querySelector<HTMLElement>('.lorebase-card-image');
    if (!surface) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const context = this.getBuiltinPreviewContext(scope);
    let field = context.layout.fields[key];
    if (!field) {
      field = captureBuiltinOverlayField(surface, element, key, 0);
      context.layout.fields[key] = field;
    }
    const pointerId = event.pointerId;
    const startPointerX = event.clientX;
    const startPointerY = event.clientY;
    const startX = field.x;
    const startY = field.y;
    const startWidth = element.getBoundingClientRect().width;
    const startHeight = element.getBoundingClientRect().height;
    const rtl = hasStrongRtl(element.textContent ?? '');
    const startVisualX = rtl ? Math.max(0, 100 - startX - field.width) : startX;
    element.classList.add('is-manipulating');
    element.setPointerCapture?.(pointerId);

    const onMove = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== pointerId) return;
      const rect = surface.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (resize) {
        const visualLeft = rtl ? 100 - field!.x - field!.width : field!.x;
        const leftPx = (visualLeft / 100) * rect.width;
        const topPx = (field!.y / 100) * rect.height;
        const widthPx = Math.max(16, Math.min(rect.width - leftPx, startWidth + (moveEvent.clientX - startPointerX)));
        const heightPx = Math.max(16, Math.min(rect.height - topPx, startHeight + (moveEvent.clientY - startPointerY)));
        field!.width = Math.max(4, Math.min(100, (widthPx / rect.width) * 100));
        field!.height = heightPx;
      } else {
        const dx = ((moveEvent.clientX - startPointerX) / rect.width) * 100;
        const dy = ((moveEvent.clientY - startPointerY) / rect.height) * 100;
        const visual = Math.max(0, Math.min(100 - field!.width, startVisualX + dx));
        field!.x = rtl ? Math.max(0, 100 - visual - field!.width) : visual;
        field!.y = Math.max(0, Math.min(96, startY + dy));
      }
      context.layout.active = true;
      applyBuiltinOverlayFieldStyles(element, field!, element.textContent ?? '');
    };
    const finish = (upEvent: PointerEvent): void => {
      if (upEvent.pointerId !== pointerId) return;
      element.ownerDocument.removeEventListener('pointermove', onMove, true);
      element.ownerDocument.removeEventListener('pointerup', finish, true);
      element.ownerDocument.removeEventListener('pointercancel', finish, true);
      element.classList.remove('is-manipulating');
      if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
      context.layout.active = true;
      void this.saveSettings().then(() => this.refreshViews());
    };
    element.ownerDocument.addEventListener('pointermove', onMove, true);
    element.ownerDocument.addEventListener('pointerup', finish, true);
    element.ownerDocument.addEventListener('pointercancel', finish, true);
  }

  private startBuiltinBadgeDrag(scope: HTMLElement, group: HTMLElement, kind: keyof BuiltinCardLayout['badges'], event: PointerEvent): void {
    const card = group.closest<HTMLElement>('.lorebase-badges-editor-card');
    const surface = card?.querySelector<HTMLElement>('.lorebase-card-image');
    if (!surface) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const context = this.getBuiltinPreviewContext(scope);
    const pointerId = event.pointerId;
    const groupRect = group.getBoundingClientRect();
    const grabX = event.clientX - groupRect.left;
    const grabY = event.clientY - groupRect.top;
    group.classList.add('is-manipulating');
    group.setPointerCapture?.(pointerId);
    const onMove = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== pointerId) return;
      const surfaceRect = surface.getBoundingClientRect();
      const width = group.getBoundingClientRect().width;
      const height = group.getBoundingClientRect().height;
      const left = Math.max(surfaceRect.left, Math.min(surfaceRect.right - width, moveEvent.clientX - grabX));
      const top = Math.max(surfaceRect.top, Math.min(surfaceRect.bottom - height, moveEvent.clientY - grabY));
      const next = placementFromElement(surfaceRect, new DOMRect(left, top, width, height));
      context.layout.badges[kind] = next;
      context.layout.active = true;
      applyBadgePlacement(group, next);
    };
    const finish = (upEvent: PointerEvent): void => {
      if (upEvent.pointerId !== pointerId) return;
      group.ownerDocument.removeEventListener('pointermove', onMove, true);
      group.ownerDocument.removeEventListener('pointerup', finish, true);
      group.ownerDocument.removeEventListener('pointercancel', finish, true);
      group.classList.remove('is-manipulating');
      if (group.hasPointerCapture?.(pointerId)) group.releasePointerCapture(pointerId);
      context.layout.active = true;
      void this.saveSettings().then(() => this.refreshViews());
    };
    group.ownerDocument.addEventListener('pointermove', onMove, true);
    group.ownerDocument.addEventListener('pointerup', finish, true);
    group.ownerDocument.addEventListener('pointercancel', finish, true);
  }

  bindBadgePlacementDrag(group: HTMLElement, surface: HTMLElement, initial: BadgePlacement, onCommit: (next: BadgePlacement) => void | Promise<void>): void {
    group.title = 'Drag to reposition. Placement is stored as nearest corner + percentage edge offsets.';
    group.addEventListener('pointerdown', (event) => {
      event.preventDefault(); event.stopPropagation();
      const pointerId = event.pointerId;
      const startRect = group.getBoundingClientRect();
      const grabX = event.clientX - startRect.left;
      const grabY = event.clientY - startRect.top;
      let current = initial;
      group.classList.add('is-manipulating');
      group.setPointerCapture?.(pointerId);
      const move = (moveEvent: PointerEvent): void => {
        if (moveEvent.pointerId !== pointerId) return;
        const surfaceRect = surface.getBoundingClientRect();
        const rect = group.getBoundingClientRect();
        const left = Math.max(surfaceRect.left, Math.min(surfaceRect.right - rect.width, moveEvent.clientX - grabX));
        const top = Math.max(surfaceRect.top, Math.min(surfaceRect.bottom - rect.height, moveEvent.clientY - grabY));
        current = placementFromElement(surfaceRect, new DOMRect(left, top, rect.width, rect.height));
        applyBadgePlacement(group, current);
      };
      const finish = (upEvent: PointerEvent): void => {
        if (upEvent.pointerId !== pointerId) return;
        if (group.hasPointerCapture?.(pointerId)) group.releasePointerCapture(pointerId);
        group.ownerDocument.removeEventListener('pointermove', move);
        group.ownerDocument.removeEventListener('pointerup', finish);
        group.ownerDocument.removeEventListener('pointercancel', finish);
        group.classList.remove('is-manipulating');
        void Promise.resolve(onCommit(current));
      };
      group.ownerDocument.addEventListener('pointermove', move);
      group.ownerDocument.addEventListener('pointerup', finish);
      group.ownerDocument.addEventListener('pointercancel', finish);
    });
  }

  bindFreeLayoutBox(element: HTMLElement, resizeHandle: HTMLElement, surface: HTMLElement, field: OverlayFieldConfig, onCommit: () => void | Promise<void>): void {
    let mode: 'move'|'resize'|null = null, pointerId: number|null = null;
    let startX=0,startY=0,startFieldX=0,startFieldY=0,startWidth=0,startHeight=0;
    const move = (event: PointerEvent): void => {
      if (pointerId === null || event.pointerId !== pointerId || !mode) return;
      const rect = surface.getBoundingClientRect(); if (!rect.width || !rect.height) return;
      if (mode === 'move') {
        const dx=((event.clientX-startX)/rect.width)*100, dy=((event.clientY-startY)/rect.height)*100;
        const rtl = element.dir === 'rtl';
        const startVisual = rtl ? 100-startFieldX-field.width : startFieldX;
        const visual=Math.max(0,Math.min(100-field.width,startVisual+dx));
        field.x=rtl?Math.max(0,100-visual-field.width):visual;
        field.y=Math.max(0,Math.min(96,startFieldY+dy));
      } else {
        const visualLeft = element.dir === 'rtl' ? 100-field.x-field.width : field.x;
        const leftPx=(visualLeft/100)*rect.width, topPx=(field.y/100)*rect.height;
        const widthPx=Math.max(16,Math.min(rect.width-leftPx,startWidth+(event.clientX-startX)));
        const heightPx=Math.max(16,Math.min(rect.height-topPx,startHeight+(event.clientY-startY)));
        field.width=Math.max(1,Math.min(100,(widthPx/rect.width)*100)); field.height=heightPx;
      }
      applyOverlayFieldStyles(element,field,element.textContent??'');
    };
    const end = (event: PointerEvent): void => {
      if (pointerId===null||event.pointerId!==pointerId)return;
      element.ownerDocument.removeEventListener('pointermove',move);element.ownerDocument.removeEventListener('pointerup',end);element.ownerDocument.removeEventListener('pointercancel',end);
      pointerId=null;mode=null;void Promise.resolve(onCommit());
    };
    const begin=(event:PointerEvent,next:'move'|'resize'):void=>{event.preventDefault();event.stopPropagation();mode=next;pointerId=event.pointerId;startX=event.clientX;startY=event.clientY;startFieldX=field.x;startFieldY=field.y;const r=element.getBoundingClientRect();startWidth=r.width;startHeight=r.height;element.ownerDocument.addEventListener('pointermove',move);element.ownerDocument.addEventListener('pointerup',end);element.ownerDocument.addEventListener('pointercancel',end);};
    element.addEventListener('pointerdown',(event)=>{if(event.target===resizeHandle)return;begin(event,'move');});
    resizeHandle.addEventListener('pointerdown',(event)=>begin(event,'resize'));
  }

  injectCustomCardCustomizationSettings(container: HTMLElement): void {
    const scope = container.querySelector<HTMLElement>('#lorebase-settings-panel-customization')
      ?? container.querySelector<HTMLElement>('.lorebase-settings-accordion-section.is-customization .lorebase-settings-accordion-body');
    if (!scope) return;
    this.enhanceBuiltinCardCustomizationPreview(scope, container);

    const previewState = [...this.customizationPreviewOrientation.entries()].map(([id, orientation]) => `${id}:${orientation}`).join(',');
    const signature = `${this.activeCustomizationLibraryId}|${previewState}|` + this.settings.libraries.map((library) => [
      library.id, library.name, library.icon,
      library.orientation, library.cardSize, library.customCardSize,
      library.customCardMinWidth, library.customCardMinHeight, library.customCardImageRatio,
      library.customHorizontalCardMinWidth, library.customHorizontalCardHeight,
      library.horizontalSideCover, library.horizontalImageSide, library.horizontalImageWidth,
      library.favoriteEnabled, library.favoriteSubtlePulse,
      library.ratingEnabled, library.ratingStyle,
      library.completionDateEnabled, library.completionDateFormat,
      ['vertical','horizontal'].map((orientation) => `${orientation}=` + getOverlayFields(library, orientation as CardOrientation).map((field) => `${field.id}:${field.property}:${field.role}:${field.x}:${field.y}:${field.width}:${field.height}:${field.fontSize}:${field.fontWeight}`).join(',')).join(';'),
      JSON.stringify(library.badgeLayouts), library.statusAsIconOnly,
      library.entryFields.map((field) => `${field.property}:${field.type}`).join(','),
    ].join(':')).join('|');

    let root = scope.querySelector<HTMLElement>('.lcl-card-customization-settings');
    if (root?.dataset.lclSignature === signature) return;
    root?.remove();

    root = document.createElement('div');
    root.className = 'lcl-card-customization-settings';
    root.dataset.lclSignature = signature;
    scope.appendChild(root);

    const heading = document.createElement('div');
    heading.className = 'lcl-settings-subheading';
    heading.textContent = 'Custom libraries';
    root.appendChild(heading);
    const desc = document.createElement('div');
    desc.className = 'lorebase-settings-section-description';
    desc.textContent = 'Configure custom-library badges and overlay fields with the same preview-first workflow as Lorebase cards.';
    root.appendChild(desc);

    if (!this.settings.libraries.length) {
      const empty = document.createElement('div');
      empty.className = 'lorebase-settings-section-description';
      empty.textContent = 'Create a custom library in Media settings first.';
      root.appendChild(empty);
      return;
    }

    const selectedId = this.settings.libraries.some((library) => library.id === this.activeCustomizationLibraryId)
      ? this.activeCustomizationLibraryId
      : this.settings.libraries[0].id;
    this.activeCustomizationLibraryId = selectedId;
    const library = this.settings.libraries.find((item) => item.id === selectedId)!;
    const previewOrientation = this.customizationPreviewOrientation.get(library.id) ?? 'vertical';

    const previewSection = document.createElement('div');
    previewSection.className = 'lcl-custom-preview-section is-lorebase-style';
    root.appendChild(previewSection);

    const previewHost = document.createElement('div');
    previewHost.className = `lcl-custom-preview-host is-${previewOrientation}`;
    previewSection.appendChild(previewHost);
    this.renderCustomSettingsPreviewCard(previewHost, library, previewOrientation, true);

    const previewHint = document.createElement('div');
    previewHint.className = 'lcl-preview-hint';
    previewHint.textContent = 'Drag a text box to move it. Drag its corner handle to resize it. Font size and weight are adjusted below.';
    previewSection.appendChild(previewHint);

    const previewFooter = document.createElement('div');
    previewFooter.className = 'lcl-preview-footer';
    previewSection.appendChild(previewFooter);
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.textContent = 'Restore defaults';
    restore.onclick = async () => {
      library.favoriteEnabled = false;
      library.favoriteSubtlePulse = false;
      library.ratingEnabled = false;
      library.ratingStyle = 'emoji';
      library.completionDateEnabled = false;
      library.completionDateProperty = 'finished';
      library.completionDateFormat = 'short';
      library.overlayFields = [];
      library.overlayLayouts = { vertical: [], horizontal: [] };
      library.badgeLayouts = { vertical: defaultBadgeLayout(), horizontal: defaultBadgeLayout() };
      library.statusAsIconOnly = false;
      await this.saveSettings();
      this.refreshViews();
      this.injectCustomCardCustomizationSettings(container);
    };
    previewFooter.appendChild(restore);

    const previewModeSetting = new Setting(root).setName('Preview mode');
    previewModeSetting.controlEl?.appendChild(inlineLorebaseSelect(
      this.settings.libraries.map((item) => ({ value: item.id, label: item.name, icon: item.icon || 'library' })),
      library.id,
      (id) => {
        this.activeCustomizationLibraryId = id;
        this.injectCustomCardCustomizationSettings(container);
      }
    ));

    const previewOrientationSetting = new Setting(root).setName('Card orientation');
    previewOrientationSetting.controlEl?.appendChild(inlineLorebaseSelect(
      [{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }],
      previewOrientation,
      (value) => {
        this.customizationPreviewOrientation.set(library.id, value === 'horizontal' ? 'horizontal' : 'vertical');
        this.injectCustomCardCustomizationSettings(container);
      }
    ));

    new Setting(root)
      .setName('Favorite')
      .setDesc('Show Lorebase-style favorite badge using the favorite checkbox property.')
      .addToggle((toggle: any) => toggle.setValue(library.favoriteEnabled).onChange(async (value: boolean) => {
        library.favoriteEnabled = value;
        if (value) ensureEntryField(library, 'favorite', 'boolean');
        await this.saveSettings();
        this.refreshViews();
        this.injectSettingsExtensions(container);
      }));

    if (library.favoriteEnabled) {
      new Setting(root)
        .setName('Favorite subtle pulse')
        .addToggle((toggle: any) => toggle.setValue(library.favoriteSubtlePulse).onChange(async (value: boolean) => {
          library.favoriteSubtlePulse = value;
          await this.saveSettings();
          this.refreshViews();
          this.injectCustomCardCustomizationSettings(container);
        }));
    }

    new Setting(root)
      .setName('Rating')
      .setDesc('Show Lorebase-style rating badge using the rating number property.')
      .addToggle((toggle: any) => toggle.setValue(library.ratingEnabled).onChange(async (value: boolean) => {
        library.ratingEnabled = value;
        if (value) ensureEntryField(library, 'rating', 'number');
        await this.saveSettings();
        this.refreshViews();
        this.injectSettingsExtensions(container);
      }));

    if (library.ratingEnabled) {
      const ratingStyleSetting = new Setting(root).setName('Rating style');
      ratingStyleSetting.controlEl?.appendChild(inlineLorebaseSelect(
        [{ value: 'emoji', label: 'Emoji' }, { value: 'star', label: 'Star' }],
        library.ratingStyle,
        async (value) => {
          library.ratingStyle = normalizeRatingStyle(value);
          await this.saveSettings();
          this.refreshViews();
          this.injectCustomCardCustomizationSettings(container);
        }
      ));
    }

    new Setting(root)
      .setName('Completion date')
      .setDesc('Show completion date using the finished date property.')
      .addToggle((toggle: any) => toggle.setValue(library.completionDateEnabled).onChange(async (value: boolean) => {
        library.completionDateEnabled = value;
        library.completionDateProperty = 'finished';
        if (value) ensureEntryField(library, 'finished', 'date');
        await this.saveSettings();
        this.refreshViews();
        this.injectSettingsExtensions(container);
      }));

    if (library.completionDateEnabled) {
      const completionFormatSetting = new Setting(root).setName('Completion date format');
      completionFormatSetting.controlEl?.appendChild(inlineLorebaseSelect(
        [{ value: 'short', label: 'Status · Jul 22' }, { value: 'full', label: 'Status · Jul 22, 2026' }],
        library.completionDateFormat,
        async (value) => {
          library.completionDateFormat = normalizeCompletionDateFormat(value);
          await this.saveSettings();
          this.refreshViews();
          this.injectCustomCardCustomizationSettings(container);
        }
      ));
    }

    if (library.completionDateEnabled) {
      new Setting(root)
        .setName('Status as icon only')
        .setDesc('Show only the completed check icon on the card.')
        .addToggle((toggle: any) => toggle.setValue(library.statusAsIconOnly).onChange(async (value: boolean) => {
          library.statusAsIconOnly = value;
          await this.saveSettings();
          this.refreshViews();
          this.injectCustomCardCustomizationSettings(container);
        }));
    }

    const overlayHeading = document.createElement('div');
    overlayHeading.className = 'lcl-settings-inline-heading';
    overlayHeading.textContent = 'Card overlay fields';
    root.appendChild(overlayHeading);
    const overlayDesc = document.createElement('div');
    overlayDesc.className = 'lorebase-settings-section-description';
    overlayDesc.textContent = 'Choose Entry properties to display on the card. Only property values are shown; property names are never rendered.';
    root.appendChild(overlayDesc);

    this.renderOverlayFieldEditor(root, library, previewOrientation, container);
  }

  renderOverlayFieldEditor(container: HTMLElement, library: LibraryDefinition, orientation: CardOrientation, settingsContainer: HTMLElement): void {
    const fields = getOverlayFields(library, orientation);
    const list = document.createElement('div');
    list.className = 'lcl-overlay-field-list';
    container.appendChild(list);

    const save = async (rerender = false): Promise<void> => {
      await this.saveSettings();
      this.refreshViews();
      if (rerender) this.injectCustomCardCustomizationSettings(settingsContainer);
    };

    const render = (): void => {
      list.innerHTML = '';
      for (const [index, field] of fields.entries()) {
        const card = document.createElement('div');
        card.className = 'lcl-overlay-field-setting';
        list.appendChild(card);

        const header = document.createElement('div');
        header.className = 'lcl-overlay-field-setting-header';
        card.appendChild(header);

        const drag = document.createElement('button');
        drag.type = 'button';
        drag.className = 'lcl-drag-handle';
        drag.title = 'Drag to reorder';
        drag.tabIndex = -1;
        setIcon(drag, 'grip-vertical');
        header.appendChild(drag);
        card.dataset.index = String(index);
        drag.draggable = true;

        const propertyValues = [...new Set([field.property, ...library.entryFields.map((entry) => entry.property)])].filter(Boolean);
        const property = inlineLorebaseSelect(
          propertyValues.map((value) => ({ value, label: value })),
          field.property,
          (value) => { field.property = value; void save(true); },
          'Property',
          'lcl-overlay-property-select'
        );
        header.appendChild(property);

        const role = inlineLorebaseSelect(
          [{ value: 'title', label: 'Title' }, { value: 'description', label: 'Description' }, { value: 'text', label: 'Text' }],
          field.role,
          (value) => {
            field.role = normalizeOverlayRole(value);
            const defaults = defaultOverlayField(field.property, field.role, index);
            field.fontSize = defaults.fontSize;
            field.fontWeight = defaults.fontWeight;
            field.width = defaults.width;
            field.height = defaults.height;
            void save(true);
          },
          'Role',
          'lcl-overlay-role-select'
        );
        header.appendChild(role);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'lorebase-view-icon-button';
        remove.title = 'Remove overlay field';
        setIcon(remove, 'trash-2');
        remove.onclick = () => {
          fields.splice(index, 1);
          void save(true);
        };
        header.appendChild(remove);

        const controls = document.createElement('div');
        controls.className = 'lcl-overlay-field-controls';
        card.appendChild(controls);
        this.compactNumberControl(controls, 'Size', field.fontSize, 8, 72, 1, (value) => { field.fontSize = value; void save(true); }, 'px');
        this.compactSelectControl(controls, 'Weight', [
          ['300','Light'],['400','Regular'],['500','Medium'],['600','Semibold'],['700','Bold'],['800','Extra bold'],['900','Black']
        ], String(field.fontWeight), (value) => { field.fontWeight = Number(value); void save(true); });

        drag.addEventListener('dragstart', (event) => {
          event.dataTransfer?.setData('text/plain', String(index));
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
          card.classList.add('is-dragging');
        });
        drag.addEventListener('dragend', () => card.classList.remove('is-dragging'));
        card.addEventListener('dragover', (event) => {
          event.preventDefault();
          card.classList.add('is-drop-target');
        });
        card.addEventListener('dragleave', () => card.classList.remove('is-drop-target'));
        card.addEventListener('drop', (event) => {
          event.preventDefault();
          card.classList.remove('is-drop-target');
          const from = Number(event.dataTransfer?.getData('text/plain'));
          if (!Number.isInteger(from) || from < 0 || from >= fields.length || from === index) return;
          const [moved] = fields.splice(from, 1);
          fields.splice(index, 0, moved);
          void save(true);
        });
      }

      const available = library.entryFields
        .map((entry) => entry.property)
        .filter((property) => !fields.some((field) => field.property === property));
      const addRow = document.createElement('div');
      addRow.className = 'lcl-overlay-add-row';
      list.appendChild(addRow);
      let pendingProperty = '';
      const propertySelect = inlineLorebaseSelect(
        available.map((property) => ({ value: property, label: property })),
        '',
        (value) => { pendingProperty = value; },
        available.length ? 'Select Entry property…' : 'No unused Entry properties'
      );
      addRow.appendChild(propertySelect);
      const add = document.createElement('button');
      add.type = 'button';
      add.textContent = '+ Add overlay field';
      add.disabled = !available.length;
      add.onclick = () => {
        if (!pendingProperty) return;
        const role: OverlayTextRole = fields.length === 0 ? 'title' : fields.length === 1 ? 'description' : 'text';
        fields.push(defaultOverlayField(pendingProperty, role, fields.length));
        void save(true);
      };
      addRow.appendChild(add);
    };
    render();
  }

  compactNumberControl(
    parent: HTMLElement, labelText: string, value: number, min: number, max: number, step: number,
    onChange: (value: number) => void, suffix = ''
  ): void {
    const wrap = document.createElement('label');
    wrap.className = 'lcl-compact-control';
    const label = document.createElement('span');
    label.textContent = labelText;
    wrap.appendChild(label);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.onchange = () => {
      const raw = Number(input.value);
      if (!Number.isFinite(raw)) { input.value = String(value); return; }
      const normalized = Math.max(min, Math.min(max, step < 1 ? Math.round(raw * 100) / 100 : Math.round(raw)));
      input.value = String(normalized);
      onChange(normalized);
    };
    wrap.appendChild(input);
    if (suffix) {
      const unit = document.createElement('small');
      unit.textContent = suffix;
      wrap.appendChild(unit);
    }
    parent.appendChild(wrap);
  }

  compactSelectControl(
    parent: HTMLElement, labelText: string, options: Array<[string,string]>, value: string,
    onChange: (value: string) => void
  ): void {
    const wrap = document.createElement('label');
    wrap.className = 'lcl-compact-control';
    const label = document.createElement('span');
    label.textContent = labelText;
    wrap.appendChild(label);
    const select = inlineLorebaseSelect(
      options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel })),
      value,
      onChange
    );
    wrap.appendChild(select);
    parent.appendChild(wrap);
  }

  renderCustomSettingsPreviewCard(
    parent: HTMLElement,
    library: LibraryDefinition,
    orientation: 'vertical' | 'horizontal',
    interactive = false
  ): void {
    const sourceItem = this.getCustomPreviewItem(library);
    const item = sourceItem
      ? { file: sourceItem.file, fields: { ...sourceItem.fields } }
      : null;
    if (item) {
      // Card Customization is a design preview: enabled badges must stay visible
      // even when the first real note does not yet contain representative values.
      if (library.favoriteEnabled) item.fields.favorite = true;
      if (library.ratingEnabled) item.fields.rating = 4;
      if (library.completionDateEnabled) item.fields[library.completionDateProperty || 'finished'] = '2026-07-22';
    }
    const card = createCustomCardSurface(this.app, item, library, orientation);
    card.classList.add('lcl-settings-preview-card');
    parent.appendChild(card);
    if (!interactive) return;

    card.querySelectorAll<HTMLElement>('[data-lcl-overlay-id]').forEach((element) => {
      const field = getOverlayFields(library, orientation).find((entry) => entry.id === element.dataset.lclOverlayId);
      const surface = element.closest<HTMLElement>('.lcl-card-overlay');
      if (!field || !surface) return;
      element.classList.add('is-editable');
      element.title = 'Drag to move. Drag the corner handle to resize.';

      const resizeHandle = document.createElement('span');
      resizeHandle.className = 'lcl-overlay-resize-handle';
      resizeHandle.setAttribute('aria-hidden', 'true');
      element.appendChild(resizeHandle);

      let mode: 'move' | 'resize' | null = null;
      let activePointerId: number | null = null;
      let startX = 0;
      let startY = 0;
      let startFieldX = 0;
      let startFieldY = 0;
      let startWidthPx = 0;
      let startHeightPx = 0;

      const selectBox = (): void => {
        card.querySelectorAll<HTMLElement>('.lcl-overlay-value.is-editable.is-selected').forEach((node) => {
          if (node !== element) node.classList.remove('is-selected');
        });
        element.classList.add('is-selected');
      };

      const onMove = (event: PointerEvent): void => {
        if (activePointerId === null || event.pointerId !== activePointerId || !mode) return;
        const rect = surface.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        if (mode === 'move') {
          const dx = ((event.clientX - startX) / rect.width) * 100;
          const dy = ((event.clientY - startY) / rect.height) * 100;
          const boxHeightPercent = Math.min(100, (Math.max(16, element.getBoundingClientRect().height) / rect.height) * 100);
          const rtl = element.dir === 'rtl';
          const startVisualX = rtl ? Math.max(0, 100 - startFieldX - field.width) : startFieldX;
          const nextVisualX = Math.max(0, Math.min(100 - Math.min(100, field.width), startVisualX + dx));
          field.x = rtl ? Math.max(0, 100 - nextVisualX - field.width) : nextVisualX;
          field.y = Math.max(0, Math.min(100 - boxHeightPercent, startFieldY + dy));
        } else {
          const leftPx = (field.x / 100) * rect.width;
          const topPx = (field.y / 100) * rect.height;
          const availableWidth = Math.max(16, rect.width - leftPx);
          const availableHeight = Math.max(16, rect.height - topPx);
          const widthPx = Math.max(16, Math.min(availableWidth, startWidthPx + (event.clientX - startX)));
          const heightPx = Math.max(16, Math.min(availableHeight, startHeightPx + (event.clientY - startY)));
          field.width = Math.max(1, Math.min(100, (widthPx / rect.width) * 100));
          field.height = heightPx;
        }
        applyOverlayFieldStyles(element, field);
      };

      const finish = (event: PointerEvent): void => {
        if (activePointerId === null || event.pointerId !== activePointerId) return;
        if (element.hasPointerCapture?.(activePointerId)) element.releasePointerCapture(activePointerId);
        activePointerId = null;
        mode = null;
        element.classList.remove('is-manipulating');
        element.ownerDocument.removeEventListener('pointermove', onMove);
        element.ownerDocument.removeEventListener('pointerup', finish);
        element.ownerDocument.removeEventListener('pointercancel', finish);
        void this.saveSettings().then(() => this.refreshViews());
      };

      const begin = (event: PointerEvent, nextMode: 'move' | 'resize'): void => {
        event.preventDefault();
        event.stopPropagation();
        selectBox();
        mode = nextMode;
        activePointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startFieldX = field.x;
        startFieldY = field.y;
        const elementRect = element.getBoundingClientRect();
        startWidthPx = elementRect.width;
        startHeightPx = elementRect.height;
        element.classList.add('is-manipulating');
        element.setPointerCapture?.(event.pointerId);
        element.ownerDocument.addEventListener('pointermove', onMove);
        element.ownerDocument.addEventListener('pointerup', finish);
        element.ownerDocument.addEventListener('pointercancel', finish);
      };

      element.addEventListener('pointerdown', (event) => {
        if (event.target === resizeHandle) return;
        begin(event, 'move');
      });
      resizeHandle.addEventListener('pointerdown', (event) => begin(event, 'resize'));
    });

    const badgeLayout = getBadgeLayout(library, orientation);
    card.querySelectorAll<HTMLElement>('[data-lcl-badge-kind]').forEach((group) => {
      const kind = group.dataset.lclBadgeKind as keyof CustomBadgeLayout | undefined;
      const surface = group.closest<HTMLElement>('.lorebase-card-image');
      if (!kind || !surface) return;
      group.classList.add('lcl-editable-badge');
      group.title = 'Drag to position. The badge snaps to the nearest corner and keeps a responsive percentage offset.';
      group.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const pointerId = event.pointerId;
        const initialRect = group.getBoundingClientRect();
        const grabX = event.clientX - initialRect.left;
        const grabY = event.clientY - initialRect.top;
        group.setPointerCapture?.(pointerId);
        group.classList.add('is-manipulating');
        const move = (moveEvent: PointerEvent): void => {
          if (moveEvent.pointerId !== pointerId) return;
          const surfaceRect = surface.getBoundingClientRect();
          const rect = group.getBoundingClientRect();
          const left = Math.max(surfaceRect.left, Math.min(surfaceRect.right - rect.width, moveEvent.clientX - grabX));
          const top = Math.max(surfaceRect.top, Math.min(surfaceRect.bottom - rect.height, moveEvent.clientY - grabY));
          const placement = placementFromElement(surfaceRect, new DOMRect(left, top, rect.width, rect.height));
          badgeLayout[kind] = placement;
          applyBadgePlacement(group, placement);
          group.className = `lorebase-card-badge-group is-${placement.corner}${placement.corner.startsWith('top') ? ' is-top-badge' : ''} lcl-custom-badge-group lcl-editable-badge is-manipulating`;
          group.dataset.lclBadgeKind = kind;
        };
        const finish = (upEvent: PointerEvent): void => {
          if (upEvent.pointerId !== pointerId) return;
          if (group.hasPointerCapture?.(pointerId)) group.releasePointerCapture(pointerId);
          group.classList.remove('is-manipulating');
          group.ownerDocument.removeEventListener('pointermove', move);
          group.ownerDocument.removeEventListener('pointerup', finish);
          group.ownerDocument.removeEventListener('pointercancel', finish);
          void this.saveSettings().then(() => this.refreshViews());
        };
        group.ownerDocument.addEventListener('pointermove', move);
        group.ownerDocument.addEventListener('pointerup', finish);
        group.ownerDocument.addEventListener('pointercancel', finish);
      });
    });
  }

  getCustomPreviewItem(library: LibraryDefinition): LibraryItem | null {
    const folder=normalizePath(library.sourceFolder);const file=(this.app.vault.getMarkdownFiles?.()??[]).find((candidate:TFile)=>!folder||candidate.path===folder||candidate.path.startsWith(`${folder}/`));if(!file)return null;const raw=this.app.metadataCache.getFileCache(file)?.frontmatter??{};const fields:Record<string,unknown>={};for(const [key,value] of Object.entries(raw))if(key!=='position'&&isSimple(value))fields[key]=value;return{file,fields};
  }

  renderCustomSettingsPanel(container: HTMLElement, library: LibraryDefinition): void {
    const rerender = async (): Promise<void> => {
      this.activeMediaSettingsLibraryId = library.id;
      await this.saveSettings();
      this.refreshViews();
      this.injectCustomMediaSettings(this.patchedSettingTab?.containerEl);
    };

    new Setting(container)
      .setName('Library name')
      .setDesc('Rename this custom library. Notes and folders are not renamed.')
      .addText((input: any) => input.setValue(library.name).onChange(async (value: string) => {
        const next = value.trim();
        if (!next) return;
        library.name = next;
        await rerender();
      }));

    const iconSetting = new Setting(container)
      .setName('Icon')
      .setDesc('Lucide icon used in the Lorebase library switcher.');
    iconSetting.controlEl?.appendChild(this.iconSelector(library.icon, async (value) => {
      library.icon = value;
      await rerender();
    }));

    new Setting(container)
      .setName('Folder')
      .setDesc('Folder containing Markdown notes for this library.')
      .addText((input: any) => input.setValue(library.sourceFolder).setPlaceholder('Media/Music').onChange(async (value: string) => {
        library.sourceFolder = normalizePath(value);
        await this.saveSettings();
        this.refreshViews();
      }));

    this.sliderSetting(
      container, 'Columns', 'Maximum columns used by the adaptive card grid.',
      library.columns, 1, 8, 1,
      async (value) => { library.columns = value; await this.saveSettings(); this.refreshViews(); }
    );

    new Setting(container)
      .setName('File Name')
      .setDesc('Template built from Entry properties, for example %Artist - %Title.')
      .addText((input: any) => input.setValue(library.fileNameTemplate).setPlaceholder('%Artist - %Title').onChange(async (value: string) => {
        library.fileNameTemplate = value;
        await this.saveSettings();
      }));

    new Setting(container)
      .setName('Cover property')
      .setDesc('Entry property containing a local image path, wiki link, Markdown image, or URL.')
      .addText((input: any) => input.setValue(library.coverProperty).onChange(async (value: string) => {
        library.coverProperty = value.trim();
        await this.saveSettings();
        this.refreshViews();
      }));

    this.renderEntryPropertiesEditor(container, library);

    const propertyScopeSetting = new Setting(container)
      .setName('Property suggestions')
      .setDesc('Where View & filters discovers additional YAML properties.');
    propertyScopeSetting.controlEl?.appendChild(inlineLorebaseSelect(
      [{ value: 'folder', label: 'This library folder' }, { value: 'vault', label: 'Whole vault' }],
      library.propertyScope,
      async (value) => {
        library.propertyScope = value === 'vault' ? 'vault' : 'folder';
        await this.saveSettings();
        this.refreshViews();
      }
    ));

    const orientationSetting = new Setting(container).setName('Orientation');
    orientationSetting.controlEl?.appendChild(inlineLorebaseSelect(
      [{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }],
      library.orientation,
      async (value) => {
        library.orientation = value === 'horizontal' ? 'horizontal' : 'vertical';
        await this.saveSettings();
        this.refreshViews();
      }
    ));

    const cardSizeSetting = new Setting(container).setName('Card size');
    cardSizeSetting.controlEl?.appendChild(inlineLorebaseSelect(
      [{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }],
      library.cardSize,
      async (value) => {
        library.cardSize = value === 'small' || value === 'large' ? value : 'medium';
        await this.saveSettings();
        this.refreshViews();
      }
    ));

    new Setting(container)
      .setName('Custom card size')
      .setDesc('Use custom width/height/ratio instead of preset card sizes')
      .addToggle((toggle: any) => toggle.setValue(library.customCardSize).onChange(async (value: boolean) => {
        library.customCardSize = value;
        await rerender();
      }));

    if (library.customCardSize) {
      this.sliderSetting(
        container, 'Card width target', 'Cards keep this width inside each column when there is enough space',
        library.customCardMinWidth, 100, 480, 5,
        async (value) => { library.customCardMinWidth = value; await this.saveSettings(); this.refreshViews(); },
        'px'
      );
      this.sliderSetting(
        container, 'Card minimum height', 'Minimum poster block height for vertical cards',
        library.customCardMinHeight, 100, 900, 5,
        async (value) => { library.customCardMinHeight = value; await this.saveSettings(); this.refreshViews(); },
        'px'
      );
      this.sliderSetting(
        container, 'Poster ratio (W/H)', '0.67 = classic poster 2:3, 1.0 = square',
        library.customCardImageRatio, 0.4, 2.2, 0.01,
        async (value) => { library.customCardImageRatio = value; await this.saveSettings(); this.refreshViews(); }
      );
      this.sliderSetting(
        container, 'Horizontal width target', 'Minimum width for horizontal cards',
        library.customHorizontalCardMinWidth, 100, 700, 5,
        async (value) => { library.customHorizontalCardMinWidth = value; await this.saveSettings(); this.refreshViews(); },
        'px'
      );
      this.sliderSetting(
        container, 'Horizontal card height', 'Fixed height for horizontal cards',
        library.customHorizontalCardHeight, 100, 520, 5,
        async (value) => { library.customHorizontalCardHeight = value; await this.saveSettings(); this.refreshViews(); },
        'px'
      );

      new Setting(container)
        .setName('Reset custom card values')
        .setDesc('Restore the same custom-size defaults used by Lorebase built-in libraries.')
        .addButton((button: any) => button.setButtonText('Restore defaults').onClick(async () => {
          library.customCardMinWidth = 220;
          library.customCardMinHeight = 380;
          library.customCardImageRatio = 0.72;
          library.customHorizontalCardMinWidth = 340;
          library.customHorizontalCardHeight = 220;
          await rerender();
        }));
    }

    new Setting(container)
      .setName('Horizontal side cover')
      .setDesc('Custom libraries only. Show the cover as a side image in Horizontal view.')
      .addToggle((toggle: any) => toggle.setValue(library.horizontalSideCover).onChange(async (value: boolean) => {
        library.horizontalSideCover = value;
        await rerender();
      }));

    if (library.horizontalSideCover) {
      const imageSideSetting = new Setting(container)
        .setName('Horizontal image side')
        .setDesc('Choose whether the side cover is shown on the left or right.');
      imageSideSetting.controlEl?.appendChild(inlineLorebaseSelect(
        [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }],
        library.horizontalImageSide,
        async (value) => {
          library.horizontalImageSide = value === 'left' ? 'left' : 'right';
          await this.saveSettings();
          this.refreshViews();
          this.injectCustomMediaSettings(this.patchedSettingTab?.containerEl);
        }
      ));

      this.sliderSetting(
        container, 'Horizontal image width', 'Percentage of the horizontal card reserved for the side cover.',
        library.horizontalImageWidth, 10, 80, 1,
        async (value) => { library.horizontalImageWidth = value; await this.saveSettings(); this.refreshViews(); },
        '%'
      );
    }

    new Setting(container)
      .setName('Delete custom library')
      .setDesc('Deletes only the library definition. Markdown notes and images are never deleted.')
      .addButton((button: any) => button.setButtonText('Delete').setWarning?.().onClick(() =>
        new ConfirmLibraryDeleteModal(this.app, library.name, async () => {
          this.settings.libraries = this.settings.libraries.filter((item) => item.id !== library.id);
          if (this.activeMediaSettingsLibraryId === library.id) this.activeMediaSettingsLibraryId = '';
          if (this.activeCustomizationLibraryId === library.id) this.activeCustomizationLibraryId = '';
          await this.saveSettings();
          this.refreshViews();
          this.injectSettingsExtensions(this.patchedSettingTab?.containerEl);
        }).open()
      ));
  }

  renderEntryPropertiesEditor(container: HTMLElement, library: LibraryDefinition): void {
    const setting = new Setting(container)
      .setName('Entry properties')
      .setDesc('Fields shown when creating an entry. Drag the grip to change their order.');
    setting.settingEl.addClass('lcl-entry-properties-setting');
    const editor = document.createElement('div');
    editor.className = 'lcl-entry-properties-editor';
    setting.settingEl.insertAdjacentElement('afterend', editor);
    this.renderEntryFieldRows(editor, library.entryFields, async () => {
      await this.saveSettings();
      this.refreshViews();
    }, library);
  }

  renderEntryFieldRows(editor: HTMLElement, fields: EntryFieldConfig[], onChanged: () => void | Promise<void>, library?: LibraryDefinition): void {
    const typeOptions = [
      { value: 'auto', label: 'Automatic' },
      { value: 'boolean', label: 'Checkbox' },
      { value: 'date', label: 'Date' },
      { value: 'datetime', label: 'Date & time' },
      { value: 'list', label: 'List' },
      { value: 'number', label: 'Number' },
      { value: 'text', label: 'Text' },
    ] as const;
    const persist = (): void => { void Promise.resolve(onChanged()); };

    const render = (): void => {
      editor.innerHTML = '';
      for (const [index, field] of fields.entries()) {
        const row = document.createElement('div');
        row.className = 'lcl-entry-property-row';
        row.dataset.index = String(index);

        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'lcl-drag-handle';
        handle.title = 'Drag to reorder';
        handle.tabIndex = -1;
        handle.draggable = true;
        setIcon(handle, 'grip-vertical');
        row.appendChild(handle);

        const name = document.createElement('input');
        name.type = 'text';
        name.placeholder = 'Property_name';
        name.value = field.property;
        name.onchange = () => {
          const value = name.value.trim();
          const previous = field.property;
          if (!value || !isValidEntryPropertyName(value)) {
            new Notice('Property names may use letters, numbers, - and _ only');
            name.value = field.property;
            return;
          }
          if (library && isFeatureOwnedEntryProperty(library, previous) && value !== previous) {
            new Notice(`Disable the ${previous} card feature before renaming this property`);
            name.value = previous;
            return;
          }
          if (fields.some((entry, i) => i !== index && entry.property === value)) {
            new Notice('That property already exists');
            name.value = field.property;
            return;
          }
          field.property = value;
          if (library) renameLibraryPropertyReferences(library, previous, value);
          persist();
        };
        row.appendChild(name);

        const type = inlineLorebaseSelect(
          typeOptions.map((option) => ({ value: option.value, label: option.label })),
          field.type,
          (value) => { field.type = normalizeEntryFieldType(value); persist(); },
          'Type',
          'lcl-entry-type-select'
        );
        row.appendChild(type);

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'lorebase-view-icon-button';
        const protectedFeature = library ? isFeatureOwnedEntryProperty(library, field.property) : false;
        const protectedFileName = library ? parseFileNameVariables(library.fileNameTemplate).includes(field.property) : false;
        del.title = protectedFeature
          ? `Disable the ${field.property} card feature before removing this property`
          : protectedFileName
            ? 'Remove this property from File Name before deleting it'
            : 'Remove property';
        del.disabled = protectedFeature || protectedFileName;
        setIcon(del, 'trash-2');
        del.onclick = () => {
          if (protectedFeature || protectedFileName) return;
          fields.splice(index, 1);
          persist();
          render();
        };
        row.appendChild(del);

        handle.addEventListener('dragstart', (event) => {
          event.dataTransfer?.setData('text/plain', String(index));
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
          row.classList.add('is-dragging');
        });
        handle.addEventListener('dragend', () => row.classList.remove('is-dragging'));
        row.addEventListener('dragover', (event) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
          row.classList.add('is-drop-target');
        });
        row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
        row.addEventListener('drop', (event) => {
          event.preventDefault();
          row.classList.remove('is-drop-target');
          const from = Number(event.dataTransfer?.getData('text/plain'));
          const to = index;
          if (!Number.isInteger(from) || from < 0 || from >= fields.length || from === to) return;
          const [moved] = fields.splice(from, 1);
          fields.splice(to, 0, moved);
          persist();
          render();
        });

        editor.appendChild(row);
      }

      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'lorebase-view-small-button lcl-settings-add-button';
      add.textContent = '+ Add property';
      add.onclick = () => {
        fields.push({ property: `Property_${fields.length + 1}`, type: 'auto' });
        persist();
        render();
      };
      editor.appendChild(add);
    };
    render();
  }

  iconSelector(value: string, onChange: (value: string) => void | Promise<void>): HTMLElement {
    const icons = ['library','music','headphones','disc-3','radio','podcast','mic-2','book-open','book-open-text','film','tv','clapperboard','gamepad-2','image','camera','palette','flask-conical','beaker','atom','brain','database','folder','archive','briefcase','user','users','contact','heart','star','bookmark','tag','package','shopping-bag','utensils','cooking-pot','dumbbell','plane','map','car','wrench','hammer','code-2'];
    if (value && !icons.includes(value)) icons.unshift(value);
    const wrap = document.createElement('div');
    wrap.className = 'lcl-icon-selector';
    const preview = document.createElement('span');
    preview.className = 'lcl-icon-preview';
    setIcon(preview, value || 'library');
    wrap.appendChild(preview);
    const select = inlineLorebaseSelect(
      icons.map((icon) => ({ value: icon, label: icon, icon })),
      value || 'library',
      async (next) => {
        preview.innerHTML = '';
        setIcon(preview, next || 'library');
        await Promise.resolve(onChange(next));
      },
      'Icon',
      'lcl-icon-native-select'
    );
    wrap.appendChild(select);
    return wrap;
  }

  sliderSetting(
    container: HTMLElement,
    name: string,
    description: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => Promise<void>,
    suffix = ''
  ): void {
    const setting = new Setting(container).setName(name).setDesc(description);
    const valueEl = document.createElement('span');
    valueEl.className = 'lcl-slider-value';
    valueEl.textContent = `${value}${suffix}`;
    setting.controlEl?.appendChild(valueEl);
    setting.addSlider((slider: any) => slider
      .setLimits(min, max, step)
      .setValue(value)
      .setDynamicTooltip?.()
      .onChange(async (next: number) => {
        const normalized = step < 1 ? Math.round(next * 100) / 100 : Math.round(next);
        valueEl.textContent = `${normalized}${suffix}`;
        await onChange(normalized);
      }));
  }


  syncHostViews(): void {
    if (this.destroyed) return;
    const leaves = this.app.workspace?.getLeavesOfType?.(HOST_VIEW_TYPE) ?? [];
    const live = new Set<any>();
    for (const leaf of leaves) {
      const view = leaf?.view;
      if (!view) continue;
      live.add(view);
      if (!this.bridges.has(view)) this.bridges.set(view, new IntegratedLibraryBridge(this, view));
      this.bridges.get(view)?.sync();
    }
    for (const [view, bridge] of [...this.bridges.entries()]) {
      if (!live.has(view)) { bridge.destroy(); this.bridges.delete(view); }
    }
  }

  async activateCustomLibrary(libraryId?: string): Promise<void> {
    const library = this.settings.libraries.find((item) => item.id === libraryId) ?? this.settings.libraries[0];
    if (!library) {
      new Notice('Create a custom library from Settings → Lorebase → Media.');
      this.openLibrarySettings('');
      return;
    }
    const currentType = this.host.getMediaType?.() ?? 'game';
    if (this.host.switchMediaType) await this.host.switchMediaType(currentType);
    for (let i = 0; i < 12; i++) {
      this.syncHostViews();
      const bridge = [...this.bridges.values()][0];
      if (bridge) { await bridge.selectCustomLibrary(library.id); return; }
      await new Promise((resolve) => globalThis.setTimeout(resolve, 40));
    }
    new Notice('Open Lorebase first, then select the custom library from the media switcher.');
  }

  async activateView(): Promise<void> { await this.activateCustomLibrary(); }

  refreshViews(): void {
    this.syncHostViews();
    for (const bridge of this.bridges.values()) bridge.refresh();
  }
}

export async function installCustomLibraries(host: LorebaseHostPlugin): Promise<CustomLibrariesController> {
  const existing = (host as any)[CONTROLLER_SYMBOL] as CustomLibrariesController | undefined;
  if (existing) return existing;

  const controller = new CustomLibrariesController(host);
  (host as any)[CONTROLLER_SYMBOL] = controller;

  // 0.8.1 manages custom libraries through Lorebase Settings and the integrated library switcher.

  await controller.saveSettings();
  controller.start();
  return controller;
}

function normalizeFilterMode(value: unknown): FilterMode {
  return value === 'or' || value === 'none' ? value : 'and';
}
function normalizeSorts(raw: any): SortSpec[] {
  return Array.isArray(raw)
    ? raw.filter((spec) => spec && typeof spec.property === 'string' && spec.property.trim())
      .map((spec) => ({ property: spec.property.trim(), direction: spec.direction === 'desc' ? 'desc' as const : 'asc' as const }))
    : [];
}
function normalizeFilterRule(raw: any): FilterRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const propertyRaw = typeof raw.property === 'string' ? raw.property : typeof raw.field === 'string' ? raw.field : '';
  let property = propertyRaw.trim();
  if (property.startsWith('yaml:')) {
    const payload = property.slice(5);
    const separator = payload.indexOf(':');
    const prefix = separator > 0 ? payload.slice(0, separator) : '';
    property = ['text','multiline','number','date','boolean','list'].includes(prefix) ? payload.slice(separator + 1) : payload;
  }
  const allowed: FilterOperator[] = ['contains','equals','notEquals','greater','less','between','empty','notEmpty','isTrue','isFalse','containsAny','containsAll','notContains','thisMonth','thisYear'];
  const operator = allowed.includes(raw.operator as FilterOperator) ? raw.operator as FilterOperator : 'contains';
  if (!property) return null;
  const fieldType = ['text','multiline','number','date','boolean','list'].includes(raw.fieldType) ? raw.fieldType as PropertyKind : undefined;
  return {
    kind: 'rule',
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid('filter'),
    property,
    fieldType,
    operator,
    value: Array.isArray(raw.value) ? raw.value.map(String) : raw.value,
    valueTo: raw.valueTo,
  };
}
function normalizeFilters(raw: any): FilterRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeFilterRule).filter(Boolean) as FilterRule[];
}
function normalizeFilterGroup(raw: any, legacyFilters: any = [], legacyMode: unknown = 'and'): FilterGroup {
  if (raw && typeof raw === 'object' && raw.kind === 'group' && Array.isArray(raw.children)) {
    const children: FilterNode[] = [];
    for (const child of raw.children) {
      if (child?.kind === 'group') children.push(normalizeFilterGroup(child));
      else {
        const rule = normalizeFilterRule(child);
        if (rule) children.push(rule);
      }
    }
    return {
      kind: 'group',
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid('filter-group'),
      mode: normalizeFilterMode(raw.mode),
      children,
    };
  }
  return {
    kind: 'group',
    id: uid('filter-group'),
    mode: normalizeFilterMode(legacyMode),
    children: normalizeFilters(legacyFilters),
  };
}
function preferredLegacyFileNameTemplate(raw: any, entryFields: EntryFieldConfig[]): string {
  if (typeof raw.fileNameTemplate === 'string' && raw.fileNameTemplate.trim()) return raw.fileNameTemplate.trim();
  const oldTitle = typeof raw.titleProperty === 'string' ? raw.titleProperty.trim() : '';
  if (oldTitle && !oldTitle.startsWith('$') && isValidEntryPropertyName(oldTitle)) return `%${oldTitle}`;
  const preferred = entryFields.find((field) => ['Title','title','Name','name'].includes(field.property)) ?? entryFields[0];
  return preferred ? `%${preferred.property}` : '';
}
function normalizeSavedViews(raw: any): SavedView[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((view: any) => ({
    id: typeof view?.id === 'string' && view.id ? view.id : uid('view'),
    name: typeof view?.name === 'string' && view.name.trim() ? view.name.trim() : 'View',
    sorts: normalizeSorts(view?.sorts),
    filterMode: normalizeFilterMode(view?.filterMode ?? view?.filterGroup?.mode),
    filters: normalizeFilters(view?.filters),
    filterGroup: normalizeFilterGroup(view?.filterGroup, view?.filters, view?.filterMode),
    groupProperty: typeof view?.groupProperty === 'string' ? view.groupProperty : '',
    groupDirection: view?.groupDirection === 'desc' ? 'desc' : 'asc',
  }));
}
function normalizeLibrary(raw: any): LibraryDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uid('library');
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Untitled library';
  const entryFields = normalizeEntryFields(raw.entryFields);
  const filterMode = normalizeFilterMode(raw.filterMode ?? raw.filterGroup?.mode);
  const filters = normalizeFilters(raw.filters);
  const filterGroup = normalizeFilterGroup(raw.filterGroup, filters, filterMode);
  const legacyOverlay = normalizeOverlayFields(raw.overlayFields, raw.cardProperties);
  const verticalOverlay = normalizeOverlayFields(raw.overlayLayouts?.vertical, raw.overlayFields ?? raw.cardProperties);
  const horizontalOverlay = normalizeOverlayFields(raw.overlayLayouts?.horizontal, raw.overlayFields ?? raw.cardProperties);
  const overlayLayouts = {
    vertical: verticalOverlay.length ? verticalOverlay : cloneOverlayFields(legacyOverlay),
    horizontal: horizontalOverlay.length ? horizontalOverlay : cloneOverlayFields(legacyOverlay),
  };
  const badgeLayouts = {
    vertical: normalizeBadgeLayout(raw.badgeLayouts?.vertical),
    horizontal: normalizeBadgeLayout(raw.badgeLayouts?.horizontal),
  };
  return {
    id,
    name,
    icon: typeof raw.icon === 'string' && raw.icon ? raw.icon : 'library',
    sourceFolder: normalizePath(typeof raw.sourceFolder === 'string' ? raw.sourceFolder : ''),
    propertyScope: raw.propertyScope === 'vault' ? 'vault' : 'folder',
    fileNameTemplate: preferredLegacyFileNameTemplate(raw, entryFields),
    coverProperty: typeof raw.coverProperty === 'string' ? raw.coverProperty.trim() : '',
    columns: Math.max(1, Math.min(8, Number.isFinite(Number(raw.columns)) ? Math.round(Number(raw.columns)) : 5)),
    orientation: raw.orientation === 'horizontal' ? 'horizontal' : 'vertical',
    cardSize: raw.cardSize === 'small' || raw.cardSize === 'large' ? raw.cardSize : 'medium',
    customCardSize: Boolean(raw.customCardSize),
    customCardMinWidth: Math.max(100, Math.min(480, Number.isFinite(Number(raw.customCardMinWidth)) ? Number(raw.customCardMinWidth) : 220)),
    customCardMinHeight: Math.max(100, Math.min(900, Number.isFinite(Number(raw.customCardMinHeight)) ? Number(raw.customCardMinHeight) : 380)),
    customCardImageRatio: Math.max(0.4, Math.min(2.2, Number.isFinite(Number(raw.customCardImageRatio)) ? Number(raw.customCardImageRatio) : 0.72)),
    customHorizontalCardMinWidth: Math.max(100, Math.min(700, Number.isFinite(Number(raw.customHorizontalCardMinWidth)) ? Number(raw.customHorizontalCardMinWidth) : 340)),
    customHorizontalCardHeight: Math.max(100, Math.min(520, Number.isFinite(Number(raw.customHorizontalCardHeight)) ? Number(raw.customHorizontalCardHeight) : 220)),
    horizontalSideCover: Boolean(raw.horizontalSideCover),
    horizontalImageSide: raw.horizontalImageSide === 'left' ? 'left' : 'right',
    horizontalImageWidth: Math.max(10, Math.min(80, Number.isFinite(Number(raw.horizontalImageWidth)) ? Number(raw.horizontalImageWidth) : 34)),
    favoriteEnabled: Boolean(raw.favoriteEnabled),
    favoriteSubtlePulse: Boolean(raw.favoriteSubtlePulse),
    ratingEnabled: Boolean(raw.ratingEnabled),
    ratingStyle: normalizeRatingStyle(raw.ratingStyle),
    completionDateEnabled: Boolean(raw.completionDateEnabled),
    completionDateProperty: typeof raw.completionDateProperty === 'string' && raw.completionDateProperty.trim() ? raw.completionDateProperty.trim() : 'finished',
    completionDateFormat: normalizeCompletionDateFormat(raw.completionDateFormat),
    overlayFields: cloneOverlayFields(overlayLayouts.vertical),
    overlayLayouts,
    badgeLayouts,
    statusAsIconOnly: Boolean(raw.statusAsIconOnly),
    entryFields,
    sorts: normalizeSorts(raw.sorts),
    filterMode,
    filters,
    filterGroup,
    groupProperty: typeof raw.groupProperty === 'string' ? raw.groupProperty : '',
    groupDirection: raw.groupDirection === 'desc' ? 'desc' : 'asc',
    savedViews: normalizeSavedViews(raw.savedViews),
    activeSavedViewId: typeof raw.activeSavedViewId === 'string' ? raw.activeSavedViewId : '',
  };
}
function defaultUnifiedViewState(): UnifiedViewState {
  return { sorts: [], filterGroup: emptyFilterGroup('and'), groupProperty: '', groupDirection: 'asc', savedViews: [], activeSavedViewId: '' };
}
function normalizeUnifiedViewState(raw: any): UnifiedViewState {
  if (!raw || typeof raw !== 'object') return defaultUnifiedViewState();
  return {
    sorts: normalizeSorts(raw.sorts),
    filterGroup: normalizeFilterGroup(raw.filterGroup, raw.filters, raw.filterMode),
    groupProperty: typeof raw.groupProperty === 'string' ? raw.groupProperty : '',
    groupDirection: raw.groupDirection === 'desc' ? 'desc' : 'asc',
    savedViews: normalizeSavedViews(raw.savedViews),
    activeSavedViewId: typeof raw.activeSavedViewId === 'string' ? raw.activeSavedViewId : '',
  };
}


async function openFileReusingExistingLeaf(app: any, file: TFile): Promise<void> {
  const leaves = app.workspace?.getLeavesOfType?.('markdown') ?? [];
  const existing = leaves.find((leaf: any) => leaf?.view?.file?.path === file.path);
  if (existing) {
    app.workspace?.setActiveLeaf?.(existing, { focus: true });
    app.workspace?.revealLeaf?.(existing);
    return;
  }
  const leaf = app.workspace?.getLeaf?.(true);
  if (leaf?.openFile) await leaf.openFile(file);
}

class IntegratedLibraryBridge {
  controller: CustomLibrariesController;
  hostView: any;
  root: HTMLElement;
  observer: MutationObserver | null = null;
  shell: HTMLElement | null = null;
  activeLibraryId = '';
  search = '';
  mediaTrayOpen = false;
  currentItems: LibraryItem[] = [];
  availableProperties: string[] = [...SPECIAL_PROPERTIES];
  syncTimer: number | null = null;
  syncQueued = false;
  syncing = false;
  renderGeneration = 0;
  viewPanelOpen = false;
  originalBuiltinRunFiltersAndSort: ((scrollMode: any, scrollTop?: number | null) => void) | null = null;
  originalBuiltinRenderGroupedView: ((scrollMode: any, anchor: any, version: number) => void) | null = null;
  originalOpenGame: ((item: any) => Promise<void>) | null = null;
  builtinLayoutCalculator: any = null;
  originalBuiltinGetEffectiveLayout: ((settings: any, viewMode: any) => any) | null = null;
  originalBuiltinGetRenderedColumns: ((layout: any) => number) | null = null;
  outsideClickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(controller: CustomLibrariesController, hostView: any) {
    this.controller = controller;
    this.hostView = hostView;
    this.root = (hostView.contentEl ?? hostView.containerEl?.children?.[1] ?? hostView.containerEl) as HTMLElement;
    if (this.root && typeof MutationObserver !== 'undefined') {
      this.observer = new MutationObserver(() => this.scheduleSync());
      this.observer.observe(this.root, { childList: true, subtree: true });
    }
    this.patchBuiltinEngine();
    this.installOutsideClickHandling();
    this.sync();
  }

  get app(): any { return this.controller.app; }
  get activeLibrary(): LibraryDefinition | null {
    return this.controller.settings.libraries.find((library) => library.id === this.activeLibraryId) ?? null;
  }


  cleanupLegacyViews(): void {
    const leaves = this.app.workspace?.getLeavesOfType?.(LEGACY_VIEW_TYPE) ?? [];
    for (const leaf of leaves) {
      try { leaf?.detach?.(); } catch (error) { console.warn('[Lorebase Custom Libraries] could not detach legacy custom-library tab', error); }
    }
  }

  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.syncTimer !== null) window.clearTimeout(this.syncTimer);
    if (this.originalBuiltinRunFiltersAndSort) this.hostView.runFiltersAndSort = this.originalBuiltinRunFiltersAndSort;
    if (this.originalBuiltinRenderGroupedView) this.hostView.renderGroupedView = this.originalBuiltinRenderGroupedView;
    if (this.originalOpenGame) this.hostView.openGame = this.originalOpenGame;
    if (this.builtinLayoutCalculator && this.originalBuiltinGetEffectiveLayout) this.builtinLayoutCalculator.getEffectiveLayout = this.originalBuiltinGetEffectiveLayout;
    if (this.builtinLayoutCalculator && this.originalBuiltinGetRenderedColumns) this.builtinLayoutCalculator.getRenderedColumns = this.originalBuiltinGetRenderedColumns;
    if (this.outsideClickHandler) document.removeEventListener('click', this.outsideClickHandler);
    this.outsideClickHandler = null;
    this.restoreBuiltinDom();
  }

  scheduleSync(): void {
    if (this.syncQueued) return;
    this.syncQueued = true;
    queueMicrotask(() => {
      this.syncQueued = false;
      this.sync();
    });
  }

  sync(): void {
    if (this.syncing || !this.root?.isConnected) return;
    this.syncing = true;
    try {
      if (this.activeLibrary) {
        this.ensureCustomShell();
      } else {
        if (this.activeLibraryId) { this.activeLibraryId = ''; this.restoreBuiltinDom(); }
        this.augmentBuiltinUi();
      }
    } finally {
      this.syncing = false;
    }
  }

  refresh(): void {
    if (this.activeLibrary) void this.renderCustom();
    else {
      if (this.activeLibraryId) { this.activeLibraryId = ''; this.restoreBuiltinDom(); }
      this.augmentBuiltinUi();
    }
  }

  async selectCustomLibrary(libraryId: string, keepTrayOpen = false): Promise<void> {
    if (!this.controller.settings.libraries.some((library) => library.id === libraryId)) return;
    this.activeLibraryId = libraryId;
    this.search = '';
    this.mediaTrayOpen = keepTrayOpen;
    await this.renderCustom();
  }

  prepareBuiltinMedia(_mediaType: HostMediaType): void {
    this.activeLibraryId = '';
    this.search = '';
    this.mediaTrayOpen = false;
    this.viewPanelOpen = false;
    this.restoreBuiltinDom();
  }

  async selectBuiltinMedia(mediaType: HostMediaType): Promise<void> {
    this.prepareBuiltinMedia(mediaType);
    if (this.controller.host.switchMediaType) await this.controller.host.switchMediaType(mediaType);
    window.setTimeout(() => { this.controller.syncHostViews(); this.augmentBuiltinUi(); }, 0);
  }

  getBuiltinMediaType(): HostMediaType {
    const raw = this.hostView?.mediaType ?? this.controller.host.getMediaType?.() ?? 'game';
    return raw in BUILTIN_MEDIA ? raw as HostMediaType : 'game';
  }

  patchBuiltinEngine(): void {
    if (typeof this.hostView?.runFiltersAndSort === 'function' && !this.originalBuiltinRunFiltersAndSort) {
      this.originalBuiltinRunFiltersAndSort = this.hostView.runFiltersAndSort.bind(this.hostView);
      this.hostView.runFiltersAndSort = (scrollMode: any, scrollTop: number | null = null): void => {
        if (this.activeLibrary) { this.originalBuiltinRunFiltersAndSort?.(scrollMode, scrollTop); return; }
        this.runBuiltinEnhancedFilters(scrollMode, scrollTop);
      };
    }
    if (typeof this.hostView?.renderGroupedView === 'function' && !this.originalBuiltinRenderGroupedView) {
      this.originalBuiltinRenderGroupedView = this.hostView.renderGroupedView.bind(this.hostView);
      this.hostView.renderGroupedView = (scrollMode: any, anchor: any, version: number): void => {
        const state = this.controller.getBuiltinViewState(this.getBuiltinMediaType(), this.hostView);
        if (!state.groupProperty || state.groupProperty.startsWith('@')) {
          this.originalBuiltinRenderGroupedView?.(scrollMode, anchor, version);
          return;
        }
        this.renderBuiltinPropertyGroups(state, scrollMode, anchor, version);
      };
    }
    if (typeof this.hostView?.openGame === 'function' && !this.originalOpenGame) {
      this.originalOpenGame = this.hostView.openGame.bind(this.hostView);
      this.hostView.openGame = async (item: any): Promise<void> => {
        const path = String(item?.filePath ?? '');
        const file = path ? this.app.vault.getAbstractFileByPath?.(path) : null;
        if (file instanceof TFile) {
          await openFileReusingExistingLeaf(this.app, file);
          return;
        }
        await this.originalOpenGame?.(item);
      };
    }
    const calculator = this.hostView?.layoutCalculator;
    if (calculator && typeof calculator.getEffectiveLayout === 'function' && !this.originalBuiltinGetEffectiveLayout) {
      this.builtinLayoutCalculator = calculator;
      this.originalBuiltinGetEffectiveLayout = calculator.getEffectiveLayout.bind(calculator);
      calculator.getEffectiveLayout = (settings: any, viewMode: any): any => {
        const layout = this.originalBuiltinGetEffectiveLayout?.(settings, viewMode);
        if (!layout || !settings?.customCardSize || !layout.dimensions) return layout;
        const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
          const n=Number(value); return Number.isFinite(n) ? Math.max(min,Math.min(max,n)) : fallback;
        };
        layout.dimensions.verticalMinWidth=clamp(settings.customCardMinWidth,100,480,layout.dimensions.verticalMinWidth);
        layout.dimensions.verticalMinHeight=clamp(settings.customCardMinHeight,100,900,layout.dimensions.verticalMinHeight);
        layout.dimensions.verticalImageRatio=clamp(settings.customCardImageRatio,0.4,2.2,layout.dimensions.verticalImageRatio);
        layout.dimensions.horizontalMinWidth=clamp(settings.customHorizontalCardMinWidth,100,700,layout.dimensions.horizontalMinWidth);
        layout.dimensions.horizontalHeight=clamp(settings.customHorizontalCardHeight,100,520,layout.dimensions.horizontalHeight);
        layout.minCardWidth=layout.orientation==='horizontal'?layout.dimensions.horizontalMinWidth:layout.dimensions.verticalMinWidth;
        return layout;
      };
      if (typeof calculator.getRenderedColumns === 'function' && !this.originalBuiltinGetRenderedColumns) {
        this.originalBuiltinGetRenderedColumns = calculator.getRenderedColumns.bind(calculator);
        calculator.getRenderedColumns = (layout: any): number => {
          if (!layout?.dimensions) return this.originalBuiltinGetRenderedColumns?.(layout) ?? Math.max(1, Number(layout?.columns) || 1);
          const available = Math.max(0, this.hostView?.libraryContentEl?.clientWidth ?? this.root?.clientWidth ?? 0);
          const maxColumns = Math.max(1, Math.min(12, Number(layout.columns) || 1));
          const minWidth = Math.max(10, Number(layout.minCardWidth) || 10);
          if (!available) return maxColumns;
          const inner = Math.max(0, available - 32);
          const byWidth = Math.max(1, Math.floor((inner + 16) / (minWidth + 16)));
          return Math.max(1, Math.min(maxColumns, byWidth));
        };
      }
    }
  }

  installOutsideClickHandling(): void {
    if (this.outsideClickHandler) return;
    this.outsideClickHandler = (event: MouseEvent): void => {
      if (!this.shell?.isConnected) return;
      const path = event.composedPath();
      // The media tray is intentionally persistent like Lorebase's native library switcher.
      if (path.some((node) => node instanceof HTMLElement && (node.classList.contains('lorebase-media-tray') || node.classList.contains('lorebase-media-trigger')))) return;
      const clickedDropdown = path.some((node) => node instanceof HTMLElement && (node.classList.contains('lorebase-dropdown-wrap') || node.classList.contains('lorebase-settings-dropdown-panel')));
      if (clickedDropdown) return;
      let changed = false;
      if (this.viewPanelOpen) { this.viewPanelOpen = false; changed = true; }
      this.shell.querySelectorAll<HTMLElement>('.lorebase-dropdown.is-open').forEach((panel) => { panel.classList.remove('is-open'); changed = true; });
      this.shell.querySelectorAll<HTMLElement>('.lorebase-toolbar-btn.is-open').forEach((button) => { button.classList.remove('is-open'); button.setAttribute('aria-expanded','false'); });
      if (changed && this.activeLibrary) void this.renderCustom();
    };
    document.addEventListener('click', this.outsideClickHandler);
  }

  hostPropertyValue(item: any, property: string): unknown {
    const filePath = String(item?.filePath ?? '');
    if (property === '$file.path') return filePath;
    if (property === '$file.name') return filePath.split('/').pop()?.replace(/\.md$/i, '') ?? item?.displayName ?? '';
    if (property === '$file.ctime' || property === '$file.mtime' || property === '$file.size') {
      const file = this.app.vault.getAbstractFileByPath?.(filePath);
      if (property === '$file.ctime') return file?.stat?.ctime ?? null;
      if (property === '$file.mtime') return file?.stat?.mtime ?? null;
      return file?.stat?.size ?? null;
    }
    if (property.startsWith('yaml:')) property = this.controller.nativeFieldToProperty(property);
    switch (property) {
      case 'name': return item?.displayName ?? '';
      case 'series': return item?.gameSeries ?? null;
      case 'year': return item?.year ?? null;
      case 'rating': return item?.userRating ?? item?.rating ?? null;
      case 'status': return item?.status ?? null;
      case 'favorite': return item?.favorite ?? false;
      case 'adult': return item?.isAdult ?? false;
      case 'custom': return item?.hasCustomPoster ?? false;
      case 'tags': return item?.tags ?? [];
      case 'genres': return item?.genres ?? [];
      case 'dateStarted': return item?.started ?? null;
      case 'dateFinished': case 'dateCompleted': return item?.finished ?? item?.dateCompleted ?? null;
      default: return item?.rawFields?.[property] ?? null;
    }
  }

  runBuiltinEnhancedFilters(scrollMode: any, scrollTop: number | null): void {
    const view = this.hostView;
    if (!view || view.isDestroyed) return;
    const mediaType = this.getBuiltinMediaType();
    const state = this.controller.getBuiltinViewState(mediaType, view);
    try {
      const baseFilter = { ...(view.filter ?? {}), rules: [] };
      const settings = view.getActiveSettings?.() ?? {};
      let items: any[] = [];
      if (mediaType === 'anime') items = view.animeService?.filterAndSort?.(view.games ?? [], baseFilter, 'name', 'asc') ?? [];
      else if (mediaType === 'movie') items = view.movieService?.filterAndSort?.(view.games ?? [], baseFilter, 'name', 'asc') ?? [];
      else if (mediaType === 'series') items = view.seriesService?.filterAndSort?.(view.games ?? [], baseFilter, 'name', 'asc') ?? [];
      else if (mediaType === 'book') items = view.bookService?.filterAndSort?.(view.games ?? [], baseFilter, 'name', 'asc') ?? [];
      else if (mediaType === 'manga') items = view.mangaService?.filterAndSort?.(view.games ?? [], baseFilter, 'name', 'asc', settings.showAdultInAll) ?? [];
      else items = view.gameService?.filterAndSort?.(view.games ?? [], baseFilter, 'name', 'asc', settings.showAdultInAll) ?? [];
      items = applyFilterGroup(items, state.filterGroup, (item, property) => this.hostPropertyValue(item, property));
      items = applySortsGeneric(items, state.sorts, (item, property) => this.hostPropertyValue(item, property), (item) => String(item?.filePath ?? ''));
      view.filteredGames = items;
      this.syncNativeGroupingState(state);
      view.updateToolbarTags?.();
      view.render?.({ scrollMode, scrollTop: scrollTop ?? undefined });
      globalThis.setTimeout(() => this.augmentBuiltinUi(), 0);
    } catch (error) {
      console.error('[Lorebase Custom Libraries] enhanced built-in view failed; falling back to Lorebase engine', error);
      this.originalBuiltinRunFiltersAndSort?.(scrollMode, scrollTop);
    }
  }

  syncNativeGroupingState(state: UnifiedViewState): void {
    if (!this.hostView?.viewState?.group) return;
    if (!state.groupProperty) this.hostView.viewState.group.mode = 'none';
    else if (state.groupProperty === '@finishedMonth') this.hostView.viewState.group.mode = 'finishedMonth';
    else if (state.groupProperty === '@finishedYear') this.hostView.viewState.group.mode = 'finishedYear';
    else this.hostView.viewState.group.mode = 'series';
    this.hostView.viewState.group.order = state.groupDirection;
  }

  renderBuiltinPropertyGroups(state: UnifiedViewState, scrollMode: any, anchor: any, version: number): void {
    const view = this.hostView;
    const root = view.libraryContentEl as HTMLElement | null;
    if (!root) return;
    const groups = new Map<string, any[]>();
    for (const item of view.filteredGames ?? []) {
      const raw = this.hostPropertyValue(item, state.groupProperty);
      const keys = Array.isArray(raw) && raw.length ? raw.map(normalizeScalar) : [normalizeScalar(raw) || '(Empty)'];
      for (const key of keys) { if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(item); }
    }
    const ordered = [...groups.entries()].sort((a,b) => {
      const cmp = a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' });
      return state.groupDirection === 'asc' ? cmp : -cmp;
    });
    const tasks: Array<{parent: HTMLElement; item: any}> = [];
    const layout = view.getEffectiveLayout?.() ?? { columns: 5 };
    const columns = view.getRenderedColumns?.(layout) ?? Math.max(1, layout.columns ?? 5);
    ordered.forEach(([label, items], index) => {
      const section = document.createElement('div'); section.className = 'lorebase-series-section lorebase-view-group-section'; root.appendChild(section);
      const title = document.createElement('div'); title.className = 'lorebase-series-title lorebase-view-group-title'; section.appendChild(title);
      const text = document.createElement('span'); text.textContent = label; title.appendChild(text);
      const count = document.createElement('span'); count.className = 'lorebase-view-group-count'; count.textContent = String(items.length); title.appendChild(count);
      const grid = document.createElement('div'); grid.className = 'lorebase-grid'; grid.style.gridTemplateColumns = `repeat(${Math.max(1, columns)}, minmax(0, 1fr))`; section.appendChild(grid);
      for (const item of items) tasks.push({ parent: grid, item });
    });
    if (typeof view.renderCardsInBatches === 'function') {
      view.renderCardsInBatches(tasks, version, () => view.finishContentRebuild?.(version, () => view.scrollManager?.apply?.(scrollMode, anchor)));
    } else {
      for (const task of tasks) view.createCard?.(task.parent, task.item);
      view.finishContentRebuild?.(version, () => view.scrollManager?.apply?.(scrollMode, anchor));
    }
  }

  augmentBuiltinUi(): void {
    this.augmentBuiltinMediaTray();
    this.augmentBuiltinViewPanel();
    this.applyBuiltinFreeCardLayout();
  }

  applyBuiltinFreeCardLayout(): void {
    const mediaType = this.getBuiltinMediaType();
    const orientation: CardOrientation = this.root.classList.contains('lorebase-view-mode-horizontal') ? 'horizontal' : 'vertical';
    const layout = this.controller.settings.builtinCardLayouts[mediaType]?.[orientation];
    this.root.querySelectorAll('.lorebase-card:not(.lcl-card)').forEach((cardElement) => {
      const card = cardElement as HTMLElement;
      const map: Array<[BuiltinOverlayFieldKey,string]> = [
        ['title','.lorebase-card-title'],
        ['year','.lorebase-card-year:not(.lorebase-card-format)'],
        ['format','.lorebase-card-format'],
        ['description','.lorebase-card-description'],
      ];
      for (const [key, selector] of map) {
        const element = (card as HTMLElement).querySelector(selector) as HTMLElement | null;
        if (!element) continue;
        const value = element.textContent ?? '';
        const field = layout?.fields[key];
        if (layout?.active && field) {
          applyBuiltinOverlayFieldStyles(element, field, value);
          continue;
        }
        if (hasStrongRtl(value)) {
          const rawX = element.style.getPropertyValue('--overlay-x') || getComputedStyle(element).getPropertyValue('--overlay-x');
          const x = Number.parseFloat(rawX);
          element.dir = 'rtl';
          element.style.textAlign = 'right';
          if (Number.isFinite(x)) {
            element.style.left = 'auto';
            element.style.right = `${x}%`;
          }
        }
      }
      if (!layout || !layout.active) return;
      const badges: Array<[keyof BuiltinCardLayout['badges'],string]> = [
        ['favorite','.lorebase-card-favorite-badge'],
        ['rating','.lorebase-card-rating'],
        ['status','.lorebase-card-status'],
      ];
      for (const [kind, selector] of badges) {
        const badge = (card as HTMLElement).querySelector(selector) as HTMLElement | null;
        const group = badge?.closest('.lorebase-card-badge-group') as HTMLElement | null;
        if (group) applyBadgePlacement(group, layout.badges[kind]);
      }
    });
  }

  restoreBuiltinDom(): void {
    if (!this.root) return;
    this.shell?.remove();
    this.shell = null;
    for (const child of Array.from(this.root.children)) (child as HTMLElement).classList.remove('lcl-host-hidden');
  }

  ensureCustomShell(): void {
    if (!this.activeLibrary) { this.restoreBuiltinDom(); return; }
    if (!this.shell || !this.shell.isConnected) {
      this.shell = document.createElement('div');
      this.shell.className = 'lcl-integrated-shell';
      this.shell.setAttribute('data-lcl-integrated', 'true');
      this.root.appendChild(this.shell);
    }
    for (const child of Array.from(this.root.children)) {
      if (child !== this.shell) (child as HTMLElement).classList.add('lcl-host-hidden');
    }
  }

  augmentBuiltinMediaTray(): void {
    const tray = this.root.querySelector('.lorebase-media-tray') as HTMLElement | null;
    if (!tray) return;
    const signatures = this.controller.settings.libraries.map((library) => `${library.id}:${library.name}:${library.icon}`);
    const existingSignatures: string[] = [];
    tray.querySelectorAll('[data-lcl-library-id]').forEach((el) => {
      existingSignatures.push((el as HTMLElement).dataset.lclSignature ?? '');
    });
    if (existingSignatures.join('|') === signatures.join('|')) return;
    tray.querySelectorAll('[data-lcl-library-id], .lcl-media-separator').forEach((el) => el.remove());
    const close = tray.querySelector('.lorebase-media-tray-close');
    if (!this.controller.settings.libraries.length) return;
    const sep = document.createElement('span'); sep.className = 'lcl-media-separator';
    tray.insertBefore(sep, close);
    for (const library of this.controller.settings.libraries) {
      const button = this.mediaOptionButton(library.icon || 'library', library.name, false, () => void this.selectCustomLibrary(library.id, true));
      button.dataset.lclLibraryId = library.id;
      button.dataset.lclSignature = `${library.id}:${library.name}:${library.icon}`;
      button.classList.add('lcl-injected-media-option');
      tray.insertBefore(button, close);
    }
  }

  mediaOptionButton(iconId: string, label: string, active: boolean, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `lorebase-media-option ${active ? 'is-active' : ''}`;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(active));
    const icon = document.createElement('span'); icon.className = 'lorebase-media-option-icon'; setIcon(icon, iconId); button.appendChild(icon);
    if (active) { const text = document.createElement('span'); text.className = 'lorebase-media-option-label'; text.textContent = label; button.appendChild(text); }
    button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); action(); };
    return button;
  }

  async scanLibrary(library: LibraryDefinition): Promise<LibraryItem[]> {
    const folder = normalizePath(library.sourceFolder);
    const allFiles: TFile[] = this.app.vault.getMarkdownFiles();
    const files: TFile[] = allFiles.filter((f: TFile) => !folder || f.path === folder || f.path.startsWith(`${folder}/`));
    const propertyFiles = library.propertyScope === 'vault' ? allFiles : files;
    const keys = new Set<string>(SPECIAL_PROPERTIES);
    [library.coverProperty, library.groupProperty, ...parseFileNameVariables(library.fileNameTemplate)].forEach((key) => key && keys.add(key));
    library.sorts.forEach((spec) => spec.property && keys.add(spec.property));
    collectFilterProperties(library.filterGroup).forEach((property) => keys.add(property));
    library.entryFields.forEach((field) => field.property && keys.add(field.property));
    for (const file of propertyFiles) {
      const raw = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      for (const [key, value] of Object.entries(raw)) if (key !== 'position' && isSimple(value)) keys.add(key);
    }
    const items: LibraryItem[] = files.map((file) => {
      const raw = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      const fields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(raw)) if (key !== 'position' && isSimple(value)) fields[key] = value;
      return { file, fields };
    });
    this.availableProperties = [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    this.currentItems = items;
    return items;
  }

  filterCustomItems(items: LibraryItem[], library: LibraryDefinition): LibraryItem[] {
    let visible = items;
    if (this.search.trim()) {
      const q = this.search.trim().toLowerCase();
      visible = visible.filter((item) => {
        const title = item.file.basename.toLowerCase();
        return title.includes(q) || Object.values(item.fields).some((v) => normalizeScalar(v).toLowerCase().includes(q));
      });
    }
    visible = applyFilters(visible, library.filterGroup);
    return applySorts(visible, library.sorts);
  }

  async renderCustomResultsOnly(library: LibraryDefinition): Promise<void> {
    if (!this.shell || this.activeLibrary?.id !== library.id) return;
    const generation = ++this.renderGeneration;
    const scanned = await this.scanLibrary(library);
    if (generation !== this.renderGeneration || this.activeLibrary?.id !== library.id || !this.shell) return;
    const items = this.filterCustomItems(scanned, library);
    const content = this.shell.querySelector<HTMLElement>('.lcl-content');
    if (!content) { await this.renderCustom(); return; }
    content.innerHTML = '';
    this.renderGroups(content, library, groupItems(items, library.groupProperty, library.groupDirection));
  }

  async renderCustom(): Promise<void> {
    const library = this.activeLibrary;
    if (!library) { this.restoreBuiltinDom(); return; }
    this.ensureCustomShell();
    const generation = ++this.renderGeneration;
    const scanned = await this.scanLibrary(library);
    if (generation !== this.renderGeneration || this.activeLibrary?.id !== library.id) return;
    const items = this.filterCustomItems(scanned, library);
    if (!this.shell) return;
    closeFloatingPanelsWithin(this.shell);
    this.shell.innerHTML = '';
    this.renderToolbar(this.shell, library, items.length);
    const content = document.createElement('div'); content.className = 'lorebase-content lcl-content'; this.shell.appendChild(content);
    this.renderGroups(content, library, groupItems(items, library.groupProperty, library.groupDirection));
  }

  renderToolbar(root: HTMLElement, library: LibraryDefinition, count: number): void {
    const bar = document.createElement('div'); bar.className = `lorebase-toolbar lcl-toolbar ${this.mediaTrayOpen ? 'has-media-tray' : ''}`; root.appendChild(bar);
    const mobile = document.createElement('div'); mobile.className = 'lorebase-toolbar-mobile-header'; const mobileTitle = document.createElement('span'); mobileTitle.className = 'lorebase-toolbar-mobile-title'; mobileTitle.textContent = 'LOREBASE'; mobile.appendChild(mobileTitle); bar.appendChild(mobile);
    const left = document.createElement('div'); left.className = 'lorebase-toolbar-left'; bar.appendChild(left);
    const center = document.createElement('div'); center.className = 'lorebase-toolbar-center'; bar.appendChild(center);
    const right = document.createElement('div'); right.className = 'lorebase-toolbar-right'; bar.appendChild(right);

    const hasViewConfig = Boolean(library.sorts.length || countFilterRules(library.filterGroup) || library.groupProperty || library.activeSavedViewId);
    this.renderCustomViewControl(left, library, hasViewConfig);
    this.renderMediaControl(left, library);

    const searchContainer = document.createElement('div'); searchContainer.className = 'lorebase-search-container'; center.appendChild(searchContainer);
    const search = document.createElement('input'); search.type = 'text'; search.placeholder = 'Search...'; search.value = this.search; search.className = 'lorebase-search-input'; search.setAttribute('aria-label', `Search ${library.name}`);
    let timer: number | undefined;
    search.oninput = () => {
      this.search = search.value;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void this.renderCustomResultsOnly(library); }, 120);
    };
    searchContainer.appendChild(search);
    center.appendChild(this.toolbarButton('plus', `Add entry to ${library.name}`, () => new EntryModal(this.app, this.controller, library, this.availableProperties, this.currentItems, async () => { await this.renderCustom(); this.controller.refreshViews(); }).open(), 'lorebase-add-btn'));

    right.appendChild(this.toolbarButton('dice', 'Random', () => this.openRandomCustomItem()));
    this.renderCustomViewModeControl(right, library);
    this.renderCustomSettingsControl(right, library);

    if (this.mediaTrayOpen) this.renderIntegratedMediaTray(bar, library);
  }

  customPropertyChoices(library: LibraryDefinition): PropertyChoice[] {
    const inferred = inferPropertyKinds(this.currentItems);
    const choices: PropertyChoice[] = [];
    const seen = new Set<string>();
    const add = (value: string, label: string, kind: PropertyKind, group: string, advanced = false): void => {
      if (!value || seen.has(value)) return; seen.add(value); choices.push({ value, label, kind, group, advanced });
    };
    for (const field of library.entryFields) add(field.property, field.property, effectiveEntryKind(field.property, library, inferred), 'Entry properties');
    for (const property of this.availableProperties.filter((entry) => !entry.startsWith('$'))) add(property, property, inferred[property] ?? 'text', 'Note properties', true);
    for (const property of SPECIAL_PROPERTIES) add(property, specialPropertyLabel(property), property.includes('time') || property.endsWith('size') ? 'number' : 'text', 'File', true);
    return choices;
  }

  builtinPropertyChoices(): PropertyChoice[] {
    const choices: PropertyChoice[] = [];
    const seen = new Set<string>();
    const add = (value: string, label: string, kind: PropertyKind, group: string, advanced = false): void => {
      if (!value || seen.has(value)) return;
      seen.add(value);
      choices.push({ value, label, kind, group, advanced });
    };
    const defs = typeof this.hostView?.getFieldDefinitions === 'function' ? this.hostView.getFieldDefinitions() : [];
    const sortOptions = typeof this.hostView?.getSortOptions === 'function' ? this.hostView.getSortOptions() : [];
    const nativeSortFields = new Set(sortOptions.map((option: any) => this.controller.nativeFieldToProperty(String(option.field))));
    const primaryFilterIds = new Set(['status','series','favorite','year','rating','dateStarted','dateFinished','dateCompleted']);

    // Preserve Lorebase's own ordering first. Use Lorebase field-definition labels when
    // available so internal keys (e.g. finished/dateFinished) never leak into the UI.
    const nativeLabelByProperty = new Map<string, string>();
    for (const def of defs.filter((entry: any) => entry.source !== 'yaml')) {
      nativeLabelByProperty.set(this.controller.nativeFieldToProperty(def.id), def.label ?? def.id);
    }
    for (const option of sortOptions) {
      const property = this.controller.nativeFieldToProperty(option.field);
      add(property, nativeLabelByProperty.get(property) ?? option.label ?? option.field, this.nativeKindForProperty(option.field, defs), 'Lorebase');
    }
    for (const def of defs.filter((entry: any) => entry.source !== 'yaml')) {
      const property = this.controller.nativeFieldToProperty(def.id);
      const advanced = !primaryFilterIds.has(property) && !nativeSortFields.has(property);
      add(property, def.label ?? def.id, this.normalizeHostFieldKind(def.type), 'Lorebase', advanced);
    }
    for (const def of defs.filter((entry: any) => entry.source === 'yaml')) {
      add(this.controller.nativeFieldToProperty(def.id), def.label ?? def.id, this.normalizeHostFieldKind(def.type), 'Note properties', true);
    }
    const samples = new Map<string, unknown>();
    for (const item of this.hostView?.games ?? []) {
      for (const [key,value] of Object.entries(item?.rawFields ?? {})) if (!samples.has(key) && value != null) samples.set(key,value);
    }
    for (const [property,value] of [...samples.entries()].sort((a,b)=>a[0].localeCompare(b[0]))) {
      add(property, property, inferKindFromValue(value), 'Note properties', true);
    }
    for (const property of SPECIAL_PROPERTIES) add(property, specialPropertyLabel(property), property.includes('time') || property.endsWith('size') ? 'number' : 'text', 'File', true);
    return choices;
  }

  builtinGroupChoices(): PropertyChoice[] {
    const mediaType = this.getBuiltinMediaType();
    const base: PropertyChoice[] = [];
    if (mediaType === 'game') base.push({value:'@series',label:'Series',kind:'text',group:'Lorebase'});
    base.push({value:'@finishedMonth',label:'Finished month',kind:'date',group:'Lorebase'});
    base.push({value:'@finishedYear',label:'Finished year',kind:'date',group:'Lorebase'});
    return [...base, ...this.builtinPropertyChoices()];
  }

  normalizeHostFieldKind(value: unknown): PropertyKind {
    return value === 'number' || value === 'date' || value === 'boolean' || value === 'list' ? value : 'text';
  }

  nativeKindForProperty(field: string, defs: any[]): PropertyKind {
    const normalized = this.controller.nativeFieldToProperty(field);
    const def = defs.find((entry: any) => this.controller.nativeFieldToProperty(entry.id) === normalized);
    if (def) return this.normalizeHostFieldKind(def.type);
    if (['year','rating'].includes(normalized)) return 'number';
    if (['dateStarted','dateFinished','dateCompleted'].includes(normalized)) return 'date';
    if (['favorite','adult','custom'].includes(normalized)) return 'boolean';
    if (['tags','genres'].includes(normalized)) return 'list';
    return 'text';
  }

  renderCustomViewControl(parent: HTMLElement, library: LibraryDefinition, active: boolean): void {
    const wrap=document.createElement('div');wrap.className='lorebase-dropdown-wrap';parent.appendChild(wrap);
    const button=this.toolbarButton('sliders-horizontal',`View & filters${countFilterRules(library.filterGroup)?` (${countFilterRules(library.filterGroup)})`:''}`,()=>{this.viewPanelOpen=!this.viewPanelOpen;void this.renderCustom();},active?'is-active':'');
    button.setAttribute('aria-expanded',String(this.viewPanelOpen));if(this.viewPanelOpen)button.classList.add('is-open');wrap.appendChild(button);
    const panel=document.createElement('div');panel.className=`lorebase-dropdown lorebase-view-panel ${this.viewPanelOpen?'is-open':''}`;wrap.appendChild(panel);
    const state=library as unknown as UnifiedViewState;
    new UnifiedViewPanel(panel,state,this.customPropertyChoices(library),async()=>{
      library.filterMode=library.filterGroup.mode;
      library.filters=library.filterGroup.children.filter((node): node is FilterRule=>!isFilterGroup(node)).map(cloneRule);
      await this.controller.saveSettings();
      if (this.viewPanelOpen) await this.renderCustom();
    },'View & filters','$file.name').render();
  }

  augmentBuiltinViewPanel(): void {
    const panel=this.root.querySelector<HTMLElement>('.lorebase-view-panel');
    if(!panel)return;
    const mediaType=this.getBuiltinMediaType();
    const state=this.controller.getBuiltinViewState(mediaType,this.hostView);
    const choices=this.builtinPropertyChoices();
    const signature=JSON.stringify({mediaType,state,properties:choices.map((choice)=>choice.value)});
    if(panel.dataset.lclUnifiedSignature===signature)return;
    panel.dataset.lclUnifiedSignature=signature;
    const baseState = this.controller.getBuiltinBaseViewState(this.hostView);
    new UnifiedViewPanel(panel,state,choices,async()=>{
      await this.controller.saveSettings();
      this.syncNativeGroupingState(state);
      this.hostView.applyFiltersAndSort?.({scrollMode:'top'});
      globalThis.setTimeout(()=>this.augmentBuiltinViewPanel(),0);
    },'View & filters','name',this.builtinGroupChoices(),baseState).render();
    const trigger=panel.parentElement?.querySelector<HTMLElement>('.lorebase-toolbar-btn');
    if(trigger){const count=countFilterRules(state.filterGroup);trigger.classList.toggle('is-active',Boolean(state.sorts.length||count||state.groupProperty||state.activeSavedViewId));const existing=trigger.querySelector('.lorebase-view-rule-count');existing?.remove();if(count){const badge=document.createElement('span');badge.className='lorebase-view-rule-count';badge.textContent=String(count);trigger.appendChild(badge);}}
  }

  renderCustomSettingsControl(parent: HTMLElement, library: LibraryDefinition): void {
    const wrap = document.createElement('div'); wrap.className = 'lorebase-dropdown-wrap is-right'; parent.appendChild(wrap);
    const button = this.toolbarButton('settings', 'Settings', () => {}); button.setAttribute('aria-expanded','false'); wrap.appendChild(button);
    const panel = document.createElement('div'); panel.className = 'lorebase-dropdown'; wrap.appendChild(panel);
    const section = document.createElement('div'); section.className = 'lorebase-dropdown-section'; panel.appendChild(section);
    const settings = document.createElement('button'); settings.type='button'; settings.className='lorebase-dropdown-choice';
    const settingsIcon=document.createElement('span');settingsIcon.className='lorebase-dropdown-icon';setIcon(settingsIcon,'settings');settings.appendChild(settingsIcon);
    const settingsLabel=document.createElement('span');settingsLabel.className='lorebase-dropdown-label';settingsLabel.textContent='Library settings';settings.appendChild(settingsLabel);
    settings.onclick=(event)=>{event.preventDefault();event.stopPropagation();this.controller.openLibrarySettings(library.id);};section.appendChild(settings);
    button.onclick=(event)=>{event.preventDefault();event.stopPropagation();const open=!panel.classList.contains('is-open');this.shell?.querySelectorAll('.lorebase-dropdown.is-open').forEach((node)=>{if(node!==panel)node.classList.remove('is-open');});panel.classList.toggle('is-open',open);button.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));};
  }

  renderCustomViewModeControl(parent: HTMLElement, library: LibraryDefinition): void {
    const wrap=document.createElement('div');wrap.className='lorebase-dropdown-wrap is-right';parent.appendChild(wrap);
    const button=this.toolbarButton('layout-grid','View',()=>{});button.setAttribute('aria-haspopup','true');button.setAttribute('aria-expanded','false');wrap.appendChild(button);
    const panel=document.createElement('div');panel.className='lorebase-dropdown';wrap.appendChild(panel);
    const section=document.createElement('div');section.className='lorebase-dropdown-section';panel.appendChild(section);
    const options:[LibraryDefinition['orientation'],string,string][]=[['vertical','Vertical','rectangle-vertical'],['horizontal','Horizontal','rectangle-horizontal']];
    for(const [mode,label,iconId] of options){const selected=library.orientation===mode;const item=document.createElement('button');item.type='button';item.className=`lorebase-dropdown-choice ${selected?'is-selected':''}`;const icon=document.createElement('span');icon.className='lorebase-dropdown-icon';setIcon(icon,iconId);item.appendChild(icon);const text=document.createElement('span');text.className='lorebase-dropdown-label';text.textContent=label;item.appendChild(text);if(selected){const check=document.createElement('span');check.className='lorebase-dropdown-check';setIcon(check,'check');item.appendChild(check);}item.onclick=async(event)=>{event.preventDefault();event.stopPropagation();library.orientation=mode;await this.controller.saveSettings();await this.renderCustom();};section.appendChild(item);}
    button.onclick=(event)=>{event.preventDefault();event.stopPropagation();const open=!panel.classList.contains('is-open');this.shell?.querySelectorAll('.lorebase-dropdown.is-open').forEach((node)=>{if(node!==panel)node.classList.remove('is-open');});panel.classList.toggle('is-open',open);button.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));};
  }

  openRandomCustomItem(): void {
    const library = this.activeLibrary;
    if (!library || !this.shell) return;
    const items = this.filterCustomItems([...this.currentItems], library);
    if (!items.length) { new Notice('No matching entries'); return; }
    const item = items[Math.floor(Math.random() * items.length)];
    const content = this.shell.querySelector<HTMLElement>('.lcl-content');
    if (!content) return;
    content.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'lorebase-random-title';
    title.textContent = `Random ${library.name}: ${item.file.basename}`;
    content.appendChild(title);
    const grid = document.createElement('div');
    grid.className = `lorebase-grid lorebase-random-grid lcl-random-grid lcl-grid-${library.orientation}`;
    const layout = this.customLayout(library);
    grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
    grid.style.setProperty('--lcl-card-min-width', `${layout.minWidth}px`);
    const card = this.renderCard(item, library);
    card.classList.add('lcl-random-card');
    grid.appendChild(card);
    content.appendChild(grid);
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'lorebase-btn lorebase-back-btn';
    back.textContent = `Back to ${library.name}`;
    back.onclick = () => { void this.renderCustomResultsOnly(library); };
    content.appendChild(back);
  }

  renderMediaControl(parent: HTMLElement, library: LibraryDefinition): void {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `lorebase-toolbar-btn lorebase-media-trigger ${this.mediaTrayOpen ? 'is-open' : ''}`;
    button.setAttribute('aria-label', `Library: ${library.name}`); button.setAttribute('aria-expanded', String(this.mediaTrayOpen));
    const icon = document.createElement('span'); icon.className = 'lorebase-media-trigger-icon'; setIcon(icon, library.icon || 'library'); button.appendChild(icon);
    button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); this.mediaTrayOpen = !this.mediaTrayOpen; void this.renderCustom(); };
    parent.appendChild(button);
  }

  renderIntegratedMediaTray(toolbar: HTMLElement, activeLibrary: LibraryDefinition): void {
    const tray = document.createElement('div'); tray.className = 'lorebase-media-tray'; tray.setAttribute('role', 'toolbar'); tray.setAttribute('aria-label', 'Library switcher'); toolbar.appendChild(tray);
    const enabled = this.controller.host.getEnabledMediaTypes?.() ?? (Object.keys(BUILTIN_MEDIA) as HostMediaType[]);
    for (const mediaType of enabled) {
      const option = BUILTIN_MEDIA[mediaType];
      tray.appendChild(this.mediaOptionButton(option.icon, option.label, false, () => void this.selectBuiltinMedia(mediaType)));
    }
    const sep = document.createElement('span'); sep.className = 'lcl-media-separator'; tray.appendChild(sep);
    for (const library of this.controller.settings.libraries) {
      tray.appendChild(this.mediaOptionButton(library.icon || 'library', library.name, library.id === activeLibrary.id, () => void this.selectCustomLibrary(library.id, true)));
    }
    const close = this.mediaOptionButton('x', 'Close library switcher', false, () => { this.mediaTrayOpen = false; void this.renderCustom(); });
    close.classList.add('lorebase-media-tray-close'); tray.appendChild(close);
  }

  customLayout(library: LibraryDefinition): { columns: number; minWidth: number; minHeight: number; ratio: number; horizontalHeight: number } {
    const verticalPreset = { small: { width: 180, height: 300 }, medium: { width: 220, height: 380 }, large: { width: 260, height: 460 } }[library.cardSize];
    const horizontalPreset = { small: { width: 260, height: 136 }, medium: { width: 340, height: 190 }, large: { width: 420, height: 250 } }[library.cardSize];

    const fakeSettings = {
      columns: library.columns,
      cardSize: library.cardSize,
      cardStyle: 'hover',
      orientation: library.orientation,
      customCardSize: library.customCardSize,
      customCardMinWidth: library.customCardMinWidth,
      customCardMinHeight: library.customCardMinHeight,
      customCardImageRatio: library.customCardImageRatio,
      customHorizontalCardMinWidth: library.customHorizontalCardMinWidth,
      customHorizontalCardHeight: library.customHorizontalCardHeight,
    };

    const nativeLayout = this.builtinLayoutCalculator?.getEffectiveLayout?.(fakeSettings, library.orientation)
      ?? this.originalBuiltinGetEffectiveLayout?.(fakeSettings, library.orientation);
    if (nativeLayout) {
      const columns = this.builtinLayoutCalculator?.getRenderedColumns?.(nativeLayout)
        ?? Math.max(1, Math.min(library.columns, Number(nativeLayout.columns) || library.columns));
      const dimensions = nativeLayout.dimensions;
      return {
        columns: Math.max(1, columns),
        minWidth: Math.max(100, Number(nativeLayout.minCardWidth) || (library.orientation === 'horizontal' ? horizontalPreset.width : verticalPreset.width)),
        minHeight: dimensions?.verticalMinHeight ?? verticalPreset.height,
        ratio: dimensions?.verticalImageRatio ?? (2 / 3),
        horizontalHeight: dimensions?.horizontalHeight ?? horizontalPreset.height,
      };
    }

    const minWidth = library.orientation === 'horizontal'
      ? (library.customCardSize ? Math.max(100, library.customHorizontalCardMinWidth) : horizontalPreset.width)
      : (library.customCardSize ? Math.max(100, library.customCardMinWidth) : verticalPreset.width);
    const minHeight = library.customCardSize ? Math.max(100, library.customCardMinHeight) : verticalPreset.height;
    const horizontalHeight = library.customCardSize ? Math.max(100, library.customHorizontalCardHeight) : horizontalPreset.height;
    const ratio = library.customCardSize ? Math.max(0.4, Math.min(2.2, library.customCardImageRatio)) : 2 / 3;
    const available = Math.max(0, this.shell?.clientWidth ?? this.root?.clientWidth ?? 0);
    const inner = Math.max(0, available - 32);
    const byWidth = available > 0 ? Math.max(1, Math.floor((inner + 16) / (minWidth + 16))) : library.columns;
    const columns = Math.max(1, Math.min(8, library.columns, byWidth));
    return { columns, minWidth, minHeight, ratio, horizontalHeight };
  }


  renderGroups(root: HTMLElement, library: LibraryDefinition, groups: Map<string, LibraryItem[]>): void {
    if ([...groups.values()].every((items) => items.length === 0)) {
      const empty = document.createElement('div'); empty.className = 'lorebase-empty lcl-empty'; empty.textContent = 'No matching notes.'; root.appendChild(empty); return;
    }
    for (const [groupName, items] of groups) {
      const section = document.createElement('section'); section.className = 'lorebase-series-section lorebase-view-group-section lcl-group'; root.appendChild(section);
      if (library.groupProperty) { const h = document.createElement('div'); h.className = 'lorebase-series-title lorebase-view-group-title lcl-group-title'; const label=document.createElement('span');label.textContent=groupName;h.appendChild(label);const count=document.createElement('span');count.className='lorebase-view-group-count';count.textContent=String(items.length);h.appendChild(count);section.appendChild(h); }
      const layout = this.customLayout(library); const grid = document.createElement('div'); grid.className = `lorebase-grid lcl-grid lcl-grid-${library.orientation}`; grid.style.gridTemplateColumns = `repeat(${layout.columns}, minmax(0, 1fr))`; grid.style.setProperty('--lcl-card-min-width', `${layout.minWidth}px`); section.appendChild(grid);
      for (const item of items) grid.appendChild(this.renderCard(item, library));
    }
  }

  renderCard(item: LibraryItem, library: LibraryDefinition): HTMLElement {
    const layout = this.customLayout(library);
    const card = createCustomCardSurface(this.app, item, library, library.orientation);
    card.tabIndex = 0;

    if (library.orientation === 'horizontal') {
      card.style.height = `${layout.horizontalHeight}px`;
      card.style.minHeight = `${layout.horizontalHeight}px`;
      card.style.minWidth = '0';
      card.style.maxWidth = 'none';
    } else {
      card.style.width = '100%';
      card.style.maxWidth = `${layout.minWidth}px`;
      card.style.minWidth = '0';
      card.style.minHeight = '0';
      card.style.justifySelf = 'center';
    }

    const imageContainer = card.querySelector<HTMLElement>('.lorebase-card-image');
    if (imageContainer && library.orientation === 'vertical') {
      imageContainer.style.minHeight = `${layout.minHeight}px`;
      imageContainer.style.aspectRatio = `${Math.max(0.1, layout.ratio)}`;
      imageContainer.style.height = '';
    }

    const open = (): void => { void openFileReusingExistingLeaf(this.app, item.file); };
    card.onclick = open;
    card.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    };
    return card;
  }



  toolbarButton(icon: string, title: string, action: () => any, extraClass = ''): HTMLButtonElement {
    const b = document.createElement('button'); b.className = `lorebase-toolbar-btn ${extraClass}`.trim(); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); setIcon(b, icon); b.onclick = action; return b;
  }
}


class ConfirmLibraryDeleteModal extends Modal {
  libraryName: string;
  onConfirm: () => Promise<void>;
  constructor(app:any,libraryName:string,onConfirm:()=>Promise<void>){super(app);this.libraryName=libraryName;this.onConfirm=onConfirm;}
  onOpen():void{this.titleEl.textContent='Delete custom library?';this.contentEl.innerHTML='';const text=document.createElement('p');text.textContent=`Delete “${this.libraryName}” from Lorebase? Markdown notes and images will not be deleted.`;this.contentEl.appendChild(text);const actions=document.createElement('div');actions.className='lcl-modal-actions';this.contentEl.appendChild(actions);const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>this.close();actions.appendChild(cancel);const remove=document.createElement('button');remove.className='mod-warning';remove.textContent='Delete library';remove.onclick=async()=>{remove.disabled=true;await this.onConfirm();this.close();new Notice('Custom library deleted');};actions.appendChild(remove);}
}

class EntryModal extends Modal {
  controller: CustomLibrariesController;
  library: LibraryDefinition;
  items: LibraryItem[];
  onCreated: () => Promise<void>;
  values: Record<string, string> = {};
  creating = false;
  keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(app: any, controller: CustomLibrariesController, library: LibraryDefinition, properties: string[], items: LibraryItem[], onCreated: () => Promise<void>) {
    super(app);
    this.controller = controller;
    this.library = library;
    void properties;
    this.items = items;
    this.onCreated = onCreated;
  }

  onOpen(): void {
    this.titleEl.textContent = `Add to ${this.library.name}`;
    this.contentEl.classList.add('lcl-entry-modal');
    this.keyHandler = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void this.createEntry();
      }
    };
    this.contentEl.addEventListener('keydown', this.keyHandler);
    this.render();
  }

  onClose(): void {
    if (this.keyHandler) this.contentEl.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
  }

  fieldConfigs(): EntryFieldConfig[] {
    const seen = new Set<string>();
    return this.library.entryFields.filter((field) => {
      const property = field.property.trim();
      if (!property || property.startsWith('$') || seen.has(property)) return false;
      seen.add(property);
      return true;
    });
  }

  render(): void {
    this.contentEl.innerHTML = '';
    const kinds = inferPropertyKinds(this.items);
    const configs = this.fieldConfigs();
    const requiredForFileName = new Set(parseFileNameVariables(this.library.fileNameTemplate));

    const intro = document.createElement('div');
    intro.className = 'lcl-entry-intro';
    intro.textContent = `File name: ${this.library.fileNameTemplate || '(not configured)'}. Press Ctrl+Enter to create.`;
    this.contentEl.appendChild(intro);

    const fieldsWrap = document.createElement('div'); fieldsWrap.className = 'lcl-entry-fields'; this.contentEl.appendChild(fieldsWrap);
    for (const config of configs) {
      const property = config.property;
      const inferred = kinds[property] ?? 'text';
      const configuredType=config.type;
      const kind: PropertyKind = configuredType === 'auto' ? inferred : configuredType === 'datetime' ? 'date' : configuredType;
      const setting = new Setting(fieldsWrap).setName(property);
      if (requiredForFileName.has(property)) setting.setDesc('Required · used in File Name');
      else if (property === this.library.coverProperty) setting.setDesc('Cover image property');
      else if (kind === 'list') setting.setDesc('Comma or newline separated values');
      if (kind === 'boolean') setting.setDesc('Checkbox');
      else if (kind === 'list') setting.setDesc('Comma or newline separated values');

      if (kind === 'boolean') {
        if (!(property in this.values)) this.values[property] = 'false';
        setting.addToggle((toggle:any)=>toggle.setValue(this.values[property]==='true').onChange((value:boolean)=>this.values[property]=value?'true':'false'));
      } else if (kind === 'list') {
        setting.addTextArea((t:any)=>{t.setValue(this.values[property]??'');t.setPlaceholder('value 1\nvalue 2');if(t.inputEl){t.inputEl.rows=3;t.inputEl.classList.add('lcl-entry-textarea');}t.onChange((v:string)=>this.values[property]=v);});
      } else {
        setting.addText((t:any)=>{t.setValue(this.values[property]??'');if(t.inputEl&&kind==='number'){t.inputEl.type='number';t.inputEl.step='any';}if(t.inputEl&&configuredType==='date')t.inputEl.type='date';if(t.inputEl&&configuredType==='datetime')t.inputEl.type='datetime-local';t.onChange((v:string)=>this.values[property]=v);});
      }
    }


    const actions = document.createElement('div'); actions.className = 'lcl-modal-actions'; this.contentEl.appendChild(actions);
    const hint = document.createElement('span'); hint.className = 'lcl-entry-shortcut-hint'; hint.textContent = 'Ctrl+Enter'; actions.appendChild(hint);
    const create = document.createElement('button'); create.className = 'mod-cta'; create.textContent = 'Create entry';
    create.onclick = () => { void this.createEntry(); };
    actions.appendChild(create);
  }

  async createEntry(): Promise<void> {
    if (this.creating) return;
    const variables = parseFileNameVariables(this.library.fileNameTemplate);
    if (!this.library.fileNameTemplate.trim() || !variables.length) {
      new Notice('Configure File Name in this library settings first, e.g. %Artist - %Title');
      return;
    }
    const configuredProperties = new Set(this.fieldConfigs().map((field) => field.property));
    for (const property of variables) {
      if (!configuredProperties.has(property)) {
        new Notice(`${property} is used in File Name but is not configured in Entry properties`);
        return;
      }
      if (!String(this.values[property] ?? '').trim()) {
        new Notice(`${property} is required because it is used in File Name`);
        return;
      }
    }
    const kinds = inferPropertyKinds(this.items);
    const fields: Record<string, unknown> = {};
    for (const config of this.fieldConfigs()) {
      const raw = this.values[config.property] ?? '';
      if (!raw.trim()) continue;
      const kind: PropertyKind = config.type === 'auto' ? (kinds[config.property] ?? 'text') : config.type === 'datetime' ? 'date' : config.type;
      fields[config.property] = parseEntryValue(raw, kind);
    }
    const baseName = renderFileNameTemplate(this.library.fileNameTemplate, fields);
    this.creating = true;
    try {
      const file = await this.createNote(baseName, fields);
      this.close();
      await this.onCreated();
      new Notice(`Added to ${this.library.name}`);
      await openFileReusingExistingLeaf(this.app, file);
    } catch (error) {
      console.error('[Lorebase Custom Libraries] failed to create entry', error);
      new Notice(error instanceof Error ? error.message : 'Could not create entry');
    } finally {
      this.creating = false;
    }
  }

  async createNote(baseName: string, fields: Record<string, unknown>): Promise<TFile> {
    const folder = normalizePath(this.library.sourceFolder);
    if (folder) await this.ensureFolder(folder);
    let index = 1;
    let path = `${folder ? `${folder}/` : ''}${baseName}.md`;
    while (this.app.vault.getAbstractFileByPath(path)) { index++; path = `${folder ? `${folder}/` : ''}${baseName} (${index}).md`; }
    return await this.app.vault.create(path, buildEntryMarkdown(fields));
  }

  async ensureFolder(folder: string): Promise<void> {
    const parts = folder.split('/').filter(Boolean); let current = '';
    for (const part of parts) { current = current ? `${current}/${part}` : part; if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current); }
  }
}

class LibraryModal extends Modal {
  plugin: CustomLibrariesController; original: LibraryDefinition | null; onSaved: () => void;
  draft: LibraryDefinition;
  constructor(app: any, plugin: CustomLibrariesController, original: LibraryDefinition | null, onSaved: () => void) {
    super(app); this.plugin = plugin; this.original = original; this.onSaved = onSaved;
    this.draft = original ? JSON.parse(JSON.stringify(original)) : normalizeLibrary({
      id: uid('library'), name: '', icon: 'library', sourceFolder: '', propertyScope: 'folder', fileNameTemplate: '', coverProperty: '',
      columns: 5, orientation: 'vertical', cardSize: 'medium', customCardSize: false, entryFields: [],
      sorts: [], filterGroup: emptyFilterGroup('and'), groupProperty: '', groupDirection: 'asc', savedViews: [], activeSavedViewId: ''
    })!;
  }
  onOpen(): void {
    this.contentEl.empty?.();this.contentEl.innerHTML='';this.titleEl.textContent=this.original?'Edit custom library':'New custom library';
    new Setting(this.contentEl).setName('Name').setDesc('Example: Music, Research, Recipes').addText((text:any)=>text.setValue(this.draft.name).onChange((value:string)=>this.draft.name=value));
    const iconSetting=new Setting(this.contentEl).setName('Icon').setDesc('Choose the Lucide icon shown in Lorebase.');iconSetting.controlEl?.appendChild(this.plugin.iconSelector(this.draft.icon,(value)=>{this.draft.icon=value;}));
    new Setting(this.contentEl).setName('Source folder').setDesc('All Markdown notes inside this folder become library items. Blank means the whole vault.').addText((text:any)=>text.setValue(this.draft.sourceFolder).setPlaceholder('Media/Music').onChange((value:string)=>this.draft.sourceFolder=normalizePath(value)));
    const propertyScopeSetting = new Setting(this.contentEl).setName('Property suggestions').setDesc('Where Sort / Filter / Group discovers extra properties.');
    propertyScopeSetting.controlEl?.appendChild(inlineLorebaseSelect(
      [{ value: 'folder', label: 'This library folder' }, { value: 'vault', label: 'Whole vault' }],
      this.draft.propertyScope || 'folder',
      (value) => { this.draft.propertyScope = value === 'vault' ? 'vault' : 'folder'; }
    ));
    new Setting(this.contentEl).setName('File Name').setDesc('Template using Entry Properties. Example: %Artist - %Title').addText((text:any)=>text.setValue(this.draft.fileNameTemplate).setPlaceholder('%Artist - %Title').onChange((value:string)=>this.draft.fileNameTemplate=value));
    new Setting(this.contentEl).setName('Cover property').setDesc('Optional Entry Property that contains the cover image.').addText((text:any)=>text.setValue(this.draft.coverProperty).onChange((value:string)=>this.draft.coverProperty=value.trim()));

    const propertySetting = new Setting(this.contentEl)
      .setName('Entry properties')
      .setDesc('Fields available when creating an entry. Drag the grip to change their order.');
    const editor = document.createElement('div');
    editor.className = 'lcl-entry-properties-editor';
    propertySetting.settingEl.insertAdjacentElement('afterend', editor);
    this.plugin.renderEntryFieldRows(editor, this.draft.entryFields, () => {}, this.draft);

    const actions=document.createElement('div');actions.className='lcl-modal-actions';this.contentEl.appendChild(actions);
    if(this.original){const del=document.createElement('button');del.textContent='Delete library';del.className='mod-warning';del.onclick=()=>new ConfirmLibraryDeleteModal(this.app,this.original!.name,async()=>{this.plugin.settings.libraries=this.plugin.settings.libraries.filter((library)=>library.id!==this.original!.id);await this.plugin.saveSettings();this.close();this.onSaved();}).open();actions.appendChild(del);}
    const save=document.createElement('button');save.textContent='Save';save.className='mod-cta';save.onclick=async()=>{if(!this.draft.name.trim()){new Notice('Library name is required');return;}const variables=parseFileNameVariables(this.draft.fileNameTemplate);if(!variables.length){new Notice('File Name must contain at least one Entry Property variable, e.g. %Artist - %Track');return;}const available=new Set(this.draft.entryFields.map((field)=>field.property));const missing=variables.filter((property)=>!available.has(property));if(missing.length){new Notice(`File Name uses properties not defined in Entry properties: ${missing.join(', ')}`);return;}const index=this.plugin.settings.libraries.findIndex((library)=>library.id===this.draft.id);if(index>=0)this.plugin.settings.libraries[index]=this.draft;else this.plugin.settings.libraries.push(this.draft);this.plugin.activeMediaSettingsLibraryId=this.draft.id;await this.plugin.saveSettings();this.close();this.onSaved();new Notice('Custom library saved');};actions.appendChild(save);
  }
}

type PropertyChoice = { value: string; label: string; kind?: PropertyKind; group?: string; advanced?: boolean };

function operatorsForKind(kind: PropertyKind): Array<{v: FilterOperator; l: string}> {
  if (kind === 'boolean') return [{v:'isTrue',l:'is true'},{v:'isFalse',l:'is false'}];
  if (kind === 'number') return [{v:'equals',l:'is'},{v:'notEquals',l:'is not'},{v:'greater',l:'greater than'},{v:'less',l:'less than'},{v:'between',l:'between'},{v:'empty',l:'is empty'},{v:'notEmpty',l:'is not empty'}];
  if (kind === 'date') return [{v:'equals',l:'is'},{v:'notEquals',l:'is not'},{v:'greater',l:'after'},{v:'less',l:'before'},{v:'between',l:'between'},{v:'thisMonth',l:'this month'},{v:'thisYear',l:'this year'},{v:'empty',l:'is empty'},{v:'notEmpty',l:'is not empty'}];
  if (kind === 'list') return [{v:'containsAny',l:'contains any'},{v:'containsAll',l:'contains all'},{v:'notContains',l:'does not contain'},{v:'empty',l:'is empty'},{v:'notEmpty',l:'is not empty'}];
  return [{v:'contains',l:'contains'},{v:'equals',l:'is'},{v:'notEquals',l:'is not'},{v:'notContains',l:'does not contain'},{v:'empty',l:'is empty'},{v:'notEmpty',l:'is not empty'}];
}

function snapshotSavedView(name: string, state: UnifiedViewState, id = uid('view')): SavedView {
  const rootRules = state.filterGroup.children.filter((node): node is FilterRule => !isFilterGroup(node)).map(cloneRule);
  return {
    id, name,
    sorts: cloneSorts(state.sorts),
    filterMode: state.filterGroup.mode,
    filters: rootRules,
    filterGroup: cloneFilterGroup(state.filterGroup),
    groupProperty: state.groupProperty,
    groupDirection: state.groupDirection,
  };
}
function applySavedViewState(state: UnifiedViewState, view: SavedView): void {
  state.sorts = cloneSorts(view.sorts);
  state.filterGroup = cloneFilterGroup(view.filterGroup);
  state.groupProperty = view.groupProperty;
  state.groupDirection = view.groupDirection;
  state.activeSavedViewId = view.id;
}
function resetUnifiedViewState(state: UnifiedViewState, baseState?: UnifiedViewState): void {
  state.sorts = baseState ? cloneSorts(baseState.sorts) : [];
  state.filterGroup = baseState ? cloneFilterGroup(baseState.filterGroup) : emptyFilterGroup('and');
  state.groupProperty = baseState?.groupProperty ?? '';
  state.groupDirection = baseState?.groupDirection ?? 'asc';
  state.activeSavedViewId = '';
}
function savedViewMatchesState(state: UnifiedViewState, view: SavedView): boolean {
  return JSON.stringify({
    sorts: state.sorts,
    filterGroup: state.filterGroup,
    groupProperty: state.groupProperty,
    groupDirection: state.groupDirection,
  }) === JSON.stringify({
    sorts: view.sorts,
    filterGroup: view.filterGroup,
    groupProperty: view.groupProperty,
    groupDirection: view.groupDirection,
  });
}

class UnifiedViewPanel {
  panel: HTMLElement;
  state: UnifiedViewState;
  choices: PropertyChoice[];
  groupChoices: PropertyChoice[];
  onCommit: () => void | Promise<void>;
  title: string;
  defaultSortProperty: string;
  baseState?: UnifiedViewState;
  viewName = '';

  constructor(panel: HTMLElement, state: UnifiedViewState, choices: PropertyChoice[], onCommit: () => void | Promise<void>, title = 'View & filters', defaultSortProperty = '$file.name', groupChoices?: PropertyChoice[], baseState?: UnifiedViewState) {
    this.panel = panel; this.state = state; this.choices = choices; this.groupChoices = groupChoices ?? choices; this.onCommit = onCommit; this.title = title; this.defaultSortProperty = defaultSortProperty; this.baseState = baseState;
  }

  render(): void {
    closeFloatingPanelsWithin(this.panel);
    this.panel.innerHTML = '';
    this.panel.classList.add('lorebase-view-panel', 'lcl-unified-view-panel');
    this.panel.setAttribute('role','dialog');
    this.panel.setAttribute('aria-label',this.title);

    const header = document.createElement('div'); header.className='lorebase-view-panel-header'; this.panel.appendChild(header);
    const titleWrap=document.createElement('div'); titleWrap.className='lorebase-view-panel-title-wrap'; header.appendChild(titleWrap);
    const title=document.createElement('div'); title.className='lorebase-view-panel-title'; title.textContent=this.title; titleWrap.appendChild(title);
    const active=this.state.savedViews.find((view)=>view.id===this.state.activeSavedViewId);
    const dirty=Boolean(active && !savedViewMatchesState(this.state,active));
    const subtitle=document.createElement('div'); subtitle.className=`lorebase-view-panel-subtitle ${dirty?'is-dirty':''}`.trim(); subtitle.textContent=dirty?'Modified':(active?.name ?? 'Base view'); titleWrap.appendChild(subtitle);
    const reset=this.iconButton('rotate-ccw','Reset view',()=>{ resetUnifiedViewState(this.state, this.baseState); this.commitAndRender(); }); header.appendChild(reset);

    const savedSection=document.createElement('div'); savedSection.className='lorebase-view-saved-section'; this.panel.appendChild(savedSection);
    const savedDropdown=simpleSelect(
      [{v:'',l:'Base view'},...this.state.savedViews.map((view)=>({v:view.id,l:view.name}))],
      this.state.activeSavedViewId,
      (value)=>{
        const view=this.state.savedViews.find((entry)=>entry.id===value);
        if(view)applySavedViewState(this.state,view);
        else resetUnifiedViewState(this.state, this.baseState);
        this.commitAndRender();
      }
    );
    savedDropdown.classList.add('lorebase-view-dropdown');
    savedSection.appendChild(savedDropdown);
    const update=this.iconButton('save','Update saved view',()=>{const view=this.state.savedViews.find((entry)=>entry.id===this.state.activeSavedViewId);if(!view)return;const next=snapshotSavedView(view.name,this.state,view.id);Object.assign(view,next);this.commitAndRender();}); update.disabled=!this.state.activeSavedViewId;savedSection.appendChild(update);
    if(this.state.activeSavedViewId){const remove=this.iconButton('trash-2','Delete saved view',()=>{this.state.savedViews=this.state.savedViews.filter((view)=>view.id!==this.state.activeSavedViewId);this.state.activeSavedViewId='';this.commitAndRender();},'is-danger');savedSection.appendChild(remove);}

    const saveRow=document.createElement('div');saveRow.className='lorebase-view-save-row';this.panel.appendChild(saveRow);
    const nameInput=document.createElement('input');nameInput.className='lorebase-view-name-input';nameInput.type='text';nameInput.placeholder='View name';nameInput.value=this.viewName;nameInput.oninput=()=>this.viewName=nameInput.value;saveRow.appendChild(nameInput);
    const saveAs=document.createElement('button');saveAs.type='button';saveAs.className='lorebase-view-small-button';saveAs.textContent='Save as';
    const commitSaveAs=()=>{const name=this.viewName.trim();if(!name){nameInput.focus();return;}const view=snapshotSavedView(name,this.state);this.state.savedViews.push(view);this.state.activeSavedViewId=view.id;this.viewName='';this.commitAndRender();};
    saveAs.onclick=commitSaveAs;nameInput.onkeydown=(event)=>{if(event.key==='Enter'){event.preventDefault();commitSaveAs();}};saveRow.appendChild(saveAs);

    const controls=document.createElement('div');controls.className='lorebase-view-controls';this.panel.appendChild(controls);
    this.renderSortSection(controls);
    this.renderGroupSection(controls);
    this.renderFiltersSection(this.panel);
  }

  renderSortSection(parent: HTMLElement): void {
    const label=document.createElement('div');label.className='lorebase-view-section-header lcl-section-header';const text=document.createElement('span');text.textContent='Sort';label.appendChild(text);parent.appendChild(label);
    const list=document.createElement('div');list.className='lcl-sort-list';parent.appendChild(list);
    if(!this.state.sorts.length){const empty=document.createElement('div');empty.className='lorebase-view-empty';empty.textContent='No sorting';list.appendChild(empty);}
    this.state.sorts.forEach((sort,index)=>{
      const row=document.createElement('div');row.className='lorebase-view-control-row lcl-sort-row';
      row.appendChild(propertyChoiceInput(this.choices,sort.property,(value,choice)=>{sort.property=value;if(choice?.kind){}this.commitAndRender();},'Property'));
      row.appendChild(this.orderButton(sort.direction,(direction)=>{sort.direction=direction;this.commitAndRender();}));
      row.appendChild(this.iconButton('trash-2','Remove sort',()=>{this.state.sorts.splice(index,1);this.commitAndRender();}));list.appendChild(row);
    });
    const add=document.createElement('button');add.type='button';add.className='lorebase-view-small-button lcl-view-add-button';add.textContent='+ New sort';add.onclick=()=>{this.state.sorts.push({property:'',direction:'asc'});this.commitAndRender();};parent.appendChild(add);
  }

  renderGroupSection(parent: HTMLElement): void {
    const label=document.createElement('div');label.className='lorebase-view-section-header lcl-section-header';const text=document.createElement('span');text.textContent='Group';label.appendChild(text);parent.appendChild(label);
    const row=document.createElement('div');row.className='lorebase-view-control-row lcl-group-control-row';
    row.appendChild(propertyChoiceInput(this.groupChoices,this.state.groupProperty,(value)=>{this.state.groupProperty=value;this.commitAndRender();},'No grouping',true));
    const order=this.orderButton(this.state.groupDirection,(direction)=>{this.state.groupDirection=direction;this.commitAndRender();});order.disabled=!this.state.groupProperty;row.appendChild(order);parent.appendChild(row);
  }

  renderFiltersSection(parent: HTMLElement): void {
    const filters=document.createElement('div');filters.className='lorebase-view-filters';parent.appendChild(filters);
    const header=document.createElement('div');header.className='lorebase-view-section-header';const text=document.createElement('span');text.textContent='Filters';header.appendChild(text);const count=document.createElement('span');count.className='lorebase-view-section-count';count.textContent=String(countFilterRules(this.state.filterGroup));header.appendChild(count);filters.appendChild(header);
    this.renderFilterGroup(filters,this.state.filterGroup,true,0);
  }

  renderFilterGroup(parent: HTMLElement, group: FilterGroup, root: boolean, depth: number): void {
    const box=document.createElement('div');box.className=`lcl-filter-group ${root?'is-root':'is-nested'}`;box.style.setProperty('--lcl-filter-depth',String(depth));parent.appendChild(box);
    const modeRow=document.createElement('div');modeRow.className='lcl-filter-group-header';
    const icon=document.createElement('span');setIcon(icon,'sliders-horizontal');modeRow.appendChild(icon);
    const mode=simpleSelect([{v:'and',l:'All the following are true'},{v:'or',l:'Any of the following are true'},{v:'none',l:'None of the following are true'}],group.mode,(value)=>{group.mode=value as FilterMode;this.commitAndRender();});mode.classList.add('lcl-filter-mode');modeRow.appendChild(mode);
    if(!root)modeRow.appendChild(this.iconButton('trash-2','Remove filter group',()=>{this.removeNode(this.state.filterGroup,group.id);this.commitAndRender();}));box.appendChild(modeRow);

    const ruleList=document.createElement('div');ruleList.className='lorebase-view-rule-list';box.appendChild(ruleList);
    if(!group.children.length){const empty=document.createElement('div');empty.className='lorebase-view-empty';empty.textContent='No filters';ruleList.appendChild(empty);}
    for(const node of group.children){
      if(isFilterGroup(node)){this.renderFilterGroup(ruleList,node,false,depth+1);continue;}
      this.renderRule(ruleList,group,node);
    }
    const addRow=document.createElement('div');addRow.className='lorebase-view-add-row lcl-filter-add-row';box.appendChild(addRow);
    const addFilter=document.createElement('button');addFilter.type='button';addFilter.className='lorebase-view-small-button lcl-view-add-button';addFilter.textContent='+ New filter';addFilter.onclick=()=>{group.children.push({kind:'rule',id:uid('filter'),property:'',fieldType:'text',operator:'contains',value:''});this.commitAndRender();};addRow.appendChild(addFilter);
    const addGroup=document.createElement('button');addGroup.type='button';addGroup.className='lorebase-view-small-button lcl-view-add-button';addGroup.textContent='+ New filter group';addGroup.onclick=()=>{group.children.push(emptyFilterGroup('and'));this.commitAndRender();};addRow.appendChild(addGroup);
  }

  renderRule(parent: HTMLElement, owner: FilterGroup, rule: FilterRule): void {
    const card=document.createElement('div');card.className='lorebase-view-rule lcl-unified-rule';parent.appendChild(card);
    const top=document.createElement('div');top.className='lorebase-view-rule-top lcl-unified-rule-top';card.appendChild(top);
    top.appendChild(propertyChoiceInput(this.choices,rule.property,(value,choice)=>{rule.property=value;rule.fieldType=choice?.kind??'text';const ops=operatorsForKind(rule.fieldType);if(!ops.some((entry)=>entry.v===rule.operator))rule.operator=ops[0].v;this.commitAndRender();},'Property'));
    top.appendChild(this.iconButton('trash-2','Remove filter',()=>{owner.children=owner.children.filter((node)=>node!==rule);this.commitAndRender();}));
    const body=document.createElement('div');body.className='lorebase-view-rule-body';card.appendChild(body);
    const kind=rule.fieldType??this.choices.find((entry)=>entry.value===rule.property)?.kind??'text';
    const operators=operatorsForKind(kind);body.appendChild(simpleSelect(operators,rule.operator,(value)=>{rule.operator=value as FilterOperator;this.commitAndRender();}));
    if(['empty','notEmpty','isTrue','isFalse','thisMonth','thisYear'].includes(rule.operator))return;
    const inputType=kind==='number'?'number':kind==='date'?'date':'text';
    const input=document.createElement('input');input.className='lorebase-view-value-input';input.type=inputType;input.value=normalizeScalar(rule.value);input.placeholder=kind==='list'?'value 1, value 2':'Value';input.onchange=()=>{rule.value=input.value;void this.onCommit();};body.appendChild(input);
    if(rule.operator==='between'){const to=document.createElement('input');to.className='lorebase-view-value-input';to.type=inputType;to.value=normalizeScalar(rule.valueTo);to.placeholder='To';to.onchange=()=>{rule.valueTo=to.value;void this.onCommit();};body.appendChild(to);}
  }

  removeNode(group: FilterGroup, id: string): boolean {
    const index=group.children.findIndex((node)=>isFilterGroup(node)&&node.id===id);
    if(index>=0){group.children.splice(index,1);return true;}
    for(const node of group.children)if(isFilterGroup(node)&&this.removeNode(node,id))return true;
    return false;
  }
  orderButton(direction: Direction,onChange:(direction:Direction)=>void):HTMLButtonElement{const button=document.createElement('button');button.type='button';button.className='lorebase-view-icon-button';button.title=direction==='asc'?'Ascending':'Descending';setIcon(button,direction==='asc'?'arrow-up':'arrow-down');button.onclick=()=>onChange(direction==='asc'?'desc':'asc');return button;}
  iconButton(icon:string,title:string,action:()=>void,extra=''):HTMLButtonElement{const button=document.createElement('button');button.type='button';button.className=`lorebase-view-icon-button ${extra}`.trim();button.title=title;button.setAttribute('aria-label',title);setIcon(button,icon);button.onclick=action;return button;}
  commitAndRender():void{void Promise.resolve(this.onCommit()).finally(()=>{if(this.panel.isConnected)this.render();});}
}


type InlineDropdownOption = { value: string; label: string; icon?: string };

function inlineLorebaseSelect(
  options: InlineDropdownOption[],
  value: string,
  onChange: (value: string) => void | Promise<void>,
  placeholder = 'Select…',
  extraClass = ''
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `lorebase-settings-dropdown lcl-inline-settings-dropdown ${extraClass}`.trim();
  let current = value;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lorebase-settings-dropdown-btn';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  wrap.appendChild(button);

  const currentIcon = document.createElement('span');
  currentIcon.className = 'lorebase-dropdown-icon lcl-inline-current-icon';
  button.appendChild(currentIcon);
  const label = document.createElement('span');
  label.className = 'lorebase-settings-dropdown-label';
  button.appendChild(label);
  const caret = document.createElement('span');
  caret.className = 'lorebase-settings-dropdown-caret';
  setIcon(caret, 'chevron-down');
  button.appendChild(caret);

  const panel = document.createElement('div');
  panel.className = 'lorebase-settings-dropdown-panel lcl-inline-settings-dropdown-panel';
  panel.setAttribute('role', 'listbox');
  wrap.appendChild(panel);

  const doc = wrap.ownerDocument ?? document;
  const close = (): void => {
    wrap.classList.remove('is-open');
    button.classList.remove('is-open');
    panel.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
  };
  const closeOthers = (): void => {
    doc.querySelectorAll<HTMLElement>('.lcl-inline-settings-dropdown.is-open').forEach((node) => {
      if (node !== wrap) node.dispatchEvent(new CustomEvent('lcl-inline-close'));
    });
  };
  const render = (): void => {
    const selected = options.find((option) => option.value === current);
    label.textContent = selected?.label ?? placeholder;
    currentIcon.innerHTML = '';
    if (selected?.icon) setIcon(currentIcon, selected.icon);
    currentIcon.classList.toggle('is-empty', !selected?.icon);
    panel.innerHTML = '';
    for (const option of options) {
      const item = document.createElement('div');
      item.className = 'lorebase-settings-dropdown-option';
      item.classList.toggle('is-selected', option.value === current);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.value === current));
      item.tabIndex = 0;
      if (option.icon) {
        const itemIcon = document.createElement('span');
        itemIcon.className = 'lorebase-dropdown-icon lcl-inline-option-icon';
        setIcon(itemIcon, option.icon);
        item.appendChild(itemIcon);
      }
      const itemLabel = document.createElement('span');
      itemLabel.className = 'lorebase-settings-dropdown-option-label';
      itemLabel.textContent = option.label;
      item.appendChild(itemLabel);
      if (option.value === current) {
        const check = document.createElement('span');
        check.className = 'lorebase-settings-dropdown-option-check';
        setIcon(check, 'check');
        item.appendChild(check);
      }
      const choose = (): void => {
        if (option.value === current) { close(); return; }
        current = option.value;
        render();
        close();
        void Promise.resolve(onChange(current));
      };
      item.onclick = (event) => { event.preventDefault(); event.stopPropagation(); choose(); };
      item.onkeydown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        choose();
      };
      panel.appendChild(item);
    }
  };

  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const open = !wrap.classList.contains('is-open');
    closeOthers();
    wrap.classList.toggle('is-open', open);
    button.classList.toggle('is-open', open);
    panel.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
  };
  wrap.addEventListener('lcl-inline-close', close);
  panel.onclick = (event) => event.stopPropagation();

  const onDocumentClick = (event: MouseEvent): void => {
    if (!wrap.isConnected) {
      doc.removeEventListener('click', onDocumentClick);
      doc.removeEventListener('keydown', onDocumentKeydown);
      return;
    }
    if (!event.composedPath().includes(wrap)) close();
  };
  const onDocumentKeydown = (event: KeyboardEvent): void => {
    if (!wrap.isConnected) {
      doc.removeEventListener('click', onDocumentClick);
      doc.removeEventListener('keydown', onDocumentKeydown);
      return;
    }
    if (event.key === 'Escape') close();
  };
  doc.addEventListener('click', onDocumentClick);
  doc.addEventListener('keydown', onDocumentKeydown);
  render();
  return wrap;
}

type FloatingPanelHandle = { open: () => void; close: () => void; position: () => void; isOpen: () => boolean };

function closeFloatingPanelsWithin(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.lcl-floating-owner.is-open').forEach((owner)=>owner.dispatchEvent(new CustomEvent('lcl-floating-close')));
}

function attachFloatingPanel(anchor: HTMLElement, panel: HTMLElement, owner: HTMLElement): FloatingPanelHandle {
  const doc = owner.ownerDocument ?? document;
  const win = doc.defaultView ?? window;
  let opened = false;
  let connectionTimer: number | null = null;

  const cleanStyles = (): void => {
    for (const property of ['position','left','top','width','min-width','max-width','max-height','visibility','z-index']) {
      panel.style.removeProperty(property);
    }
  };
  const position = (): void => {
    if (!opened) return;
    if (!anchor.isConnected || !owner.isConnected) { close(); return; }
    const rect = anchor.getBoundingClientRect();
    const vw = doc.documentElement.clientWidth || win.innerWidth;
    const vh = doc.documentElement.clientHeight || win.innerHeight;
    const edge = 8, gap = 4;
    const width = Math.min(Math.max(rect.width, 180), 360, Math.max(180, vw - edge * 2));
    panel.style.position = 'fixed';
    panel.style.width = `${width}px`;
    panel.style.minWidth = `${width}px`;
    panel.style.maxWidth = `${width}px`;
    panel.style.left = `${Math.min(Math.max(edge, rect.left), Math.max(edge, vw - width - edge))}px`;
    panel.style.top = '0px';
    panel.style.visibility = 'hidden';
    panel.style.zIndex = '10050';
    const below = Math.max(0, vh - rect.bottom - gap - edge);
    const above = Math.max(0, rect.top - gap - edge);
    const openAbove = below < 180 && above > below;
    const available = Math.max(96, openAbove ? above : below);
    panel.style.maxHeight = `${Math.min(360, available)}px`;
    const ph = panel.getBoundingClientRect().height;
    const top = openAbove
      ? Math.max(edge, rect.top - gap - ph)
      : Math.min(rect.bottom + gap, vh - edge - ph);
    panel.style.top = `${Math.max(edge, top)}px`;
    panel.style.visibility = '';
  };
  const onDocClick = (event: MouseEvent): void => {
    if (!opened) return;
    const path = event.composedPath();
    if (path.includes(owner) || path.includes(panel)) return;
    close();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (!opened || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
    anchor.focus();
  };
  const onScroll = (event: Event): void => {
    if (!opened || event.composedPath().includes(panel)) return;
    position();
  };
  const bind = (): void => {
    doc.addEventListener('pointerdown', onDocClick, true);
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('scroll', onScroll, true);
    win.addEventListener('resize', position);
    connectionTimer = win.setInterval(() => {
      const parentDropdown = owner.closest<HTMLElement>('.lorebase-dropdown');
      if (opened && (!owner.isConnected || !anchor.isConnected || (parentDropdown && !parentDropdown.classList.contains('is-open')))) close();
    }, 120);
  };
  const unbind = (): void => {
    doc.removeEventListener('pointerdown', onDocClick, true);
    doc.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('scroll', onScroll, true);
    win.removeEventListener('resize', position);
    if (connectionTimer !== null) {
      win.clearInterval(connectionTimer);
      connectionTimer = null;
    }
  };
  const close = (): void => {
    if (!opened) return;
    opened = false;
    unbind();
    panel.classList.remove('is-open');
    owner.classList.remove('is-open');
    anchor.classList.remove('is-open');
    anchor.setAttribute('aria-expanded', 'false');
    cleanStyles();
    if (owner.isConnected) owner.appendChild(panel);
    else panel.remove();
  };
  const closeOthers = (): void => {
    doc.querySelectorAll<HTMLElement>('.lcl-floating-owner.is-open').forEach((node) => {
      if (node !== owner) node.dispatchEvent(new CustomEvent('lcl-floating-close'));
    });
  };
  const open = (): void => {
    if (opened) { position(); return; }
    closeOthers();
    opened = true;
    owner.classList.add('is-open');
    anchor.classList.add('is-open');
    anchor.setAttribute('aria-expanded', 'true');
    // Portals are only used inside the Lorebase library view. Settings controls use native Obsidian dropdowns.
    if (panel.parentElement !== doc.body) doc.body.appendChild(panel);
    panel.classList.add('is-open');
    bind();
    position();
  };
  owner.classList.add('lcl-floating-owner');
  owner.addEventListener('lcl-floating-close', close);
  panel.addEventListener('pointerdown', (event) => event.stopPropagation());
  panel.addEventListener('click', (event) => event.stopPropagation());
  return { open, close, position, isOpen: () => opened };
}

function propertyChoiceInput(
  choices: PropertyChoice[],
  value: string,
  onChange: (value: string, choice?: PropertyChoice) => void,
  placeholder = 'Property',
  allowBlank = false
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'lorebase-settings-dropdown is-floating lcl-property-combobox';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'lorebase-settings-dropdown-btn lcl-property-combobox-input';
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  wrap.appendChild(input);
  const panel = document.createElement('div');
  panel.className = 'lorebase-settings-dropdown-panel lorebase-floating-dropdown-panel lcl-property-combobox-panel';
  panel.setAttribute('role', 'listbox');
  wrap.appendChild(panel);

  const floating = attachFloatingPanel(input, panel, wrap);
  let selectedValue = value;
  let editing = false;
  let showAdvanced = Boolean(choices.find((choice) => choice.value === value)?.advanced);
  const displayValue = (raw: string): string => choices.find((choice) => choice.value === raw)?.label ?? raw;
  input.value = displayValue(selectedValue);

  const choose = (next: string, choice?: PropertyChoice): void => {
    selectedValue = next;
    editing = false;
    input.value = choice?.label ?? displayValue(next);
    floating.close();
    onChange(next, choice);
  };

  const renderOptions = (): void => {
    panel.innerHTML = '';
    const query = editing ? input.value.trim().toLocaleLowerCase() : '';
    let lastGroup = '';

    if (allowBlank) {
      const none = document.createElement('div');
      none.className = 'lorebase-settings-dropdown-option';
      none.textContent = 'No grouping';
      none.onpointerdown = (event) => { event.preventDefault(); choose('', undefined); };
      panel.appendChild(none);
    }

    const visible = choices.filter((choice) => !choice.advanced || showAdvanced || Boolean(query));
    const filtered = visible
      .filter((choice) => !query || choice.label.toLocaleLowerCase().includes(query) || choice.value.toLocaleLowerCase().includes(query))
      .slice(0, 180);

    for (const choice of filtered) {
      if (choice.group && choice.group !== lastGroup) {
        const section = document.createElement('div');
        section.className = 'lorebase-settings-dropdown-section-label';
        section.textContent = choice.group;
        panel.appendChild(section);
        lastGroup = choice.group;
      }
      const option = document.createElement('div');
      option.className = 'lorebase-settings-dropdown-option';
      option.classList.toggle('is-selected', choice.value === selectedValue);
      const label = document.createElement('span');
      label.className = 'lorebase-settings-dropdown-option-label';
      label.textContent = choice.label;
      option.appendChild(label);
      if (choice.value === selectedValue) {
        const check = document.createElement('span');
        check.className = 'lorebase-settings-dropdown-option-check';
        setIcon(check, 'check');
        option.appendChild(check);
      }
      option.onpointerdown = (event) => {
        event.preventDefault();
        choose(choice.value, choice);
      };
      panel.appendChild(option);
    }

    if (query && !choices.some((choice) =>
      choice.value.toLocaleLowerCase() === query || choice.label.toLocaleLowerCase() === query
    )) {
      const section = document.createElement('div');
      section.className = 'lorebase-settings-dropdown-section-label';
      section.textContent = 'Custom property';
      panel.appendChild(section);
      const custom = document.createElement('div');
      custom.className = 'lorebase-settings-dropdown-option';
      custom.textContent = `Use ${input.value.trim()}`;
      custom.onpointerdown = (event) => {
        event.preventDefault();
        const raw = input.value.trim();
        if (raw) choose(raw, { value: raw, label: raw, kind: 'text', group: 'Custom' });
      };
      panel.appendChild(custom);
    }

    if (!query && choices.some((choice) => choice.advanced)) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'lorebase-settings-dropdown-more';
      more.textContent = showAdvanced ? 'Show less' : 'Show more';
      const icon = document.createElement('span');
      icon.className = 'lorebase-settings-dropdown-more-icon';
      setIcon(icon, showAdvanced ? 'chevron-up' : 'chevron-down');
      more.prepend(icon);
      more.onpointerdown = (event) => {
        event.preventDefault();
        showAdvanced = !showAdvanced;
        renderOptions();
        floating.position();
      };
      panel.appendChild(more);
    }
  };

  const open = (asEditor = false): void => {
    editing = asEditor;
    if (!asEditor) input.value = displayValue(selectedValue);
    renderOptions();
    floating.open();
  };

  input.onfocus = () => {
    // Focus alone must never spawn a popup. This prevents duplicate orphan menus after re-renders.
    if (!editing) input.value = displayValue(selectedValue);
  };
  input.onclick = (event) => {
    event.stopPropagation();
    if (floating.isOpen()) {
      floating.close();
      return;
    }
    open(false);
  };
  input.oninput = () => {
    editing = true;
    renderOptions();
    if (!floating.isOpen()) floating.open();
    else floating.position();
  };
  input.onkeydown = (event) => {
    if (event.key === 'Escape') {
      if (floating.isOpen()) {
        event.preventDefault();
        floating.close();
        input.value = displayValue(selectedValue);
        editing = false;
      }
      return;
    }
    if (event.key === 'ArrowDown' && !floating.isOpen()) {
      event.preventDefault();
      open(editing);
      return;
    }
    if (event.key === 'Enter' && editing) {
      event.preventDefault();
      const raw = input.value.trim();
      if (!raw) {
        if (allowBlank) choose('', undefined);
        else { floating.close(); input.value = displayValue(selectedValue); editing = false; }
        return;
      }
      const choice = choices.find((entry) =>
        entry.value.toLocaleLowerCase() === raw.toLocaleLowerCase() ||
        entry.label.toLocaleLowerCase() === raw.toLocaleLowerCase()
      );
      choose(choice?.value ?? raw, choice ?? { value: raw, label: raw, kind: 'text', group: 'Custom' });
    }
  };
  input.onblur = () => {
    // Closing/clicking away never commits a half-typed value.
    if (!floating.isOpen() && editing) {
      input.value = displayValue(selectedValue);
      editing = false;
    }
  };
  return wrap;
}



function simpleSelect(options:{v:string,l:string}[],value:string,onChange:(value:string)=>void):HTMLElement {
  const wrap=document.createElement('div');wrap.className='lorebase-settings-dropdown is-floating lcl-simple-native-dropdown';
  const button=document.createElement('button');button.type='button';button.className='lorebase-settings-dropdown-btn';wrap.appendChild(button);
  const label=document.createElement('span');label.className='lorebase-settings-dropdown-label';button.appendChild(label);
  const caret=document.createElement('span');caret.className='lorebase-settings-dropdown-caret';setIcon(caret,'chevron-down');button.appendChild(caret);
  const panel=document.createElement('div');panel.className='lorebase-settings-dropdown-panel lorebase-floating-dropdown-panel';panel.setAttribute('role','listbox');wrap.appendChild(panel);
  const floating=attachFloatingPanel(button,panel,wrap);let current=value;
  const render=():void=>{label.textContent=options.find((option)=>option.v===current)?.l??current;panel.innerHTML='';for(const option of options){const item=document.createElement('div');item.className='lorebase-settings-dropdown-option';item.classList.toggle('is-selected',option.v===current);const text=document.createElement('span');text.className='lorebase-settings-dropdown-option-label';text.textContent=option.l;item.appendChild(text);if(option.v===current){const check=document.createElement('span');check.className='lorebase-settings-dropdown-option-check';setIcon(check,'check');item.appendChild(check);}item.onmousedown=(event)=>{event.preventDefault();current=option.v;render();floating.close();onChange(current);};panel.appendChild(item);}};
  button.onclick=(event)=>{event.preventDefault();event.stopPropagation();if(floating.isOpen())floating.close();else{render();floating.open();}};render();return wrap;
}
