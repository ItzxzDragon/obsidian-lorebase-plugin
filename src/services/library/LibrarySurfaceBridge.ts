import type { LibraryViewState, LorebasePluginInterface } from '../../types';
import { LibrarySelector } from '../../components/toolbar/LibrarySelector';
import { LibrarySurfaceController } from './LibrarySurfaceController';
import { LibraryManager } from './LibraryManager';
import { LibraryView } from '../../views/LibraryView';

const INSTALLED = Symbol('lorebase-library-surface-bridge-installed');
const ATTACHED = Symbol('lorebase-library-surface-bridge-attached');

type BridgedView = LibraryView & {
    [INSTALLED]?: boolean;
    [ATTACHED]?: boolean;
    __librarySurfaceController?: LibrarySurfaceController;
    __librarySurfaceObserver?: MutationObserver;
    __librarySurfaceRenderVersion?: number;
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
        await originalOnClose.call(this);
    };
}

function attachLibrarySurfaceBridge(view: BridgedView, manager: LibraryManager): void {
    if (view[ATTACHED]) return;
    view[ATTACHED] = true;

    const plugin = (view as any).plugin as LorebasePluginInterface;
    const controller = new LibrarySurfaceController(manager, plugin.getMediaType());
    view.__librarySurfaceController = controller;
    view.__librarySurfaceRenderVersion = 0;

    const installSelector = (): void => {
        const toolbar = (view as any).toolbar as HTMLElement | null;
        if (!toolbar) return;

        const left = toolbar.querySelector<HTMLElement>('.lorebase-toolbar-left');
        if (!left) return;

        const mediaTrigger = left.querySelector<HTMLElement>('.lorebase-media-trigger');
        if (mediaTrigger) mediaTrigger.style.display = 'none';
        const mediaTray = toolbar.querySelector<HTMLElement>('.lorebase-media-tray');
        if (mediaTray) mediaTray.style.display = 'none';

        if (left.querySelector('.lorebase-library-selector-bridge')) return;

        const host = left.createDiv({ cls: 'lorebase-library-selector-bridge' });
        new LibrarySelector(
            host,
            controller.getOptions(),
            controller.getSelectionId(),
            {
                onSelect: (option) => {
                    void selectLibrary(view, controller, option.id, option.kind === 'custom', plugin);
                },
            },
        ).render();
    };

    installSelector();
    const toolbar = (view as any).toolbar as HTMLElement | null;
    if (toolbar && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => installSelector());
        observer.observe(toolbar, { childList: true, subtree: true });
        view.__librarySurfaceObserver = observer;
    }
}

async function selectLibrary(
    view: BridgedView,
    controller: LibrarySurfaceController,
    id: string,
    custom: boolean,
    plugin: LorebasePluginInterface,
): Promise<void> {
    const option = controller.getOptions().find((candidate) => candidate.id === id);
    if (!option) return;

    if (custom) {
        controller.selectOption(option);
        const version = (view.__librarySurfaceRenderVersion ?? 0) + 1;
        view.__librarySurfaceRenderVersion = version;
        const content = (view as any).libraryContentEl as HTMLElement | null;
        if (!content) return;

        content.empty();
        content.addClass('lorebase-custom-library-active');
        content.createDiv({ cls: 'lorebase-custom-library-loading', text: 'Loading library…' });

        const state = readToolbarViewState(view);
        await controller.renderCurrentCustomLibrary(content, {
            rules: state?.rules ?? [],
            sorts: state ? [state.sort] : [],
            group: state?.group,
            fields: controller.getCurrentCustomFields(),
            onClick: (item) => {
                void openLibraryItem(view, item.file.path);
            },
        });

        if (version !== view.__librarySurfaceRenderVersion) return;
        return;
    }

    controller.selectOption(option);
    const content = (view as any).libraryContentEl as HTMLElement | null;
    content?.removeClass('lorebase-custom-library-active');
    await plugin.switchMediaType(controller.getSelection().kind === 'builtin'
        ? controller.getSelection().mediaType
        : plugin.getMediaType());
}

function readToolbarViewState(view: BridgedView): LibraryViewState | null {
    const toolbar = (view as any).toolbar as Record<string, unknown> | null;
    const state = toolbar?.currentViewState;
    if (!state || typeof state !== 'object') return null;
    return state as LibraryViewState;
}

async function openLibraryItem(view: BridgedView, path: string): Promise<void> {
    const file = view.app.vault.getAbstractFileByPath(path);
    if (!file) return;
    const leaf = view.app.workspace.getLeaf(false);
    await leaf.openFile(file as any);
}
