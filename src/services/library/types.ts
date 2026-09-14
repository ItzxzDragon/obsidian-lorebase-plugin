import type { TFile } from 'obsidian';
import type { FieldDefinition, LibraryFieldType, MediaType, SortOrder, SortSpec } from '../../types';
import type { FilterGroup, UnifiedSavedView } from './unifiedViewState';
import type { EntryFieldConfig } from './entry';

export interface LibraryItem { file: TFile; values: Record<string, unknown>; }
export type LibrarySource = { kind: 'builtin'; mediaType: MediaType } | { kind: 'folder'; folder: string };
export type LibraryPropertyScope = 'folder' | 'vault';
export type LibraryOrientation = 'vertical' | 'horizontal';
export type LibraryCardSize = 'small' | 'medium' | 'large';
export type LibraryKind = 'builtin' | 'custom';
export type CompletionDateFormat = 'short' | 'full';
export type RatingStyle = 'emoji' | 'star';
export type HorizontalImageSide = 'left' | 'right';
export type BadgeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export interface BadgePlacement { corner: BadgeCorner; offsetX: number; offsetY: number; }
export interface CustomBadgeLayout { favorite: BadgePlacement; rating: BadgePlacement; completion: BadgePlacement; }
export type OverlayTextRole = 'title' | 'description' | 'text';
export interface OverlayFieldConfig { id: string; property: string; role: OverlayTextRole; x: number; y: number; width: number; height: number; fontSize: number; fontWeight: number; }

export interface LibrarySchema { fields: FieldDefinition[]; coverField?: string; titleField?: string; }

export interface LibraryDefinition {
    id: string; name: string; icon: string; kind?: LibraryKind; source: LibrarySource; schema: LibrarySchema;
    propertyScope?: LibraryPropertyScope; fileNameTemplate?: string; entryFields?: EntryFieldConfig[];
    orientation?: LibraryOrientation; cardSize?: LibraryCardSize; columns?: number;
    customCardSize?: boolean; customCardMinWidth?: number; customCardMinHeight?: number; customCardImageRatio?: number;
    customHorizontalCardMinWidth?: number; customHorizontalCardHeight?: number;
    horizontalSideCover?: boolean; horizontalImageSide?: HorizontalImageSide; horizontalImageWidth?: number;
    favoriteEnabled?: boolean; favoriteSubtlePulse?: boolean; ratingEnabled?: boolean; ratingStyle?: RatingStyle;
    completionDateEnabled?: boolean; completionDateProperty?: string; completionDateFormat?: CompletionDateFormat;
    overlayFields?: OverlayFieldConfig[]; overlayLayouts?: Record<LibraryOrientation, OverlayFieldConfig[]>;
    badgeLayouts?: Record<LibraryOrientation, CustomBadgeLayout>; statusAsIconOnly?: boolean;
    mediaType?: MediaType; filterMode?: 'and' | 'or' | 'none'; filters?: import('../../types').FilterRule[];
    filterGroup?: FilterGroup; sorts?: SortSpec[]; groupProperty?: string; groupDirection?: SortOrder;
    savedViews?: UnifiedSavedView[]; activeSavedViewId?: string;
}

export interface LibraryFieldInput { id: string; label: string; icon?: string; type: LibraryFieldType; source?: 'builtin' | 'yaml'; }
