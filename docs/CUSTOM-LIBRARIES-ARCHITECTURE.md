# Custom Libraries Architecture — Behavioral Contract

> **NON-NEGOTIABLE SOURCE OF TRUTH**
>
> The implementation target is the behavior of `RenameThis/src/custom-libraries`, not merely the rough idea of Custom Libraries.
>
> Reference branch: `RenameThis`
>
> Reference files:
> - `src/custom-libraries/runtime.ts` — behavioral/source implementation
> - `src/custom-libraries/custom-styles.css` — visual/integration behavior
>
> Reference runtime blob SHA: `7f96cb1ffa4373232676e258b7c2ce7b7e984a0e`
>
> If memory, this document, the current independent-plugin implementation, or an earlier design decision conflicts with the reference, **stop and reread the reference before coding**. This document is a guardrail, not a replacement for the source.

## 1. Fundamental architecture

Custom Libraries are **real Libraries inside the existing Lorebase Library system**.

The target flow is:

`Library selector -> selected Library definition -> shared LibraryView -> existing Toolbar -> existing View / Filter / Sort / Group behavior -> Custom Library data/schema`

Therefore:

- Custom Libraries appear in the **same Library selector** as built-in libraries.
- Selecting a Custom Library does **not** open a separate custom pane/workflow.
- The existing Library view remains the host view.
- The existing Toolbar remains the Toolbar.
- The existing View / Filter / Sort / Group interaction model remains the interaction model.
- Custom Library code supplies the definition, source data, schema/properties, persistence, and custom configuration required by that shared system.
- A separate simplified Custom Library toolbar is forbidden.
- A separate `Select custom library to begin` workflow is forbidden when the Library selector itself already selects the Custom Library.
- Do not copy the runtime overlay wholesale merely to obtain behavior; migrate its behavior into the real architecture.

The reference CSS explicitly describes the custom-library toolbar as reusing Lorebase's primary toolbar structure and the injected custom libraries as visually indistinguishable from built-in media options.

## 2. Reference type model — do not simplify

The reference runtime defines these concepts:

### Primitive configuration types

- `Direction = 'asc' | 'desc'`
- `PropertyScope = 'folder' | 'vault'`
- `FilterMode = 'and' | 'or' | 'none'`
- `EntryFieldType = 'auto' | 'boolean' | 'date' | 'datetime' | 'list' | 'number' | 'text'`
- `CompletionDateFormat = 'short' | 'full'`
- `RatingStyle = 'emoji' | 'star'`
- `HorizontalImageSide = 'left' | 'right'`
- `CardOrientation = 'vertical' | 'horizontal'`
- `BadgeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`
- `OverlayTextRole = 'title' | 'description' | 'text'`
- `PropertyKind = 'text' | 'multiline' | 'number' | 'boolean' | 'list' | 'date'`

### Filter operators

The complete reference operator set is:

- `contains`
- `equals`
- `notEquals`
- `greater`
- `less`
- `between`
- `empty`
- `notEmpty`
- `isTrue`
- `isFalse`
- `containsAny`
- `containsAll`
- `notContains`
- `thisMonth`
- `thisYear`

Do not replace this with a smaller operator list.

### Filter structure

A filter rule contains:

- `kind?: 'rule'`
- `id`
- `property`
- optional `fieldType`
- `operator`
- optional `value`
- optional `valueTo`

A filter group contains:

- `kind: 'group'`
- `id`
- `mode`
- `children`

`children` contains recursive `FilterNode` values, so groups can contain rules **and nested groups**.

The implementation must preserve:

- root filter groups
- nested filter groups
- `and`, `or`, and `none` modes
- adding/removing rules
- **Add Filter Group**
- cloning/persisting nested filter state
- correct rule counting/effective-node behavior
- property collection through nested groups

### Sort structure

A sort is:

- `property`
- `direction`

The Library stores `sorts: SortSpec[]`.

Therefore **multi-sort is mandatory**. A single `SortSpec` is not an equivalent replacement.

### Saved View structure

A Saved View contains:

- `id`
- `name`
- `sorts: SortSpec[]`
- `filterMode`
- `filters`
- `filterGroup`
- `groupProperty`
- `groupDirection`

The saved state therefore includes the full multi-sort/filter-group/group configuration. Do not reduce Saved Views to one sort plus flat filters.

The reference also has a unified view state containing:

- `sorts`
- `filterGroup`
- `groupProperty`
- `groupDirection`
- `savedViews`
- `activeSavedViewId`

## 3. Library definition — exhaustive behavioral surface

A Custom Library definition is **not just a folder plus a list of fields**.

The reference definition includes:

### Identity/source

- `id`
- `name`
- `icon`
- `sourceFolder`
- `propertyScope`
- `fileNameTemplate`

