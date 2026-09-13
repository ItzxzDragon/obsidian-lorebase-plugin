/**
 * LOREBASE - Type Definitions
 * Core type definitions for all media types and plugin settings
 */
import type { App } from 'obsidian';
import type { AnimeService } from '../services/AnimeService';
import type { GameService } from '../services/GameService';
import type { MetadataService } from '../services/MetadataService';
import type { ReadingService } from '../services/ReadingService';
import type { VideoService } from '../services/VideoService';

export type MediaType = 'game' | 'anime' | 'movie' | 'series' | 'book' | 'manga';
export type GameStatus = 'completed' | 'playing' | 'dropped' | 'sandbox' | 'wishlist' | 'not_started';
export type AnimeFormat = 'tv' | 'movie' | 'ova' | 'ona' | 'special';
export type AnimeStatus = 'planned' | 'watching' | 'completed' | 'dropped' | 'paused';
export type VideoStatus = AnimeStatus;
export type ReadingStatus = AnimeStatus;
export type MediaStatus = GameStatus | AnimeStatus;
export type SettingsLayoutMode = 'tabs' | 'accordion';
export type CardClickAction = 'open' | 'edit';
export type StatusLabelSettings = { games: Partial<Record<GameStatus, string>>; anime: Partial<Record<AnimeStatus, string>>; movies: Partial<Record<VideoStatus, string>>; series: Partial<Record<VideoStatus, string>>; books: Partial<Record<ReadingStatus, string>>; manga: Partial<Record<ReadingStatus, string>>; };
interface TagPresetSettings { games: TagPreset[]; }
export interface TagPreset { id: string; label: string; tag: string; icon?: string; }
export type NoteImportWriteMode = 'copy' | 'replace';
export type NoteImportTargetMedia = 'auto' | 'games' | 'anime' | 'movies' | 'series' | 'books' | 'manga';
export interface NoteImportFieldMapping { key: string; aliases: string[]; }
export interface NoteImportSettings { sourceFolderPath: string; targetMedia: NoteImportTargetMedia; writeMode: NoteImportWriteMode; fieldMappings: NoteImportFieldMapping[]; blacklist: string[]; }
export interface AnimePart { id: string; kind: AnimeFormat; title: string; seasonNumber: number | null; episodeCurrent: number | null; episodeTotal: number | null; status: AnimeStatus; }
export interface VideoPart { id: string; kind: 'movie' | 'season'; title: string; seasonNumber: number | null; episodeCurrent: number | null; episodeTotal: number | null; status: VideoStatus; }
export interface MangaPart { id: string; kind: 'volume'; title: string; volumeNumber: number | null; chapterCurrent: number | null; chapterTotal: number | null; status: ReadingStatus; }
export interface RelatedMediaLink { type: MediaType; path: string; title: string; imageUrl?: string | null; }
export type UserRating = 1 | 2 | 3 | 4 | 5 | null;
export interface CommunityRating { provider: string; rating: number | null; votes: number | null; }
export type CardSize = 'small' | 'medium' | 'large';
export type CardOrientation = 'vertical' | 'horizontal';
export type CardStyle = 'hover' | 'progress';
export type SortField = 'name' | 'series' | 'year' | 'rating' | 'dateStarted' | 'dateFinished' | 'dateCompleted' | `yaml:${string}`;
export type SortOrder = 'asc' | 'desc';
export type LibraryFieldType = 'text' | 'number' | 'date' | 'boolean' | 'list';
export type FilterOperator = 'contains' | 'equals' | 'notEquals' | 'empty' | 'notEmpty' | 'greater' | 'less' | 'between' | 'isTrue' | 'isFalse' | 'containsAny' | 'containsAll' | 'notContains' | 'thisMonth' | 'thisYear';
export interface FilterRule { id: string; field: string; fieldType: LibraryFieldType; operator: FilterOperator; value?: string | number | boolean | string[] | null; valueTo?: string | number | null; }
export interface FieldDefinition { id: string; label: string; icon: string; type: LibraryFieldType; source: 'builtin' | 'yaml'; operators: FilterOperator[]; options?: Array<{ value: string; label: string }>; }
export type GroupMode = 'none' | 'series' | 'finishedMonth' | 'finishedYear' | 'field';
export interface GroupSpec { mode: GroupMode; order: SortOrder; field?: string; }
export interface SortSpec { field: SortField; order: SortOrder; }
export interface LibraryViewState { sort: SortSpec; group: GroupSpec; rules: FilterRule[]; tags: string[]; genres: string[]; }
export interface SavedLibraryView { id: string; name: string; state: LibraryViewState; readonly?: boolean; }
export type ViewMode = 'grid' | 'horizontal';
export type Language = 'en' | 'ru' | 'uk';
export type ParticleEffect = 'none' | 'sakura' | 'snow';
type TemplateMode = 'simple' | 'advanced';
export type SteamSyncDuplicateMode = 'skip' | 'update' | 'ask';
export type BadgePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type RatingBadgeMode = 'star' | 'emoji';
export type CompletionDateBadgeFormat = 'short' | 'full';
interface CompletionDateBadgeFormatSettings { games: CompletionDateBadgeFormat; anime: CompletionDateBadgeFormat; movies: CompletionDateBadgeFormat; series: CompletionDateBadgeFormat; books: CompletionDateBadgeFormat; manga: CompletionDateBadgeFormat; }
interface OverlayTextOffset { x: number; y: number; }
interface OverlayTextLayout { title: OverlayTextOffset; year: OverlayTextOffset; format: OverlayTextOffset; description: OverlayTextOffset; }
interface OverlayTextVisibility { title: boolean; year: boolean; format: boolean; description: boolean; }
interface BadgeItemSettings { enabled: boolean; position: BadgePosition; x: number; y: number; }
