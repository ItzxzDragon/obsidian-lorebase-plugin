import { LibraryRegistry } from './LibraryRegistry';
import type { FieldDefinition, FilterOperator, FilterRule, SortSpec } from '../../types';
import type { FilterGroup, FilterNode, UnifiedSavedView } from './unifiedViewState';
import { normalizeEntryFields } from './entry';
import type { LibraryDefinition, OverlayFieldConfig, CustomBadgeLayout } from './types';

export interface PersistedLibraryDefinition extends LibraryDefinition { kind: 'custom'; }

export class LibraryCatalog {
    constructor(private readonly registry: LibraryRegistry, private readonly load: () => unknown | Promise<unknown>, private readonly save: (data: unknown) => void | Promise<void>) {}
    async loadCustomLibraries(): Promise<void> { const raw=await this.load(); if(!Array.isArray(raw))return; for(const value of raw){const d=normalizeCustomLibrary(value);if(d)this.registry.upsert(d);} }
    async saveCustomLibraries(): Promise<void> { await this.save(this.registry.list().filter(isCustomLibrary)); }
    create(definition: Omit<PersistedLibraryDefinition,'kind'>): PersistedLibraryDefinition { const normalized=normalizeCustomLibrary({...definition,kind:'custom'});if(!normalized)throw new Error('Invalid custom library definition');if(this.registry.has(normalized.id))throw new Error(`Library already exists: ${normalized.id}`);this.registry.register(normalized);return normalized; }
    rename(id:string,name:string):PersistedLibraryDefinition{const existing=this.requireCustom(id),normalizedName=name.trim();if(!normalizedName)throw new Error('Library name cannot be empty');const updated={...existing,name:normalizedName};this.registry.upsert(updated);return updated;}
    remove(id:string):boolean{const existing=this.requireCustom(id);this.registry.unregister(existing.id);return true;}
    private requireCustom(id:string):PersistedLibraryDefinition{const d=this.registry.get(id);if(!d||!isCustomLibrary(d))throw new Error(`Custom library not found: ${id}`);return d;}
}
function isCustomLibrary(d:LibraryDefinition):d is PersistedLibraryDefinition{return d.kind==='custom';}
function normalizeCustomLibrary(value:unknown):PersistedLibraryDefinition|null{
    if(!isRecord(value)||value.kind!=='custom')return null;
    const id=typeof value.id==='string'?value.id.trim():'';const name=typeof value.name==='string'?value.name.trim():'';const icon=typeof value.icon==='string'&&value.icon.trim()?value.icon.trim():'library';
    const source = isRecord(value.source) ? value.source : null;
    const folder=source?.kind==='folder'&&typeof source.folder==='string'?source.folder.trim():'';if(!id||!name||!folder)return null;
    const schema=isRecord(value.schema)?value.schema:{};const fields=Array.isArray(schema.fields)?schema.fields.map(normalizeField).filter((f):f is FieldDefinition=>f!==null):[];
    const sorts=normalizeSorts(value.sorts);const filterGroup=normalizeFilterGroup(value.filterGroup);const groupProperty=typeof value.groupProperty==='string'?value.groupProperty.trim():'';const groupDirection=value.groupDirection==='desc'?'desc':'asc';
    const entryFields=normalizeEntryFields(value.entryFields??fields.map(field=>({property:field.id.replace(/^yaml:/,''),type:field.type})));
    return {
        kind:'custom',id,name,icon,source:{kind:'folder',folder},schema:{fields,coverField:typeof schema.coverField==='string'?schema.coverField:undefined,titleField:typeof schema.titleField==='string'?schema.titleField:undefined},entryFields,
        propertyScope:value.propertyScope==='vault'?'vault':'folder',fileNameTemplate:typeof value.fileNameTemplate==='string'?value.fileNameTemplate:undefined,
        orientation:value.orientation==='horizontal'?'horizontal':'vertical',cardSize:['small','medium','large'].includes(String(value.cardSize))?value.cardSize as LibraryDefinition['cardSize']:'medium',columns:normalizePositiveInt(value.columns),
        customCardSize:Boolean(value.customCardSize),customCardMinWidth:normalizePositiveInt(value.customCardMinWidth),customCardMinHeight:normalizePositiveInt(value.customCardMinHeight),customCardImageRatio:normalizePositiveNumber(value.customCardImageRatio),customHorizontalCardMinWidth:normalizePositiveInt(value.customHorizontalCardMinWidth),customHorizontalCardHeight:normalizePositiveInt(value.customHorizontalCardHeight),
        horizontalSideCover:Boolean(value.horizontalSideCover),horizontalImageSide:value.horizontalImageSide==='left'?'left':'right',horizontalImageWidth:normalizeRange(value.horizontalImageWidth,10,80,34),
        favoriteEnabled:Boolean(value.favoriteEnabled),favoriteSubtlePulse:Boolean(value.favoriteSubtlePulse),ratingEnabled:Boolean(value.ratingEnabled),ratingStyle:value.ratingStyle==='star'?'star':'emoji',
        completionDateEnabled:Boolean(value.completionDateEnabled),completionDateProperty:typeof value.completionDateProperty==='string'&&value.completionDateProperty.trim()?value.completionDateProperty.trim():'finished',completionDateFormat:value.completionDateFormat==='full'?'full':'short',
        overlayFields:Array.isArray(value.overlayFields)?value.overlayFields as OverlayFieldConfig[]:[],overlayLayouts:isRecord(value.overlayLayouts)?value.overlayLayouts as Record<'vertical'|'horizontal',OverlayFieldConfig[]>:undefined,badgeLayouts:isRecord(value.badgeLayouts)?value.badgeLayouts as Record<'vertical'|'horizontal',CustomBadgeLayout>:undefined,statusAsIconOnly:Boolean(value.statusAsIconOnly),
        mediaType:normalizeMediaType(value.mediaType),sorts,filterMode:value.filterMode==='or'||value.filterMode==='none'?value.filterMode:filterGroup?.mode??'and',filters:Array.isArray(value.filters)?value.filters.filter(isFilterRule):[],filterGroup,groupProperty:groupProperty||undefined,groupDirection,
        savedViews:Array.isArray(value.savedViews)?value.savedViews as UnifiedSavedView[]:[],activeSavedViewId:typeof value.activeSavedViewId==='string'?value.activeSavedViewId:'',
    };
}
function normalizeField(value:unknown):FieldDefinition|null{if(!isRecord(value))return null;const id=typeof value.id==='string'?value.id.trim():'';const label=typeof value.label==='string'?value.label.trim():'';const type=value.type;if(!id||!label||!['text','number','date','boolean','list'].includes(String(type)))return null;const operators=Array.isArray(value.operators)?value.operators.filter((o):o is FilterOperator=>typeof o==='string'):[];return{id,label,icon:typeof value.icon==='string'&&value.icon?value.icon:'list',type:type as FieldDefinition['type'],source:value.source==='builtin'?'builtin':'yaml',operators,options:Array.isArray(value.options)?value.options.filter(isRecord).filter(o=>typeof o.value==='string'&&typeof o.label==='string').map(o=>({value:o.value as string,label:o.label as string})):undefined};}
function normalizeSorts(value:unknown):SortSpec[]|undefined{if(!Array.isArray(value))return undefined;const result:SortSpec[]=[];for(const entry of value){if(!isRecord(entry))continue;const field=typeof entry.field==='string'?entry.field.trim():typeof entry.property==='string'?entry.property.trim():'';if(!field)continue;const order=entry.order==='desc'||entry.direction==='desc'?'desc':'asc';result.push({field:field as SortSpec['field'],order});}return result;}
function normalizeFilterGroup(value:unknown):FilterGroup|undefined{if(!isRecord(value)||value.kind!=='group'||typeof value.id!=='string')return undefined;const mode=value.mode==='or'||value.mode==='none'?value.mode:'and';const children=Array.isArray(value.children)?value.children.map(normalizeFilterNode).filter((n):n is FilterNode=>n!==null):[];return{kind:'group',id:value.id.trim()||'root',mode,children};}
function normalizeFilterNode(value:unknown):FilterNode|null{if(!isRecord(value))return null;if(value.kind==='group')return normalizeFilterGroup(value)??null;return normalizeFilterRule(value);}
function normalizeFilterRule(value:Record<string,unknown>):FilterRule|null{const id=typeof value.id==='string'?value.id.trim():'';const field=typeof value.field==='string'?value.field.trim():typeof value.property==='string'?value.property.trim():'';const fieldType=value.fieldType,operator=value.operator;if(!id||!field||!['text','number','date','boolean','list'].includes(String(fieldType))||!isFilterOperator(operator))return null;return{id,field,fieldType:fieldType as FilterRule['fieldType'],operator,value:normalizeFilterValue(value.value),valueTo:typeof value.valueTo==='string'||typeof value.valueTo==='number'?value.valueTo:null};}
function normalizeFilterValue(value:unknown):FilterRule['value']{if(Array.isArray(value))return value.filter((v):v is string=>typeof v==='string');if(typeof value==='string'||typeof value==='number'||typeof value==='boolean'||value===null)return value;return null;}
function isFilterOperator(value:unknown):value is FilterOperator{return ['contains','equals','notEquals','empty','notEmpty','greater','less','between','isTrue','isFalse','containsAny','containsAll','notContains','thisMonth','thisYear'].includes(String(value));}
function isFilterRule(value:unknown):value is FilterRule{return isRecord(value)&&typeof value.id==='string'&&typeof value.field==='string'&&isFilterOperator(value.operator);}
function normalizePositiveInt(value:unknown):number|undefined{return typeof value==='number'&&Number.isInteger(value)&&value>0?value:undefined;}
function normalizePositiveNumber(value:unknown):number|undefined{return typeof value==='number'&&Number.isFinite(value)&&value>0?value:undefined;}
function normalizeRange(value:unknown,min:number,max:number,fallback:number):number{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function normalizeMediaType(value:unknown):LibraryDefinition['mediaType']{return ['game','anime','movie','series','book','manga'].includes(String(value))?value as LibraryDefinition['mediaType']:undefined;}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
