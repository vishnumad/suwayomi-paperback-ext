import type { Chapter, SourceManga } from "@paperback/types";

import { graphql, readFragment, type FragmentOf } from "../../network/graphql";
import { parseChapterTitle, parseChapterVolume } from "../../util/chapter";

export const MangaProgressFragment = graphql(`
  fragment MangaProgressFragment on Query {
    manga(id: $mangaId) {
      latestReadChapter {
        id
        name
        chapterNumber
        uploadDate
        scanlator
        lastReadAt
        manga {
          source {
            lang
          }
        }
      }
    }
  }
`);

export function getMangaProgressData(
  ref: FragmentOf<typeof MangaProgressFragment>,
  sourceManga: SourceManga,
) {
  const data = readFragment(MangaProgressFragment, ref);
  const chapter = data.manga?.latestReadChapter;
  if (!chapter) return null;

  const lastReadChapter = {
    chapterId: chapter.id.toString(),
    sourceManga,
    title: parseChapterTitle(chapter.name),
    volume: parseChapterVolume(chapter.name),
    langCode: chapter.manga.source?.lang ?? "en",
    chapNum: chapter.chapterNumber,
    version: chapter.scanlator ?? undefined,
    publishDate: new Date(parseInt(chapter.uploadDate, 10)),
  } satisfies Chapter;

  return {
    lastReadChapter,
    lastReadTime: new Date(parseInt(chapter.lastReadAt, 10)),
  };
}

export const MarkChaptersReadMutation = graphql(`
  mutation MarkChaptersRead($chapterIds: [Int!]!, $mangaId: Int!) {
    updateChapters(input: { ids: $chapterIds, patch: { isRead: true, lastPageRead: 0 } }) {
      __typename
    }
    trackProgress(input: { mangaId: $mangaId }) {
      __typename
    }
  }
`);
