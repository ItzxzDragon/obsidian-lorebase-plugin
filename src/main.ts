/**
 * LOREBASE - Main Plugin Entry Point
 * v3.0.1
 */

import { Plugin, WorkspaceLeaf, Menu, Notice, addIcon, TFile, type Command } from 'obsidian';
import { CommunityRating, GameDlc, LorebaseSettings, MediaItem, GameStats, AnimeStats, MediaType, RelatedMediaLink, IntegrationTemplateSettings } from './types';
import { DEFAULT_SETTINGS, VIEW_TYPE_LIBRARY, LOREBASE_ICON_ID, LOREBASE_ICON_SVG, DEFAULT_COVER, PARTICLE_INTENSITY_MAX, PARTICLE_INTENSITY_MIN } from './constants';
import { i18n, t, type TranslationKey } from './localization';
import { LibraryView } from './views/LibraryView';
import { LorebaseSettingTab } from './settings/SettingsTab';
import { EditModal } from './modals/EditModal';
import { AnimeEditModal } from './modals/AnimeEditModal';
import { VideoEditModal } from './modals/VideoEditModal';
import { ReadingEditModal } from './modals/ReadingEditModal';
import { StatsModal } from './modals/StatsModal';
import { DeleteModal } from './modals/DeleteModal';
import { SteamSyncReviewModal } from './modals/SteamSyncReviewModal';
import { SteamSyncProgressModal } from './modals/SteamSyncProgressModal';
import { NoteImportReviewModal } from './modals/NoteImportReviewModal';
import { GameService } from './services/GameService';
import { AnimeService } from './services/AnimeService';
import { VideoService } from './services/VideoService';
import { ReadingService } from './services/ReadingService';
import { ParticleService } from './services/ParticleService';
import { IntegrationService } from './services/IntegrationService';
import { SteamSyncService } from './services/SteamSyncService';
import { MetadataService } from './services/MetadataService';
import { NoteConversionService } from './services/NoteConversionService';
import { LibraryManager } from './services/library/LibraryManager';
import {
    mergeOverlayLayout,
    mergeOverlayVisibility,
    migrateLegacyJikanMangaSettings,
    normalizeDescriptionLines,
    normalizeLibraryViewSettings,
    normalizeNoteImportSettings,
    normalizeTagPresets,
    parseBadges,
} from './settings/settingsNormalization';
import { parseRelatedMedia } from './services/media/parsers';
import type { MediaKind, MediaSourceSelection } from './services/integrations/types';
import { buildSimpleTemplate, getDefaultTemplateFields, getEffectiveSimpleTemplateFields } from './services/integrations/templateUtils';
import { mediaTypeToKind, synchronizeProviderMetadata } from './services/integrations/enrichment';

// =============================================================================
// LOREBASE PLUGIN
// =============================================================================

/**
 * Main plugin class
 */
export default class LorebasePlugin extends Plugin {
    settings: LorebaseSettings = DEFAULT_SETTINGS;
    private gameService: GameService | null = null;
    private animeService: AnimeService | null = null;
    private movieService: VideoService | null = null;
    private seriesService: VideoService | null = null;
    private bookService: ReadingService | null = null;
    private mangaService: ReadingService | null = null;
    private libraryManager: LibraryManager | null = null;
    private mediaType: MediaType = 'game';
    private particleService: ParticleService | null = null;
    private integrationService: IntegrationService | null = null;
    private steamSyncService: SteamSyncService | null = null;
    private steamSyncRunning = false;
    private metadataService: MetadataService | null = null;
    private noteConversionService: NoteConversionService | null = null;
    private readonly localizedCommands: Array<{ command: Command; key: TranslationKey }> = [];

