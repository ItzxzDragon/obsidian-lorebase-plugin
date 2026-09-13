import type { MediaType } from '../../types';
import type { LibraryDefinition } from './types';

const BUILTIN_LIBRARIES: Array<Pick<LibraryDefinition, 'id' | 'name' | 'icon' | 'mediaType'>> = [
    { id: 'game', name: 'Games', icon: 'gamepad-2', mediaType: 'game' },
    { id: 'anime', name: 'Anime', icon: 'tv', mediaType: 'anime' },
    { id: 'movie', name: 'Movies', icon: 'film', mediaType: 'movie' },
    { id: 'series', name: 'TV Shows', icon: 'clapperboard', mediaType: 'series' },
    { id: 'book', name: 'Books', icon: 'book-open', mediaType: 'book' },
    { id: 'manga', name: 'Manga', icon: 'book-open', mediaType: 'manga' },
];

/** Creates the built-in libraries without coupling the registry to Obsidian settings. */
export function createBuiltinLibraryDefinitions(): LibraryDefinition[] {
    return BUILTIN_LIBRARIES.map(({ id, name, icon, mediaType }) => ({
        id,
        name,
        icon,
        mediaType: mediaType as MediaType,
        source: { kind: 'builtin', mediaType: mediaType as MediaType },
        schema: { fields: [] },
    }));
}
