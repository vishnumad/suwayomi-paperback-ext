import { graphql, readFragment, type FragmentOf } from "../network/graphql";

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
