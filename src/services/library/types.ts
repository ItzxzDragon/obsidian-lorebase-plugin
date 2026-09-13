import type { TFile } from 'obsidian';
import type { FieldDefinition, LibraryFieldType, MediaType } from '../../types';

/** A library item exposed to the shared view/filter/sort/group pipeline. */
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
    source: LibrarySource;
    schema: LibrarySchema;
    /** Optional link to one of Lorebase's existing media adapters. */
    mediaType?: MediaType;
}

/** Field definition helper for schema authors. */
export interface LibraryFieldInput {
    id: string;
    label: string;
    icon?: string;
    type: LibraryFieldType;
    source?: 'builtin' | 'yaml';
}
