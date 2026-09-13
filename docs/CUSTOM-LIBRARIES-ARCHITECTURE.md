# Custom Libraries Architecture

## 1. Non-negotiable source of truth

The behavioral source of truth is the `RenameThis` branch, especially:

- `src/custom-libraries/runtime.ts` (`7f96cb1ffa4373232676e258b7c2ce7b7e984a0e`)
- `src/custom-libraries/custom-styles.css` (`6b8e72883070e5764e1cc069bed2f8e1ae3eb941`)

This document is an implementation contract for migrating that behavior into the independent plugin architecture. The runtime file must **not** be copied wholesale as a runtime overlay, but its user-facing behavior must not be simplified or silently dropped.

Before changing Custom Libraries, compare the proposed behavior with `RenameThis/src/custom-libraries/runtime.ts`. If something intentionally differs, record the difference here before implementing it.

## 2. Core UX contract

A Custom Library is a **real Library**.

The intended flow is:

`Library selector -> selected Library -> existing LibraryView -> existing Toolbar -> View / Filter / Sort / Group -> Custom Library data/schema`

Therefore:

- Custom Libraries appear in the existing Library selector beside built-in Libraries.
- Selecting a Custom Library does not open a separate pane or alternate workflow.
- The existing LibraryView remains the host view.
- The existing primary Toolbar remains the Toolbar.
- View, Filter, Sort and Group controls are the same controls and same interaction model used by normal Libraries.
- Do not create a second simplified Custom Library toolbar.
- Do not create a separate `Select custom library to begin` workflow when a Library is already selected.
- Custom Library code supplies definition, data, schema, persistence and property resolution; it does not own a parallel view/toolbar system.

The reference CSS explicitly describes its controls as reusing Lorebase's primary toolbar structure and sharing Lorebase card/grid behavior. That is an architectural requirement, not merely a styling preference.

## 3. Library definition: complete behavior

A Custom Library definition is substantially more than a folder path. The reference model contains all of the following categories:

### Identity and source

- `id`
- `name`
- `icon`
- `sourceFolder`
- `propertyScope`: `folder` or `vault`

### Entry creation/schema

- `entryFields`: `{ property, type }[]`
- Entry field types: `auto`, `boolean`, `date`, `datetime`, `list`, `number`, `text`
- Valid entry property names match `[A-Za-z0-9_-]+` and cannot begin with `$`.
- Duplicate/invalid entry properties are normalized away.
- `fileNameTemplate` supports `%property` variables.
- File-name variables are rendered from entry values and sanitized before file creation.
- Empty/invalid rendered names fall back safely to `Untitled`.
- Multiline values can be emitted as YAML block scalars.
- Lists, numbers and booleans must be serialized as YAML-compatible values.
- `$` special file properties are not written as entry frontmatter properties.

### Card/view presentation

- `coverProperty`
- `columns`
- `orientation`: `vertical` or `horizontal`
- `cardSize`: `small`, `medium`, `large`
- `customCardSize`
- `customCardMinWidth`
- `customCardMinHeight`
- `customCardImageRatio`
- `customHorizontalCardMinWidth`
- `customHorizontalCardHeight`
- `horizontalSideCover`
- `horizontalImageSide`: `left` or `right`
- `horizontalImageWidth`

### Favorites, rating and completion

- `favoriteEnabled`
- `favoriteSubtlePulse`
- `ratingEnabled`
- `ratingStyle`: `emoji` or `star`
- `completionDateEnabled`
- `completionDateProperty`
- `completionDateFormat`: `short` or `full`
- `statusAsIconOnly`

### Overlay fields

Overlay fields are configurable objects containing:

- property
- role: `title`, `description` or `text`
- x/y position
- width/height
- font size
- font weight

Layouts are maintained independently for vertical and horizontal cards. Legacy card-property configuration is migrated into overlay fields.

### Badge layouts

Favorite, rating and completion badges have configurable placement per card orientation. Placement contains:

- corner: `top-left`, `top-right`, `bottom-left`, `bottom-right`
- `offsetX`
- `offsetY`

## 4. Properties and property resolution

Custom Libraries operate on ordinary YAML/frontmatter properties plus the reference file properties:

- `$file.name`
- `$file.path`
- `$file.ctime`
- `$file.mtime`
- `$file.size`

The property resolver must be shared by filtering, sorting, grouping, cards, templates and other consumers.

Resolution rules from the reference implementation:

1. Resolve the five `$file.*` properties from the `TFile` itself.
2. Resolve an exact field key from the item's fields.
3. If no exact key exists, perform a case-insensitive field-key match.
4. Missing values resolve as `undefined`/empty according to the consuming operation rather than inventing a second property source.

