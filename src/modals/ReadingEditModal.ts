import { App, Menu, Modal, setIcon, TFile } from 'obsidian';
import { DEFAULT_COVER, STATUS_CONFIG } from '../constants';
import { i18n, t } from '../localization';
import { BookItem, MangaItem, MangaPart, ReadingItem, ReadingStatus, RelatedMediaLink, UserRating } from '../types';
import { GenreEditModal } from './GenreEditModal';
import { CommunityRatingRefresh, renderCommunityRatingPanel } from './CommunityRatingPanel';
import { MediaSourceAction, renderMediaSourcePanel } from './MediaSourcePanel';
import { setupMobileEditor } from './mobileEditor';
import { bindSourceUrlButton } from './sourceUrlButton';
import { extractMarkdownSection } from '../services/markdownSections';
import { RelatedMediaEditor } from './RelatedMediaEditor';
import { HierarchicalDatePicker, validateDatePickers } from './HierarchicalDatePicker';
import { normalizeProgress, stepProgress } from '../utils/progress';

type ReadingUpdates = Partial<ReadingItem> & Record<string, unknown>;
type NotesMode = 'description' | 'myNotes';

export function normalizeReadingProgress(value: number | null, total: number | null): number | null {
    return normalizeProgress(value, total);
}

export function stepReadingProgress(current: number | null, delta: number, total: number | null): number | null {
    return stepProgress(current, delta, total);
}

export class ReadingEditModal extends Modal {
    private item: ReadingItem;
    private onSave: (updates: ReadingUpdates) => Promise<void>;
    private onDelete: () => void;
    private onRefreshCommunityRating?: CommunityRatingRefresh;

    private title: string;
    private poster: string;
    private horizontalPoster: string;
    private year: number | null;
    private selectedStatus: ReadingStatus;
    private selectedRating: UserRating;
    private favorite: boolean;
    private isAdult: boolean;
    private summary: string;
    private myNotes = '';
    private notesMode: NotesMode = 'description';
    private notesExpanded = false;
    private started: string;
    private finished: string;
    private sourceUrl: string;
    private genres: string[];
    private tags: string[];
    private authors: string[];
    private publisher: string;
    private releaseDate: string;
    private artists: string[];
    private pageCurrent: number | null;
    private pageTotal: number | null;
    private bookChapterCurrent: number | null;
    private bookChapterTotal: number | null;
    private chapterCurrent: number | null;
    private chapterTotal: number | null;
    private volumeCurrent: number | null;
    private volumeTotal: number | null;
    private parts: MangaPart[];
    private activePartId: string | null;
    private relatedMediaEditor: RelatedMediaEditor;
    private startedDatePicker?: HierarchicalDatePicker;
    private finishedDatePicker?: HierarchicalDatePicker;
    private releaseDatePicker?: HierarchicalDatePicker;

    private onKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.close();
            return;
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            void this.save();
        }
    };

    constructor(
        app: App,
        item: ReadingItem,
        onSave: (updates: ReadingUpdates) => Promise<void>,
        onDelete: () => void,
        onRefreshCommunityRating?: CommunityRatingRefresh,
        relatedCandidates: RelatedMediaLink[] = [],
        incomingRelated: RelatedMediaLink[] = [],
        private readonly onRefreshSource?: MediaSourceAction,
        private readonly onChangeSource?: MediaSourceAction
    ) {
        super(app);
        this.item = item;
        this.onSave = onSave;
        this.onDelete = onDelete;
        this.onRefreshCommunityRating = onRefreshCommunityRating;

        this.title = item.displayName;
        this.poster = item.imageUrl;
        this.horizontalPoster = item.horizontalImageUrl ?? '';
        this.year = item.year;
        this.selectedStatus = item.status;
        this.selectedRating = item.userRating;
        this.favorite = item.favorite;
        this.isAdult = item.type === 'manga' && item.isAdult;
        this.summary = item.type === 'book' ? item.summary : item.description;
        this.started = this.normalizeDateInput(item.started);
        this.finished = this.normalizeDateInput(item.finished);
        this.sourceUrl = item.sourceUrl ?? '';
        this.genres = this.normalizeList(item.genres);
        this.tags = this.normalizeList(item.tags);
        this.authors = this.normalizeList(item.authors);
        this.publisher = item.type === 'book' ? item.publisher ?? '' : '';
        this.releaseDate = item.type === 'book' ? this.normalizeDateInput(item.releaseDate) : '';
        this.artists = item.type === 'manga' ? this.normalizeList(item.artists) : [];
        this.pageCurrent = item.type === 'book' ? item.pageCurrent : null;
        this.pageTotal = item.type === 'book' ? item.pageTotal : null;
        this.bookChapterCurrent = item.type === 'book' ? item.chapterCurrent : null;
        this.bookChapterTotal = item.type === 'book' ? item.chapterTotal : null;
        this.chapterCurrent = item.type === 'manga' ? item.chapterCurrent : null;
        this.chapterTotal = item.type === 'manga' ? item.chapterTotal : null;
        this.volumeCurrent = item.type === 'manga' ? item.volumeCurrent : null;
        this.volumeTotal = item.type === 'manga' ? item.volumeTotal : null;
        this.parts = item.type === 'manga' ? (item.parts ?? []).map((part) => ({ ...part })) : [];
        this.activePartId = item.type === 'manga' ? item.activePartId ?? this.parts[0]?.id ?? null : null;
        this.relatedMediaEditor = new RelatedMediaEditor(
            app,
            item.filePath,
            item.relatedMedia ?? [],
            relatedCandidates,
            incomingRelated
        );
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('lorebase-edit-modal', 'lorebase-modal-root');
        this.modalEl.addClass('lorebase-edit-modal-container');
        this.modalEl.addClass('lorebase-editmode-modal-shell');
        this.modalEl.addEventListener('keydown', this.onKeydown);

        const root = contentEl.createDiv({ cls: 'lorebase-editmode-root lorebase-editmode-reading-root lorebase-modal-panel' });
        root.appendChild(this.createTemplateFragment(this.buildTemplate()));
        this.bindHeader(root);
        this.bindQuickSettings(root);
        this.bindFields(root);
        this.bindNotesDisclosure(root);
        this.bindPlayDates(root);
        this.bindNotes(root);
        void this.loadMyNotes(root);
        bindSourceUrlButton(root);
        this.bindStatus(root);
        this.bindRating(root);
        this.bindProgress(root);
        this.relatedMediaEditor.bind(root);
        this.renderGenreChips(root);
        this.renderTagChips(root);
        this.updateDates(root);
        this.updateCharCount(root);
        this.updateNotesDisclosureUI(root);
        this.updateNotesModeUI(root);
        if (this.item.type !== 'book' && this.onRefreshCommunityRating) {
            renderCommunityRatingPanel(root, this.item, this.onRefreshCommunityRating);
        }
        renderMediaSourcePanel(root, this.item, this.onRefreshSource, this.onChangeSource);
        setupMobileEditor(root, () => void this.save());
    }

    onClose(): void {
        this.startedDatePicker?.destroy();
        this.finishedDatePicker?.destroy();
        this.releaseDatePicker?.destroy();
        this.startedDatePicker = undefined;
        this.finishedDatePicker = undefined;
        this.releaseDatePicker = undefined;
        this.modalEl.removeEventListener('keydown', this.onKeydown);
        this.contentEl.empty();
        this.modalEl.removeClass('lorebase-editmode-modal-shell');
    }