    async onload(): Promise<void> {
        // Load settings
        await this.loadSettings();
        this.normalizeMediaType();

        // Initialize localization
        i18n.setLanguage(this.settings.language);

        // Initialize game service
        this.metadataService = new MetadataService(this.app);
        this.gameService = new GameService(this.app, this.metadataService);
        this.gameService.setFolderPath(this.settings.games.folderPath);
        this.animeService = new AnimeService(this.app, this.metadataService);
        this.animeService.setFolderPath(this.settings.anime.folderPath);
        this.movieService = new VideoService(this.app, 'movie', this.settings.movies.folderPath, this.metadataService);
        this.seriesService = new VideoService(this.app, 'series', this.settings.series.folderPath, this.metadataService);
        this.bookService = new ReadingService(this.app, 'book', this.settings.books.folderPath, this.metadataService);
        this.mangaService = new ReadingService(this.app, 'manga', this.settings.manga.folderPath, this.metadataService);
        this.libraryManager = new LibraryManager(
            this.app,
            () => this.loadData(),
            (data) => this.saveData(data),
        );
        await this.libraryManager.load();
        this.integrationService = new IntegrationService(this.app, () => this.settings, () => {
            void this.runSteamSync();
        });
        this.steamSyncService = new SteamSyncService(this.app, this.metadataService);
        this.noteConversionService = new NoteConversionService(this.app);
        addIcon(LOREBASE_ICON_ID, LOREBASE_ICON_SVG);

        // Register the library view
        this.registerView(
            VIEW_TYPE_LIBRARY,
            (leaf) => new LibraryView(leaf, this)
        );

        // Add ribbon icon
        this.addRibbonIcon(LOREBASE_ICON_ID, t('ribbonLibrary'), (evt: MouseEvent) => {
            this.showLibraryMenu(evt);
        });

        // Add command to open library
        this.addLocalizedCommand('commandOpenLibrary', {
            id: 'open-library',
            callback: () => {
                void this.activateView();
            }
        });

        this.registerOpenLibraryCommands();

        this.addLocalizedCommand('commandAddGame', {
            id: 'add-game',
            callback: () => {
                void this.integrationService?.addGame();
            }
        });

        this.addLocalizedCommand('commandAddAnime', {
            id: 'add-anime',
            callback: () => {
                void this.integrationService?.addAnime();
            }
        });

        this.addLocalizedCommand('commandAddMovie', {
            id: 'add-movie',
            callback: () => {
                void this.integrationService?.addMovie();
            }
        });

        this.addLocalizedCommand('commandAddSeries', {
            id: 'add-series',
            callback: () => {
                void this.integrationService?.addSeries();
            }
        });

        this.addLocalizedCommand('commandAddBook', {
            id: 'add-book',
            callback: () => {
                void this.integrationService?.addBook();
            }
        });

        this.addLocalizedCommand('commandAddManga', {
            id: 'add-manga',
            callback: () => {
                void this.integrationService?.addManga();
            }
        });

        this.addLocalizedCommand('commandSteamSync', {
            id: 'steam-sync',
            callback: () => {
                void this.runSteamSync();
            }
        });

        this.addLocalizedCommand('commandImportNotes', {
            id: 'import-existing-notes',
            callback: () => {
                void this.runNoteImport();
            }
        });

        // Register settings tab
        this.addSettingTab(new LorebaseSettingTab(this.app, this));

        // Apply accent color on load
        this.applyAccentColor();
        this.applyParticles();

        if (this.settings.steamSync.autoSyncPlaytimeOnStartup && this.settings.steamSync.steamId) {
            void this.runSteamPlaytimeSync();
        }
    }

    onunload(): void {
        this.gameService = null;
        this.animeService = null;
        this.movieService = null;
        this.seriesService = null;
        this.bookService = null;
        this.mangaService = null;
        this.libraryManager = null;

        if (this.particleService) {
            this.particleService.destroy();
            this.particleService = null;
        }

        this.integrationService = null;
        this.steamSyncService = null;
        this.metadataService = null;
        this.noteConversionService = null;
    }

    getLibraryManager(): LibraryManager | null {
        return this.libraryManager;
    }
