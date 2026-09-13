import { LibrarySelector } from '../../components/toolbar/LibrarySelector';
import { CustomLibraryEntryModal } from '../../modals/CustomLibraryEntryModal';
import { LibrarySurfaceController } from './LibrarySurfaceController';
import { createEmptyFilterGroup } from './unifiedViewState';
import type { LibraryManager } from './LibraryManager';
import { LibraryView } from '../../views/LibraryView';

const INSTALLED = Symbol('lorebase-library-surface-bridge-installed');
const ATTACHED = Symbol('lorebase-library-surface-bridge-attached');

type BridgedView = LibraryView & {
    [INSTALLED]?: boolean;
    [ATTACHED]?: boolean;
    __librarySurfaceController?: LibrarySurfaceController;
    __librarySurfaceObserver?: MutationObserver;
    __librarySurfaceRenderVersion?: number;
    __librarySurfaceAddButton?: HTMLButtonElement;
};

type BridgePlugin = {
    getMediaType: () => string;
    switchMediaType?: (mediaType: string) => void | Promise<void>;
};

/** Installs the shared Library selector/surface bridge without creating a second view. */
export function installLibrarySurfaceBridge(manager: LibraryManager): void {
    const prototype = LibraryView.prototype as BridgedView;
    if (prototype[INSTALLED]) return;
    prototype[INSTALLED] = true;
    const originalOnOpen = LibraryView.prototype.onOpen;
    const originalOnClose = LibraryView.prototype.onClose;
    LibraryView.prototype.onOpen = async function bridgedOnOpen(this: BridgedView): Promise<void> {
        await originalOnOpen.call(this);
        if ((this as any).isDestroyed) return;
        attachLibrarySurfaceBridge(this, manager);
    };
    LibraryView.prototype.onClose = async function bridgedOnClose(this: BridgedView): Promise<void> {
        this.__librarySurfaceObserver?.disconnect();
        this.__librarySurfaceObserver = undefined;
        this.__librarySurfaceController = undefined;
        this.__librarySurfaceAddButton = undefined;
        this[ATTACHED] = false;
        await originalOnClose.call(this);
    };
}

function attachLibrarySurfaceBridge(view: BridgedView, manager: LibraryManager): void {
    if (view[ATTACHED]) return;
    view[ATTACHED] = true;
    const plugin = (view as any).plugin as BridgePlugin;
    const controller = new LibrarySurfaceController(manager, plugin.getMediaType() as any);
    view.__librarySurfaceController = controller;
    view.__librarySurfaceRenderVersion = 0;

    const installSelector = (): void => {
        const toolbar = (view as any).toolbar as HTMLElement | null;
        if (!toolbar) return;
        const left = toolbar.querySelector<HTMLElement>('.lorebase-toolbar-left');
        if (!left) return;
        const mediaTrigger = left.querySelector<HTMLElement>('.lorebase-media-trigger');
        if (mediaTrigger) mediaTrigger.style.display = '';
        const mediaTray = toolbar.querySelector<HTMLElement>('.lorebase-media-tray');
        if (mediaTray) mediaTray.style.display = '';
        if (!left.querySelector('.lorebase-library-selector-bridge')) {
            const host = left.createDiv({ cls: 'lorebase-library-selector-bridge' });
            new LibrarySelector(host, controller.getOptions(), controller.getSelectionId(), {
                onSelect: (option) => void selectLibrary(view, controller, option.id, option.kind === 'custom', plugin),
            }).render();
        }
        installCustomEntryAddButton(view, controller, manager, toolbar);
    };
    installSelector();
    const toolbar = (view as any).toolbar as HTMLElement | null;
    if (toolbar && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => installSelector());
        observer.observe(toolbar, { childList: true, subtree: true });
        view.__librarySurfaceObserver = observer;
    }
}

function installCustomEntryAddButton(view: BridgedView, controller: LibrarySurfaceController, manager: LibraryManager, toolbar: HTMLElement): void {
    const addButton = toolbar.querySelector<HTMLButtonElement>('.lorebase-add-btn');
    if (!addButton || view.__librarySurfaceAddButton === addButton) return;
    view.__librarySurfaceAddButton = addButton;
    addButton.addEventListener('click', (event) => {
        if (controller.getCurrentDefinition()?.kind !== 'custom') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const definition = controller.getCurrentDefinition();
        if (definition?.kind === 'custom') void openCustomEntryModal(view, manager, definition.id);
    }, true);
}

async function openCustomEntryModal(view: BridgedView, manager: LibraryManager, libraryId: string): Promise<void> {
    const definition = manager.getLibrary(libraryId);
    if (!definition || definition.kind !== 'custom') return;
    const items = await manager.loadItems(libraryId);
    if ((view as any).isDestroyed) return;
    new CustomLibraryEntryModal(view.app, definition, items, async (values) => {
        await manager.createCustomLibraryEntry(libraryId, values);
        const controller = view.__librarySurfaceController;
        const content = (view as any).libraryContentEl as HTMLElement | null;
        if (!controller || !content) return;
        await controller.renderCurrentCustomLibrary(content, {
            rules: definition.filterGroup ?? createEmptyFilterGroup(),
            sorts: definition.sorts ?? [],
            group: definition.groupProperty
                ? { mode: 'field', field: definition.groupProperty, order: definition.groupDirection ?? 'asc' }
                : { mode: 'none', order: 'asc' },
            fields: definition.schema.fields,
            onClick: (item) => void openLibraryItem(view, item.file.path),
        });
    }).open();
}

async function selectLibrary(view: BridgedView, controller: LibrarySurfaceController, id: string, custom: boolean, plugin: BridgePlugin): Promise<void> {
    const option = controller.getOptions().find((candidate) => candidate.id === id);
    if (!option) return;
    controller.selectOption(option);
    const version = (view.__librarySurfaceRenderVersion ?? 0) + 1;
    view.__librarySurfaceRenderVersion = version;
    const content = (view as any).libraryContentEl as HTMLElement | null;
    if (custom) {
        if (!content) return;
        content.empty();
        content.addClass('lorebase-custom-library-active');
        content.createDiv({ cls: 'lorebase-custom-library-loading', text: 'Loading library…' });
        const definition = controller.getCurrentDefinition();
        if (!definition || definition.kind !== 'custom') return;
        await controller.renderCurrentCustomLibrary(content, {
            rules: definition.filterGroup ?? createEmptyFilterGroup(),
            sorts: definition.sorts ?? [],
            group: definition.groupProperty
                ? { mode: 'field', field: definition.groupProperty, order: definition.groupDirection ?? 'asc' }
                : { mode: 'none', order: 'asc' },
            fields: definition.schema.fields,
            onClick: (item) => void openLibraryItem(view, item.file.path),
        });
        if (version !== view.__librarySurfaceRenderVersion) return;
        return;
    }
    content?.removeClass('lorebase-custom-library-active');
    const mediaType = option.definition.source.kind === 'builtin' ? option.definition.source.mediaType : undefined;
    if (mediaType && plugin.switchMediaType) await plugin.switchMediaType(mediaType);
}

async function openLibraryItem(view: BridgedView, path: string): Promise<void> {
    const file = view.app.vault.getAbstractFileByPath(path);
    if (!file) return;
    const leaf = view.app.workspace.getLeaf(false);
    await leaf.openFile(file as any);
}
