import { ContentRating, type SourceManga } from "@paperback/types";

import { graphql, readFragment, type FragmentOf } from "../network/graphql";
import { localStore, LocalStoreKeys } from "../util/storage";
import { formatUrl } from "../util/url";

export const AvailableCategoriesFragment = graphql(`
  fragment AvailableCategoriesFragment on Query {
    categories {
      nodes {
        id
        name
        order
      }
    }
  }
`);

export function getAvailableCategories(ref: FragmentOf<typeof AvailableCategoriesFragment>) {
  const data = readFragment(AvailableCategoriesFragment, ref);
  return data.categories.nodes.toSorted((a, b) => a.order - b.order);
}

export function getAvailableSelectedCategories(
  ref: FragmentOf<typeof AvailableCategoriesFragment>,
  selectedCategories: string[],
) {
  const categories = getAvailableCategories(ref);
  return categories.filter((category) => selectedCategories.some((c) => c === category.name));
}

export const AllCategoryMangasFragment = graphql(`
  fragment AllCategoryMangasFragment on Query {
    mangas(filter: { categoryId: { equalTo: $categoryId } }, order: { by: TITLE, byType: ASC }) {
      nodes {
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
  }
`);

export function getAllCategoryMangasData(ref: FragmentOf<typeof AllCategoryMangasFragment>) {
  const serverUrl = formatUrl(localStore.getValue(LocalStoreKeys.serverUrl) ?? "");
  const data = readFragment(AllCategoryMangasFragment, ref);

  const mangas: SourceManga[] = [];

  for (const manga of data.mangas.nodes) {
    const { id, thumbnailUrl, description, title, source, author, artist, realUrl, status } = manga;

    mangas.push({
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
    });
  }

  return mangas;
}

export const UpdateCategoriesMutation = graphql(`
  mutation UpdateCategories(
    $mangaIds: [Int!]!
    $addToCategories: [Int!]!
    $removeFromCategories: [Int!]!
  ) {
    updateMangasCategories(
      input: {
        ids: $mangaIds
        patch: { addToCategories: $addToCategories, removeFromCategories: $removeFromCategories }
      }
    ) {
      __typename
    }
  }
`);
