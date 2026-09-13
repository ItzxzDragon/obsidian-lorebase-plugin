import { App, Modal, Notice, setIcon } from 'obsidian';
import { buildEntryMarkdown, effectiveEntryKind, inferPropertyKinds, parseEntryValue, renderFileNameTemplate, type PropertyKind } from '../services/library/entry';
import type { LibraryDefinition, LibraryItem } from '../services/library/types';

export class CustomLibraryEntryModal extends Modal {
    private readonly values: Record<string, string> = {};
    private readonly fields: Array<{ property: string; label: string; kind: PropertyKind }>;
    private readonly inferred: Record<string, PropertyKind>;
    private resolved = false;

    constructor(
        app: App,
        private readonly library: LibraryDefinition,
        items: LibraryItem[],
        private readonly onCreate: (values: Record<string, string>) => Promise<void>,
    ) {
        super(app);
        this.inferred = inferPropertyKinds(items.map((item) => item.values));
        const configured = library.entryFields ?? [];
        this.fields = configured.map((field) => {
            const kind = effectiveEntryKind(field.property, library, this.inferred);
            const schemaField = library.schema.fields.find((candidate) => candidate.id.replace(/^yaml:/, '') === field.property);
            return { property: field.property, label: schemaField?.label ?? field.property, kind };
        });
    }

    onOpen(): void {
        this.modalEl.addClass('lorebase-custom-entry-modal');
        const { contentEl } = this;
        contentEl.empty();

        const header = contentEl.createDiv({ cls: 'lorebase-select-header' });
        const titleRow = header.createDiv({ cls: 'lorebase-select-title-row' });
        const icon = titleRow.createSpan({ cls: 'lorebase-select-title-icon' });
        setIcon(icon, this.library.icon || 'file-plus-2');
        titleRow.createEl('h2', { cls: 'lorebase-select-title', text: `New ${this.library.name} Entry` });

        const body = contentEl.createDiv({ cls: 'lorebase-custom-entry-body' });
        if (this.fields.length === 0) {
            body.createDiv({ cls: 'lorebase-dropdown-empty', text: 'This library has no entry fields configured.' });
        } else {
            for (const field of this.fields) this.renderField(body, field);
        }

        const preview = body.createDiv({ cls: 'lorebase-custom-entry-preview' });
        preview.createDiv({ cls: 'lorebase-manual-section-title', text: 'File name' });
        const previewValue = preview.createDiv({ cls: 'lorebase-custom-entry-preview-value' });
        const updatePreview = (): void => {
            const parsed = this.getParsedValues();
            const name = this.library.fileNameTemplate?.trim()
                ? renderFileNameTemplate(this.library.fileNameTemplate, parsed)
                : String(parsed[this.fields[0]?.property ?? ''] ?? 'Untitled').trim() || 'Untitled';
            previewValue.setText(`${name}.md`);
        };
        for (const input of body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) {
            input.addEventListener('input', updatePreview);
        }
        updatePreview();

        const footer = contentEl.createDiv({ cls: 'lorebase-modal-actions lorebase-select-footer' });
        const cancel = this.createButton(footer, 'x', 'Cancel', 'secondary');
        const create = this.createButton(footer, 'check', 'Create Entry', 'primary');
        cancel.addEventListener('click', () => this.close());
        create.addEventListener('click', () => void this.submit());
    }

    onClose(): void {
        this.modalEl.removeClass('lorebase-custom-entry-modal');
        if (!this.resolved) this.resolved = true;
        this.contentEl.empty();
    }

    private renderField(parent: HTMLElement, field: { property: string; label: string; kind: PropertyKind }): void {
        const label = parent.createEl('label', { cls: 'lorebase-editmode-field' });
        label.createSpan({ cls: 'lorebase-editmode-field-label', text: field.label });
        if (field.kind === 'multiline') {
            const input = label.createEl('textarea', { cls: 'lorebase-editmode-input' });
            input.rows = 3;
            input.value = this.values[field.property] ?? '';
            input.addEventListener('input', () => this.values[field.property] = input.value);
            return;
        }
        const type = field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : field.kind === 'boolean' ? 'checkbox' : 'text';
        const input = label.createEl('input', { cls: 'lorebase-editmode-input', attr: { type } });
        if (type === 'checkbox') {
            input.checked = this.values[field.property] === 'true';
            input.addEventListener('change', () => this.values[field.property] = input.checked ? 'true' : 'false');
        } else {
            input.value = this.values[field.property] ?? '';
            input.addEventListener('input', () => this.values[field.property] = input.value);
        }
    }

    private async submit(): Promise<void> {
        try {
            const parsed = this.getParsedValues();
            if (this.fields.length > 0 && Object.values(parsed).every((value) => value === '')) {
                new Notice('Enter at least one value.');
                return;
            }
            const markdown = buildEntryMarkdown(parsed);
            if (!markdown) return;
            await this.onCreate({ ...this.values });
            this.resolved = true;
            this.close();
        } catch (error) {
            console.error('Failed to create custom library entry:', error);
            new Notice(error instanceof Error ? error.message : 'Failed to create entry.');
        }
    }

    private getParsedValues(): Record<string, unknown> {
        return Object.fromEntries(this.fields.map((field) => [
            field.property,
            parseEntryValue(this.values[field.property] ?? '', field.kind),
        ]));
    }

    private createButton(parent: HTMLElement, iconName: string, label: string, kind: 'primary' | 'secondary'): HTMLButtonElement {
        const button = parent.createEl('button', { cls: `lorebase-flow-btn lorebase-flow-btn-${kind}`, attr: { type: 'button' } });
        const icon = button.createSpan({ cls: 'lorebase-flow-btn-icon' });
        setIcon(icon, iconName);
        button.createSpan({ cls: 'lorebase-flow-btn-label', text: label });
        return button;
    }
}