`propertyScope` supports both `folder` and `vault`. Do not silently hard-code folder-only behavior.

### Cover/card presentation

The definition includes:

- `coverProperty`
- `columns`
- `orientation`
- `cardSize`
- `customCardSize`
- `customCardMinWidth`
- `customCardMinHeight`
- `customCardImageRatio`
- `customHorizontalCardMinWidth`
- `customHorizontalCardHeight`
- `horizontalSideCover`
- `horizontalImageSide`
- `horizontalImageWidth`

Both vertical and horizontal card behavior must be preserved.

### Favorite/rating/completion behavior

- `favoriteEnabled`
- `favoriteSubtlePulse`
- `ratingEnabled`
- `ratingStyle`
- `completionDateEnabled`
- `completionDateProperty`
- `completionDateFormat`
- `statusAsIconOnly`

### Overlay/badge behavior

- `overlayFields`
- `overlayLayouts` for vertical and horizontal cards
- `badgeLayouts` for vertical and horizontal cards
- custom overlay field identity/property/role/position/size/font configuration
- badge corner placement and offsets
- separate favorite/rating/completion badge placement

The reference overlay field model includes:

- `id`
- `property`
- `role`
- `x`
- `y`
- `width`
- `height`
- `fontSize`
- `fontWeight`

### Entry schema

- `entryFields`
- each entry field has `property` and `type`
- supported entry types include `auto`, `boolean`, `date`, `datetime`, `list`, `number`, `text`

The schema is used by the entry editor and view/property behavior. It is not merely display metadata.

### View state

- `sorts`
- `filterMode`
- `filters`
- `filterGroup`
- `groupProperty`
- `groupDirection`
- `savedViews`
- `activeSavedViewId`

## 4. Property system — must be shared and consistent

The reference has a central property/value model. Filtering, sorting, grouping, entry UI, filename templates, covers, overlays, and other features must not each invent incompatible property lookup behavior.

### Special file properties

These exact properties are supported:

- `$file.name`
- `$file.path`
- `$file.ctime`
- `$file.mtime`
- `$file.size`

Their user-facing labels are File name, File path, Created time, Modified time, and File size respectively.

### Frontmatter/YAML properties

Custom Library fields may come from ordinary YAML/frontmatter properties. Property resolution must support configured entry/schema properties and values exposed by the selected source scope.

### Type inference/configuration

The reference can infer property kinds from values:

- arrays -> `list`
- numbers -> `number`
- booleans -> `boolean`
- multiline strings -> `multiline`
- ISO `YYYY-MM-DD` strings -> `date`
- other strings -> `text`

Configured entry field types override automatic inference where appropriate.

`datetime` is a supported entry configuration type and resolves into date-like behavior for the view pipeline.

## 5. Entry creation/editing behavior

Custom Libraries include an entry editor, not merely a read-only card grid.

The reference supports:

- configured entry properties
- typed entry values
- multiline fields
- list fields
- adding ad-hoc properties
- property suggestions/picking while still allowing free typing
- schema-aware entry editing
- filename template rendering
- sanitization of generated filenames
- writing entry values into Markdown/YAML frontmatter

Entry property names are validated/normalized rather than accepting arbitrary invalid property identifiers.

### Entry value parsing

- boolean -> boolean
- number -> finite number when possible
- list -> comma/newline separated list
- text/date-like values -> string

### Markdown/YAML serialization

Generated entries:

- use YAML frontmatter
- omit empty values
- do not serialize special `$file.*` properties as ordinary frontmatter
- support multiline YAML values
- serialize lists/scalars appropriately

## 6. Filename template behavior

`fileNameTemplate` is behavioral, not cosmetic.

The reference:

- recognizes `%property` variables
- collects referenced variables
- renders variables from current entry values
- normalizes scalar/list values for rendering
- sanitizes illegal filename characters
- removes control characters
- normalizes whitespace
- removes trailing dots/spaces
- falls back to `Untitled` when the result is empty

Do not replace this with simple interpolation that can create invalid filenames.

## 7. View / Filter / Sort / Group behavior

Custom Libraries must run through the same complete view pipeline.

### Filter

Required behavior:

- flat rules
- nested groups
- Add Filter Group
- recursive group evaluation
- group mode `and` / `or` / `none`
- all reference operators
- typed values
- property resolution through the shared resolver
- empty/not-empty behavior
- boolean behavior
- list any/all/not-contains behavior
- relative date behavior (`thisMonth`, `thisYear`)

### Sort

Required behavior:

- zero or more sorts
- add multiple sorts
- preserve sort order/priority
- ascending/descending direction
- property-based sorting
- Custom Library properties and supported file properties

### Group

Required behavior:

