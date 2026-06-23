import { graphql, readFragment, type FragmentOf, type ResultOf } from "../network/graphql";

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

type Category = ResultOf<typeof AvailableCategoriesFragment>["categories"]["nodes"][number];

export function getAvailableCategories(
  ref: FragmentOf<typeof AvailableCategoriesFragment>,
): Category[] {
  const data = readFragment(AvailableCategoriesFragment, ref);
  return data.categories.nodes
    .filter((category) => category.name !== "Default")
    .toSorted((a, b) => a.order - b.order);
}

export function getAvailableSelectedCategories(
  ref: FragmentOf<typeof AvailableCategoriesFragment>,
  selectedCategories: string[],
): Category[] {
  const categories = getAvailableCategories(ref);
  return categories.filter((category) => selectedCategories.some((c) => c === category.name));
}
