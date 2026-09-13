import type { LibraryDefinition } from './types';
import type { LorebaseSettings } from '../../types';

/** Build the built-in library definitions from the user's current folder settings. */
export function createBuiltinLibraryDefinitions(settings: LorebaseSettings): LibraryDefinition[] {
    return [
        { id: 'games', name: 'Games', icon: 'gamepad-2', source: { kind: 'folder', folder: settings.games.folderPath }, schema: { fields: [] }, mediaType: 'game' },
        { id: 'anime', name: 'Anime', icon: 'tv', source: { kind: 'folder', folder: settings.anime.folderPath }, schema: { fields: [] }, mediaType: 'anime' },
        { id: 'movies', name: 'Movies', icon: 'film', source: { kind: 'folder', folder: settings.movies.folderPath }, schema: { fields: [] }, mediaType: 'movie' },
        { id: 'series', name: 'Series', icon: 'clapperboard', source: { kind: 'folder', folder: settings.series.folderPath }, schema: { fields: [] }, mediaType: 'series' },
        { id: 'books', name: 'Books', icon: 'book-open', source: { kind: 'folder', folder: settings.books.folderPath }, schema: { fields: [] }, mediaType: 'book' },
        { id: 'manga', name: 'Manga', icon: 'book-open-text', source: { kind: 'folder', folder: settings.manga.folderPath }, schema: { fields: [] }, mediaType: 'manga' },
    ];
}