- group by property
- group direction
- Custom Library fields available as grouping properties
- consistent handling of empty/ungrouped values
- list-valued properties handled consistently

### Saved Views

Required behavior:

- create/save views
- select active view
- persist complete state
- restore multiple sorts
- restore nested filter groups
- restore grouping
- restore active saved view identity

## 8. Normalization and backward compatibility are part of behavior

The reference runtime contains normalization/migration behavior. This must not be lost merely because the new architecture uses different TypeScript modules.

Preserve normalization/migration for:

- paths
- entry field types
- property lists
- completion date formats
- rating styles
- overlay roles/fields
- card/layout settings
- saved/view state
- legacy values from older custom-library versions

For example, older completion-date values are migrated to supported `full` format and older rating styles are migrated to the Lorebase `star`/`emoji` model.

Do not assume persisted user data is already canonical.

## 9. Visual/integration contract

`src/custom-libraries/custom-styles.css` is also part of the reference.

It establishes that Custom Libraries:

- reuse Lorebase toolbar/card/grid conventions
- integrate custom library options into the media/library tray
- support responsive layouts
- reuse Lorebase-native view/filter controls
- support property comboboxes and suggestions
- support nested filter-group styling
- support multi-sort rows
- support entry-editor controls
- support cover fallbacks/errors

The CSS extends the host system; it does not establish a parallel application shell.

## 10. Explicit anti-regression checklist

Before considering Custom Libraries implemented, verify every item against `RenameThis/src/custom-libraries/runtime.ts` and `custom-styles.css`:

- [ ] Same main Library selector as built-in libraries
- [ ] Same main LibraryView host
- [ ] Same main Toolbar
- [ ] No separate simplified Custom Library toolbar
- [ ] No alternate `Select custom library to begin` workflow
- [ ] Folder and vault property scopes
- [ ] Custom source-folder behavior
- [ ] Entry schema/properties
- [ ] `auto`, boolean, date, datetime, list, number, text entry types
- [ ] YAML/frontmatter property resolution
- [ ] All five `$file.*` special properties
- [ ] Filename `%property` templates
- [ ] Filename sanitization
- [ ] Entry creation
- [ ] Typed entry parsing
- [ ] Multiline entry fields
- [ ] List entry fields
- [ ] Ad-hoc property addition
- [ ] Property suggestions + free typing
- [ ] Cover property
- [ ] Vertical cards
- [ ] Horizontal cards
- [ ] Card size options
- [ ] Custom card dimensions
- [ ] Custom image ratio
- [ ] Horizontal image side/width
- [ ] Favorite enablement
- [ ] Favorite subtle pulse
- [ ] Rating enablement
- [ ] Emoji/star rating style
- [ ] Completion date enablement
- [ ] Completion date property
- [ ] Completion date format
- [ ] Overlay fields
- [ ] Overlay roles
- [ ] Overlay positions/sizes/font settings
- [ ] Per-orientation overlay layouts
- [ ] Badge layouts
- [ ] Badge corner/offset placement
- [ ] Status icon-only mode
- [ ] Full filter operator set
- [ ] Filter field typing
- [ ] Filter groups
- [ ] Nested filter groups
- [ ] AND mode
- [ ] OR mode
- [ ] NONE mode
- [ ] Add Filter Group
- [ ] Recursive filter persistence
- [ ] Multiple sorts
- [ ] Sort priority/order
- [ ] Group property
- [ ] Group direction
- [ ] Saved Views
- [ ] Saved Views preserve all view state
- [ ] Active Saved View persistence
- [ ] Property inference
- [ ] Normalization/migration of persisted settings
- [ ] Shared property resolver across view operations
- [ ] Responsive/custom CSS integration
- [ ] Cover fallback/error behavior

## 11. Rule for future coding sessions

Before changing Custom Library code:

1. Read this document.
2. Open `RenameThis/src/custom-libraries/runtime.ts`.
3. Open `RenameThis/src/custom-libraries/custom-styles.css` when UI/integration is involved.
4. Identify the exact reference behavior being migrated.
5. Map that behavior to the current independent-plugin architecture.
6. Only then modify code.
7. After coding, compare the changed behavior back against the reference.
8. If something is intentionally different, document the difference **before** treating the work as complete.

**Never rely on memory of the reference when the source is available.**

## 12. Current independent-plugin architecture must conform to this contract

The independent plugin may split the old runtime into modules such as library registry/catalog, source loader, schema/property model, shared view pipeline, shared Toolbar integration, entry editor, persistence/normalization, and card rendering.

That modularization is encouraged.

What is not allowed is changing behavior because the new architecture is simpler.

> **Success criterion: architecturally native to the independent plugin, behaviorally equivalent to `src/custom-libraries` on `RenameThis`.**
