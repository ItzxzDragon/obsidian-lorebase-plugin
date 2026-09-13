# Custom Libraries Architecture

## Source of truth

The `RenameThis` branch's `src/custom-libraries/runtime.ts` is the behavioral reference for the Custom Libraries feature. The current implementation may be refactored into proper modules, but its user-facing behavior and feature set must not be simplified or accidentally changed.

## Core UX

- A Custom Library is a real Library, not a separate pane or alternate workflow.
- Custom Libraries are selected from the existing Library selector alongside built-in libraries.
- Selecting a Custom Library keeps the existing Library view and its existing Toolbar UX.
- Do not introduce a separate simplified Custom Library toolbar.
- Do not show a separate empty state such as `Select custom library to begin` when the Library itself is already selected.

## View / Filter / Sort / Group

Custom Libraries must use the same complete View pipeline and controls as the existing Library system.

### Filter

- Filters support filter groups.
- A filter group has a logical mode (`and`, `or`, or `none`).
- Groups contain filter rules and may contain nested groups.
- The UI must support adding filter rules and `Add Filter Group`.
- Filter operators include the full supported set, including contains, equals, not-equals, comparisons, between, empty/not-empty, boolean operators, list operators, and date-relative operators.
- Filtering must operate on Custom Library properties as well as supported file properties.

### Sort

- Sorting is represented as an ordered list of SortSpecs.
- Multiple sort rules are supported.
- Each sort has a property and ascending/descending direction.

### Group

- Grouping is based on a property/field and direction.
- Custom Library fields must be available to the same grouping mechanism.

### Saved Views

- Saved Views preserve the complete view state, including multiple sorts, filter groups, grouping, and their related settings.
- Custom Libraries must not get a reduced Saved View model.

## Custom Library definition

A Custom Library definition is more than a folder path. The reference behavior includes configuration for:

- source folder and property scope
- entry properties / schema
- filename template
- cover property
- card orientation, size, columns and image sizing
- overlay fields
- badges and their layouts
- favorite/rating/completion features
- completion-date configuration
- sorts
- filter groups
- grouping
- saved views and active saved view

Not every reference implementation detail has to remain in one file, but the behavior must remain available through the new architecture.

## Properties

The reference implementation supports ordinary frontmatter/YAML properties and special file properties such as:

- `$file.name`
- `$file.path`
- `$file.ctime`
- `$file.mtime`
- `$file.size`

Property values need a shared resolver so filtering, sorting, grouping, cards, and other view features do not each invent their own lookup rules.

## Architecture rule

The goal is to migrate the reference behavior into the project's real source architecture, not to copy the runtime overlay wholesale and not to replace the existing Library UI with a simplified prototype.

When implementing a feature, compare it against the `RenameThis` reference first. If the new implementation intentionally differs, document the difference before coding it.

## Implementation direction

The target flow is:

`Library selector -> selected Library definition -> shared LibraryView -> existing Toolbar -> shared Filter / Sort / Group pipeline -> Library-specific data/schema`

Custom Library-specific code should provide the data, schema, property resolution, persistence, and configuration needed by that shared flow. It should not own a parallel Toolbar or parallel view workflow.
