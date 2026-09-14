import { setIcon } from 'obsidian';
import type { FilterRule } from '../../types';
import {
    FilterGroup,
    addFilterGroup,
    addFilterRule,
    cloneFilterGroup,
    createViewId,
    isFilterGroup,
    removeFilterNode,
    updateFilterGroupMode,
} from '../../services/library/unifiedViewState';

export interface FilterGroupEditorCallbacks {
    onChange: (group: FilterGroup) => void;
    onAddRule: (group: FilterGroup) => FilterRule | undefined;
    onRenderRule?: (parent: HTMLElement, rule: FilterRule, group: FilterGroup) => void;
    onRenderAddRule?: (parent: HTMLElement, group: FilterGroup, addRule: () => void) => void;
}

export interface FilterGroupEditorOptions {
    labels?: Partial<{
        and: string;
        or: string;
        addRule: string;
        addGroup: string;
        remove: string;
    }>;
}

/**
 * Reusable editor for the hierarchical filter tree used by unified library views.
 * Rule creation/value editing remains owned by the host View/Toolbar.
 */
export class FilterGroupEditor {
    private readonly parent: HTMLElement;
    private readonly callbacks: FilterGroupEditorCallbacks;
    private readonly labels: {
        and: string;
        or: string;
        addRule: string;
        addGroup: string;
        remove: string;
    };

    constructor(parent: HTMLElement, callbacks: FilterGroupEditorCallbacks, options: FilterGroupEditorOptions = {}) {
        this.parent = parent;
        this.callbacks = callbacks;
        this.labels = {
            and: 'AND',
            or: 'OR',
            addRule: 'Add filter',
            addGroup: 'Add filter group',
            remove: 'Remove',
            ...options.labels,
        };
    }

    render(group: FilterGroup): void {
        this.parent.empty();
        this.renderGroup(this.parent, group, true, group);
    }

    private renderGroup(parent: HTMLElement, group: FilterGroup, root: boolean, rootGroup: FilterGroup): void {
        const section = parent.createDiv({
            cls: `lorebase-filter-group ${root ? 'is-root' : 'is-nested'}`,
        });
        section.dataset.groupId = group.id;

        const header = section.createDiv({ cls: 'lorebase-filter-group-header' });
        const mode = header.createDiv({ cls: 'lorebase-filter-group-mode' });
        for (const [value, label] of [['and', this.labels.and], ['or', this.labels.or]] as const) {
            const button = mode.createEl('button', {
                cls: `lorebase-filter-group-mode-button ${group.mode === value ? 'is-active' : ''}`,
                text: label,
                attr: { type: 'button', 'aria-pressed': String(group.mode === value) },
            });
            button.addEventListener('click', () => {
                if (group.mode === value) return;
                this.callbacks.onChange(replaceGroup(rootGroup, updateFilterGroupMode(group, group.id, value)));
            });
        }

        if (!root) {
            const remove = header.createEl('button', {
                cls: 'lorebase-filter-group-remove',
                attr: { type: 'button', 'aria-label': this.labels.remove, title: this.labels.remove },
            });
            setIcon(remove, 'x');
            remove.addEventListener('click', () => {
                this.callbacks.onChange(removeFilterNode(rootGroup, group.id));
            });
        }

        const children = section.createDiv({ cls: 'lorebase-filter-group-children' });
        for (const child of group.children) {
            if (isFilterGroup(child)) {
                this.renderGroup(children, child, false, rootGroup);
            } else if (this.callbacks.onRenderRule) {
                this.callbacks.onRenderRule(children, child, group);
            } else {
                this.renderRulePlaceholder(children, child, rootGroup);
            }
        }

        const actions = section.createDiv({ cls: 'lorebase-filter-group-actions' });
        const addRule = (): void => {
            const rule = this.callbacks.onAddRule(group);
            if (!rule) return;
            this.callbacks.onChange(replaceGroup(rootGroup, addFilterRule(group, rule)));
        };
        if (this.callbacks.onRenderAddRule) {
            this.callbacks.onRenderAddRule(actions, group, addRule);
        } else {
            const addRuleButton = actions.createEl('button', {
                cls: 'lorebase-filter-group-add-rule',
                text: this.labels.addRule,
                attr: { type: 'button' },
            });
            addRuleButton.addEventListener('click', addRule);
        }

        const addGroup = actions.createEl('button', {
            cls: 'lorebase-filter-group-add-group',
            text: this.labels.addGroup,
            attr: { type: 'button' },
        });
        addGroup.addEventListener('click', () => {
            this.callbacks.onChange(replaceGroup(rootGroup, addFilterGroup(group, 'and', undefined, createViewId('filter-group'))));
        });
    }

    private renderRulePlaceholder(parent: HTMLElement, rule: FilterRule, rootGroup: FilterGroup): void {
        const row = parent.createDiv({ cls: 'lorebase-filter-rule' });
        row.dataset.ruleId = rule.id;
        row.createSpan({ cls: 'lorebase-filter-rule-label', text: rule.field });
        const remove = row.createEl('button', {
            cls: 'lorebase-filter-rule-remove',
            attr: { type: 'button', 'aria-label': this.labels.remove, title: this.labels.remove },
        });
        setIcon(remove, 'x');
        remove.addEventListener('click', () => {
            this.callbacks.onChange(removeFilterNode(rootGroup, rule.id));
        });
    }
}

function replaceGroup(root: FilterGroup, replacement: FilterGroup): FilterGroup {
    if (root.id === replacement.id) return cloneFilterGroup(replacement);
    const next = cloneFilterGroup(root);
    if (!replaceGroupInPlace(next, replacement)) throw new Error(`Filter group not found: ${replacement.id}`);
    return next;
}

function replaceGroupInPlace(parent: FilterGroup, replacement: FilterGroup): boolean {
    for (let index = 0; index < parent.children.length; index++) {
        const child = parent.children[index];
        if (!isFilterGroup(child)) continue;
        if (child.id === replacement.id) {
            parent.children[index] = cloneFilterGroup(replacement);
            return true;
        }
        if (replaceGroupInPlace(child, replacement)) return true;
    }
    return false;
}