File-property labels are user-facing names such as File name, File path, Created time, Modified time and File size.

## 5. Filter model — must remain hierarchical

The reference filter model is a tree, not a flat list:

```text
FilterGroup
  mode: and | or | none
  children:
    FilterRule
    FilterGroup
      ...
```

A rule contains:

- `id`
- `property`
- optional `fieldType`
- `operator`
- optional `value`
- optional `valueTo`

Supported operators include:

- contains
- equals
- notEquals
- greater
- less
- between
- empty
- notEmpty
- isTrue
- isFalse
- containsAny
- containsAll
- notContains
- thisMonth
- thisYear

Required UI behavior:

- add/remove filter rules
- change group mode
- add/remove nested groups
- explicit **Add Filter Group** action
- property selection from the available Custom Library schema/properties
- operator/value controls appropriate to the property's type

Do not reduce this to a flat `rules[]` model. Do not replace nested groups with tags/genres or other unrelated filters.

## 6. Sort model — multi-sort

Sorting is an ordered array:

```ts
SortSpec = {
  property: string;
  direction: 'asc' | 'desc';
}
```

Required behavior:

- zero or more sort rules
- add another sort
- remove a sort
- reorder/retain sort precedence
- choose a property for every sort
- choose ascending/descending direction
- apply the ordered list sequentially

A single `sort` object is not equivalent to the reference behavior.

## 7. Group model

Grouping is configured with:

- `groupProperty`
- `groupDirection`: `asc` or `desc`

The selected Custom Library properties must participate in the same grouping mechanism as built-in Library properties.

Grouping must not be limited to hard-coded built-in categories when a Custom Library schema exposes additional properties.

## 8. Saved Views

Saved Views are part of the Library definition and preserve the complete view state.

A saved view contains:

- `id`
- `name`
- `sorts: SortSpec[]`
- `filterMode`
- legacy `filters` compatibility data
- hierarchical `filterGroup`
- `groupProperty`
- `groupDirection`

The Library also stores:

- `savedViews`
- `activeSavedViewId`

Saving/loading a view must not discard nested filter groups, additional sorts or grouping configuration.

## 9. Unified view state

The reference architecture also keeps the shared view state separate from the Library definition where appropriate. Its unified state contains:

- `sorts`
- `filterGroup`
- `groupProperty`
- `groupDirection`
- `savedViews`
- `activeSavedViewId`

The independent implementation may split these responsibilities across services/classes, but the resulting behavior must remain equivalent.

## 10. Entry property typing and inference

The reference supports configured types as well as automatic inference.

Internal property kinds include:

- text
- multiline
- number
- boolean
- list
- date

Inference rules include:

- arrays -> list
- numbers -> number
- booleans -> boolean
- `YYYY-MM-DD` strings -> date
- strings containing newlines -> multiline
- other strings -> text

`datetime` entry configuration uses date semantics internally.

Configured `auto` fields fall back to inferred kind and then text when no useful value exists.

## 11. Entry creation and YAML behavior

The reference has explicit utilities for creating entry frontmatter. The migrated implementation must preserve the semantics:

- ignore empty values
- do not write `$file.*` properties into frontmatter
- write multiline strings using YAML block-scalar form
- serialize lists, numbers and booleans correctly
- safely quote ordinary strings
- create the Markdown entry with frontmatter boundaries

Filename templates use `%property` syntax and must be sanitized for filesystem-invalid characters, control characters, trailing dots/spaces and empty results.

## 12. Configuration migration and normalization

The reference deliberately contains compatibility logic. The independent implementation should preserve equivalent migration behavior rather than treating persisted data as always-new.

Important normalization rules include:

- completion date formats `medium`, `long` and `iso` migrate to `full`
- older rating styles `number` and `both` migrate to `star`
- overlay roles normalize to `title`, `description` or `text`
- invalid/duplicate entry fields are removed
- legacy card properties can become overlay fields
- badge placement is clamped to safe ranges
- overlay positions/sizes/font values are clamped to safe ranges
- property lists are trimmed and deduplicated

Property renames must update all dependent references, including:

- filename template variables
- cover property
- completion-date property
- group property
- overlay properties
- sort properties
- filter-group rules
- saved-view sorts
- saved-view grouping
- saved-view filter groups
- legacy saved-view filter rules

## 13. Cover resolution

Cover values may represent different Obsidian-style references, including URLs, data/blob/app/file sources, Markdown images/links and wiki links. The reference normalizes the value before resolving it.

The migrated implementation must not assume that a cover property is always a plain vault path.

## 14. Data source and scope

