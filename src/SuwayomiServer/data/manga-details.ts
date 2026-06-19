import { ContentRating, type SourceManga } from "@paperback/types";

import { graphql, readFragment, type FragmentOf } from "../network/graphql";
import { localStore, LocalStoreKeys } from "../util/storage";
import { formatUrl } from "../util/url";

export const MangaDetailsFragment = graphql(`
  fragment MangaDetailsFragment on Query {
    manga(id: $mangaId) {
      id
      thumbnailUrl
      description
      title
      status
      artist
      author
      realUrl
      source {
        isNsfw
      }
    }
  }
`);

export function getMangaDetailsData(ref: FragmentOf<typeof MangaDetailsFragment>) {
  const serverUrl = formatUrl(localStore.getValue(LocalStoreKeys.serverUrl) ?? "");
  const data = readFragment(MangaDetailsFragment, ref);
  const { id, thumbnailUrl, description, title, source, author, artist, realUrl, status } =
    data.manga;

  return {
    mangaId: id.toString(),
    mangaInfo: {
      thumbnailUrl: `${serverUrl}${thumbnailUrl}`,
      synopsis: description ?? "",
      primaryTitle: title,
      secondaryTitles: [],
      status: status.toLowerCase(),
      contentRating: source?.isNsfw ? ContentRating.ADULT : ContentRating.EVERYONE,
      author: author ?? undefined,
      artist: artist ?? undefined,
      shareUrl: realUrl ?? undefined,
    },
  } satisfies SourceManga;
}
