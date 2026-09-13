import type { TFile } from 'obsidian';
import type { FieldDefinition, LibraryFieldType, MediaType, SortOrder, SortSpec } from '../../types';
import type { FilterGroup } from './unifiedViewState';

/** A library item exposed to the shared library/filter/sort/group pipeline. */
export interface LibraryItem {
    file: TFile;
    values: Record<string, unknown>;
}

/** Source of a library's entries. Built-ins and custom folders share one model. */
export type LibrarySource =
    | { kind: 'builtin'; mediaType: MediaType; }
    | { kind: 'folder'; folder: string; };

export type LibraryPropertyScope = 'folder' | 'vault';
export type LibraryOrientation = 'vertical' | 'horizontal';
export type LibraryCardSize = 'small' | 'medium' | 'large';
export type LibraryKind = 'builtin' | 'custom';

/** Minimal schema required by the generic library layer. */
export interface LibrarySchema {
    fields: FieldDefinition[];
    coverField?: string;
    titleField?: string;
}

/** Runtime definition shared by built-in and custom libraries. */
export interface LibraryDefinition {
    id: string;
    name: string;
    icon: string;
    kind?: LibraryKind;
    source: LibrarySource;
    schema: LibrarySchema;
    propertyScope?: LibraryPropertyScope;
    fileNameTemplate?: string;
    orientation?: LibraryOrientation;
    cardSize?: LibraryCardSize;
    columns?: number;
    customCardMinWidth?: number;
    customCardMinHeight?: number;
    customCardImageRatio?: number;
    customHorizontalCardMinWidth?: number;
    customHorizontalCardHeight?: number;
    mediaType?: MediaType;
    /** Full nested filter tree used by the shared Library surface. */
    filterGroup?: FilterGroup;
    /** Multi-sort defaults, evaluated left-to-right. */
    sorts?: SortSpec[];
    /** Arbitrary property grouping and its direction. */
    groupProperty?: string;
    groupDirection?: SortOrder;
}

/** Field definition helper for schema authors. */
export interface LibraryFieldInput {
    id: string;
    label: string;
    icon?: string;
    type: LibraryFieldType;
    source?: 'builtin' | 'yaml';
}
