import type { WorkspaceLeaf } from 'obsidian';
import { CustomLibraryPane } from '../components/CustomLibraryPane';
import { LibraryView } from './LibraryView';
import type { LorebasePluginInterface } from '../types';

/**
 * Library view shell that keeps the existing media library intact while exposing
 * custom folder libraries through the shared library pipeline.
 */
export class CustomLibraryView extends LibraryView {
    private customLibraryPane: CustomLibraryPane | null = null;
    private builtinContent: HTMLElement | null = null;
    private readonly lorebasePlugin: LorebasePluginInterface;

    constructor(leaf: WorkspaceLeaf, plugin: LorebasePluginInterface) {
        super(leaf, plugin);
        this.lorebasePlugin = plugin;
    }

    async onOpen(): Promise<void> {
        await super.onOpen();

        const manager = this.lorebasePlugin.getLibraryManager();
        if (!manager) return;

        this.builtinContent = this.contentEl.querySelector<HTMLElement>('.lorebase-content');
        const host = this.contentEl.createDiv({ cls: 'lorebase-custom-library-host' });
        this.customLibraryPane = new CustomLibraryPane(this.app, manager, host, {
            onActiveLibraryChange: (libraryId) => this.setBuiltinContentVisible(libraryId === null),
        });
    }

    async onClose(): Promise<void> {
        this.customLibraryPane?.destroy();
        this.customLibraryPane = null;
        this.builtinContent = null;
        await super.onClose();
    }

    private setBuiltinContentVisible(visible: boolean): void {
        if (!this.builtinContent) return;
        this.builtinContent.toggleClass('is-hidden', !visible);
        this.builtinContent.setAttribute('aria-hidden', String(!visible));
    }
}
