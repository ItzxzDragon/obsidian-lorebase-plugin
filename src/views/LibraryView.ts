        }

        if (left.type === 'book' && right.type === 'book') {
            return left.summary === right.summary
                && left.sourceUrl === right.sourceUrl
                && left.publisher === right.publisher
                && left.releaseDate === right.releaseDate
                && left.pageCurrent === right.pageCurrent
                && left.pageTotal === right.pageTotal
                && this.areStringArraysEquivalent(left.authors, right.authors)
                && this.areRelatedMediaEquivalent(left.relatedMedia, right.relatedMedia);
        }

        if (left.type === 'manga' && right.type === 'manga') {
            return left.description === right.description
                && left.sourceUrl === right.sourceUrl
                && left.chapterCurrent === right.chapterCurrent
                && left.chapterTotal === right.chapterTotal
                && left.volumeCurrent === right.volumeCurrent
                && left.volumeTotal === right.volumeTotal
                && left.activePartId === right.activePartId
                && this.areStringArraysEquivalent(left.authors, right.authors)
                && this.areStringArraysEquivalent(left.artists, right.artists)
                && this.areMangaPartsEquivalent(left.parts ?? [], right.parts ?? [])
                && this.areRelatedMediaEquivalent(left.relatedMedia, right.relatedMedia);
        }

        return true;