The reference has an explicit `propertyScope` distinction:

- `folder`: properties relevant to the configured source folder
- `vault`: properties may be resolved from the broader vault context as supported by the reference

A Custom Library source must respect the configured source folder and must not accidentally turn a folder-scoped Library into a vault-wide Library.

## 15. Styling/integration contract

`RenameThis/src/custom-libraries/custom-styles.css` is evidence of the intended integration boundary.

Important selectors/concepts include:

- `.lcl-toolbar`
- `.lcl-library-picker`
- `.lcl-library-select`
- `.lcl-view-select`
- `.lcl-sort-list`
- `.lcl-sort-row`
- `.lcl-filter-group`
- `.lcl-filter-group.is-root`
- `.lcl-filter-group.is-nested`
- `.lcl-property-combobox`
- `.lcl-unified-view-panel`
- `.lcl-entry-modal`
- `.lcl-entry-fields`
- `.lcl-entry-add-property`
- `.lcl-integrated-shell`
- `.lorebase-media-tray [data-lcl-library-id]`

These names are not a mandate to copy CSS verbatim. They demonstrate that Custom Library controls were designed to be integrated with the main Lorebase toolbar/view/card system, including multi-sort, nested filter groups, property selection, entry editing and media-tray integration.

## 16. Architecture boundary for the independent plugin

The independent implementation should be divided into real application services/components rather than a single runtime overlay. A sensible boundary is:

```text
LibraryManager / persistence
        |
        v
LibraryRegistry + Custom Library catalog
        |
        +--> Custom Library definition/schema
        |
        +--> Custom Library source / item loader
        |
        v
Shared LibraryView
        |
        v
Existing Toolbar
   |    |    |
   v    v    v
 View Filter Sort Group
        |
        v
Shared view pipeline
        |
        v
Custom Library items + schema/property resolver
```

Custom Library-specific code may own:

- persistence
- definition/catalog management
- folder/source loading
- schema/entry-property management
- filename template creation
- property resolution adapters
- custom card configuration

It must **not** own a parallel primary toolbar or a parallel LibraryView workflow.

## 17. Explicit anti-patterns

The following are considered regressions relative to `RenameThis`:

- a separate Custom Library pane
- a separate simplified toolbar
- a second independent Filter button implementation
- a single-sort-only model
- a flat-only filter model
- removing `Add Filter Group`
- hard-coding grouping to built-in fields
- hiding Custom Libraries outside the normal Library selector
- replacing Saved Views with a reduced custom model
- reducing Custom Library configuration to only `folder + fields`
- losing cover/orientation/card/badge/overlay configuration
- losing favorite/rating/completion configuration
- treating entry properties as arbitrary `$` properties
- resolving properties differently in Filter vs Sort vs Group
- copying the ZIP/runtime patcher approach into the independent plugin

## 18. Implementation checklist

Before considering Custom Libraries complete, verify all of these:

- [ ] Custom Libraries are selectable from the existing Library selector.
- [ ] Built-in and Custom Libraries share the same LibraryView host.
- [ ] Existing Toolbar is reused.
- [ ] View selection remains available.
- [ ] Filter supports nested groups and `Add Filter Group`.
- [ ] All reference filter operators remain available.
- [ ] Sort supports multiple ordered SortSpecs.
- [ ] Group supports Custom Library properties and direction.
- [ ] Saved Views persist the complete state.
- [ ] Custom Library schema defines available properties/types.
- [ ] Entry fields support all reference types.
- [ ] Filename templates and safe file creation work.
- [ ] Cover property resolution supports Obsidian-style references.
- [ ] Vertical/horizontal card configuration is preserved.
- [ ] Card sizing/columns/image sizing are preserved.
- [ ] Overlay fields and per-orientation layouts are preserved.
- [ ] Badge placement/layout is preserved.
- [ ] Favorite/rating/completion configuration is preserved.
- [ ] `$file.*` properties are supported.
- [ ] Property resolution is shared across the pipeline.
- [ ] Property rename propagation is complete.
- [ ] Persisted settings are normalized/migrated.
- [ ] Folder/vault property scope is respected.
- [ ] No parallel Custom Library toolbar/view is introduced.
- [ ] No simplified prototype behavior replaces reference behavior.

## 19. Review rule

This document is intentionally strict. When implementation work resumes after a context switch, reread this document and compare the current code against `RenameThis/src/custom-libraries/runtime.ts` before making architectural decisions.

The goal is not merely to make a Custom Library that works. The goal is to reproduce the intended Lorebase Custom Library behavior **inside the independent plugin's real architecture**, without the runtime overlay and without feature loss.
