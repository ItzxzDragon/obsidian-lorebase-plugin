import type { TFile } from 'obsidian';
import type { FieldDefinition, FilterRule, LibraryFieldType, MediaType, SortOrder, SortSpec } from '../../types';

/** A library item exposed to the shared library/filter/sort/group pipeline. */
export interface LibraryItem {
    file: TFile;
    values: Record<string, unknown>;
}

/** Source of a library's entries. Built-ins and custom folders share one model. */
export type LibrarySource =
    | {
        kind: 'builtin';
        mediaType: MediaType;
    }
    | {
        kind: 'folder';
        folder: string;
    };

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
    /** Explicit origin lets callers treat built-ins and custom libraries uniformly. */
    kind?: LibraryKind;
    source: LibrarySource;
    schema: LibrarySchema;
    /** Scope used when resolving available note properties for the library. */
    propertyScope?: LibraryPropertyScope;
    /** Optional filename template used by entry creation. `%property` variables are supported. */
    fileNameTemplate?: string;
    /** Presentation defaults consumed by the shared LibraryView. */
    orientation?: LibraryOrientation;
    cardSize?: LibraryCardSize;
    columns?: number;
    customCardMinWidth?: number;
    customCardMinHeight?: number;
    customCardImageRatio?: number;
    customHorizontalCardMinWidth?: number;
    customHorizontalCardHeight?: number;
    /** Optional link to one of Lorebase's existing media adapters. */
    mediaType?: MediaType;
    /** Shared View/Filter/Sort/Group defaults for this library. */
    sorts?: SortSpec[];
    filterGroup?: FilterRule[];
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