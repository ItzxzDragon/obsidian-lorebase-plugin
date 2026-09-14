# Custom Libraries Architecture

## Implementation contract

Custom Libraries must be implemented as native Lorebase Libraries. The existing `LibraryView`, primary Toolbar, view/filter/sort/group controls, and shared rendering pipeline remain the host architecture. Custom Library code owns definitions, persistence, source loading, schema, entry creation, property resolution, and custom card configuration; it must not create a parallel view or toolbar.

Behavioral source of truth:

- `RenameThis/src/custom-libraries/runtime.ts` — `7f96cb1ffa4373232676e258b7c2ce7b7e984a0e`
- `RenameThis/src/custom-libraries/custom-styles.css` — `6b8e72883070e5764e1cc069bed2f8e1ae3eb941`

The runtime file is a behavioral reference, not an integration layer. Its behavior must be migrated into real application services/components without copying the runtime overlay wholesale.

## Required behavior

A Custom Library supports:

- identity/source: `id`, `name`, `icon`, `sourceFolder`, `propertyScope` (`folder`/`vault`)
- entry fields: `auto`, `boolean`, `date`, `datetime`, `list`, `number`, `text`
- `%property` filename templates and safe filename generation
- YAML-compatible strings, multiline values, lists, numbers and booleans
- cover property, vertical/horizontal orientation, card sizing, columns and image sizing
- horizontal image side/width and side-cover configuration
- favorites, rating (`emoji`/`star`), completion date and icon-only status
- configurable overlay fields and independent vertical/horizontal layouts
- configurable badge placement
- `$file.name`, `$file.path`, `$file.ctime`, `$file.mtime`, `$file.size`
- case-insensitive field-key fallback when resolving properties
- hierarchical filter groups (`and`/`or`/`none`), nested groups and **Add Filter Group**
- all reference filter operators: `contains`, `equals`, `notEquals`, `greater`, `less`, `between`, `empty`, `notEmpty`, `isTrue`, `isFalse`, `containsAny`, `containsAll`, `notContains`, `thisMonth`, `thisYear`
- ordered multi-sort with `asc`/`desc`
- grouping by Custom Library properties with direction
- Saved Views containing complete sorts, filter mode/group, grouping and compatibility filter data
- configured property typing and automatic inference
- persisted-data normalization/migration and dependent-reference updates
- Obsidian-style cover references including URLs, data/blob/app/file sources, Markdown images/links and wiki links

## Native flow

```text
Library selector
    -> LibraryView
        -> existing Toolbar
            -> View / Filter / Sort / Group
                -> shared view pipeline
                    -> Custom Library source/schema/property resolver
                        -> custom cards
```

Custom Libraries must appear beside built-in Libraries in the normal selector. Selecting one must not open another pane or a separate simplified toolbar.

## Architecture boundary

```text
LibraryManager / persistence
        |
        v
LibraryRegistry + Custom Library catalog
        |
        +--> definition/schema
        +--> source/item loader
        +--> entry/template utilities
        +--> property resolution
        |
        v
Shared LibraryView
        |
        v
Existing Toolbar + shared view pipeline
        |
        v
Custom Library items + LibraryItemCard
```

`LibrarySurfaceController` and `LibrarySurfaceRenderer` are allowed as normal services. Bridges, prototype patches, monkey patches, runtime installers, compiled-runtime patches, and parallel Custom Library views/toolbars are not allowed.

## Integration checklist

- [ ] Custom Libraries selectable from existing Library selector.
- [ ] Built-in and Custom Libraries share the same LibraryView host.
- [ ] Existing Toolbar is reused.
- [ ] View selection remains available.
- [ ] Nested filters and Add Filter Group work.
- [ ] All reference operators remain available.
- [ ] Multi-sort remains ordered.
- [ ] Custom properties participate in grouping.
- [ ] Saved Views preserve complete state.
- [ ] Schema and entry field types are preserved.
- [ ] Filename templates and safe file creation work.
- [ ] Cover resolution supports Obsidian-style references.
- [ ] Card/orientation/overlay/badge configuration is preserved.
- [ ] Favorite/rating/completion behavior is preserved.
- [ ] `$file.*` properties are supported.
- [ ] Property resolution is shared across filtering/sorting/grouping/cards/templates.
- [ ] Property rename propagation is complete.
- [ ] Persisted settings are normalized/migrated.
- [ ] Folder/vault scope is respected.
- [ ] No bridge/monkey-patch/runtime-overlay architecture remains.
