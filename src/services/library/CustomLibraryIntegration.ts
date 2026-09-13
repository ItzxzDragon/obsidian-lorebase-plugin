import type { App } from 'obsidian';
import { CustomLibraryPane } from '../../components/CustomLibraryPane';
import type { LibraryManager } from './LibraryManager';

/** Bridges the existing LibraryView DOM to the custom-library UI without replacing the built-in view. */
export class CustomLibraryIntegration {
    private readonly panes = new WeakMap<HTMLElement, CustomLibraryPane>();
    private observer: MutationObserver | null = null;
    private scanQueued = false;

    constructor(
        private readonly app: App,
        private readonly manager: LibraryManager,
    ) {}

    start(): void {
        if (this.observer || typeof document === 'undefined' || typeof MutationObserver === 'undefined' || !document.body) return;
        this.observer = new MutationObserver(() => this.queueScan());
        this.observer.observe(document.body, { childList: true, subtree: true });
        this.scan();
    }

    private queueScan(): void {
        if (this.scanQueued) return;
        this.scanQueued = true;
        window.requestAnimationFrame(() => {
            this.scanQueued = false;
            this.scan();
        });
    }

    private scan(): void {
        if (typeof document === 'undefined') return;
        document.querySelectorAll<HTMLElement>('.lorebase-view').forEach((view) => {
            if (this.panes.has(view)) return;
            const builtinContent = view.querySelector<HTMLElement>('.lorebase-content');
            if (!builtinContent) return;

            const host = view.createDiv({ cls: 'lorebase-custom-library-host' });
            const pane = new CustomLibraryPane(this.app, this.manager, host, {
                onActiveLibraryChange: (libraryId) => {
                    builtinContent.toggleClass('is-hidden', libraryId !== null);
                    builtinContent.setAttribute('aria-hidden', String(libraryId !== null));
                },
            });
            this.panes.set(view, pane);
        });
    }
}
