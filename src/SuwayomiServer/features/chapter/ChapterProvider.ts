import type { Chapter, ChapterDetails, ChapterProviding, SourceManga } from "@paperback/types";

import { graphql } from "../../network/graphql";
import { makeGraphQLRequest } from "../../network/request";
import { formatErrors } from "../../util/error";
import {
  ChapterDetailsFragment,
  ChaptersFragment,
  FetchChaptersMutation,
  FetchMangaMutation,
  getChapterDetailsData,
  getChaptersData,
  getMangaDetailsData,
  isMangaInitialized,
  MangaDetailsFragment,
  shouldFetchChapters,
} from "./data";

export class ChapterProvider implements ChapterProviding {
  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    let data = await this.queryMangaDetails(mangaId);

    // Manga found through source search haven't been fetched from their source yet
    if (!isMangaInitialized(data)) {
      await this.fetchManga(mangaId);
      data = await this.queryMangaDetails(mangaId);
    }

    return getMangaDetailsData(data);
  }

  async getChapters(sourceManga: SourceManga, sinceDate?: Date): Promise<Chapter[]> {
    let data = await this.queryChapters(sourceManga, sinceDate);

    if (shouldFetchChapters(data)) {
      await this.fetchChapters(sourceManga.mangaId);
      data = await this.queryChapters(sourceManga, sinceDate);
    }

    return getChaptersData(data, sourceManga);
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          mutation ChapterDetailsMutation($chapterId: Int!) {
            ...ChapterDetailsFragment
          }
        `,
        [ChapterDetailsFragment],
      ),
      variables: {
        chapterId: parseInt(chapter.chapterId, 10),
      },
    });

    if (!data || errors) {
      const errorMessage = `couldn't fetch chapter details for chapter ${chapter.chapterId}`;
      console.error(errorMessage, formatErrors(errors));
      throw new Error(errorMessage);
    }

    return getChapterDetailsData(data);
  }

  private async queryMangaDetails(mangaId: string) {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          query MangaDetailsQuery($mangaId: Int!) {
            ...MangaDetailsFragment
          }
        `,
        [MangaDetailsFragment],
      ),
      variables: {
        mangaId: parseInt(mangaId, 10),
      },
    });

    if (!data || errors) {
      const errorMessage = `couldn't fetch manga details for manga ${mangaId}`;
      console.error(errorMessage, formatErrors(errors));
      throw new Error(errorMessage);
    }

    return data;
  }

  private async fetchManga(mangaId: string) {
    const { data, errors } = await makeGraphQLRequest({
      query: FetchMangaMutation,
      variables: {
        mangaId: parseInt(mangaId, 10),
      },
    });

    if (!data || errors) {
      const errorMessage = `couldn't fetch manga ${mangaId} from its source`;
      console.error(errorMessage, formatErrors(errors));
      throw new Error(errorMessage);
    }
  }

  private async queryChapters(sourceManga: SourceManga, sinceDate?: Date) {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          query ChaptersQuery($mangaId: Int!, $sinceDate: LongString, $isRead: Boolean) {
            ...ChaptersFragment
          }
        `,
        [ChaptersFragment],
      ),
      variables: {
        mangaId: parseInt(sourceManga.mangaId, 10),
        sinceDate: sinceDate ? sinceDate.getTime().toString() : null,
      },
    });

    if (!data || errors) {
      const errorMessage = `couldn't fetch chapters for manga ${sourceManga.mangaId}`;
      console.error(errorMessage, formatErrors(errors));
      throw new Error(errorMessage);
    }

    return data;
  }

  private async fetchChapters(mangaId: string) {
    const { data, errors } = await makeGraphQLRequest({
      query: FetchChaptersMutation,
      variables: {
        mangaId: parseInt(mangaId, 10),
      },
    });

    if (!data || errors) {
      const errorMessage = `couldn't fetch chapters for manga ${mangaId} from its source`;
      console.error(errorMessage, formatErrors(errors));
      throw new Error(errorMessage);
    }
  }
}
