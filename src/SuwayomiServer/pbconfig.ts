import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "Suwayomi Server",
  description:
    "A Paperback extension that integrates with your self-hosted Suwayomi Server instance.",
  version: "0.0.2",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
    SourceIntents.SETTINGS_FORM_PROVIDING,
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
    SourceIntents.PROGRESS_PROVIDING,
    SourceIntents.MANAGED_COLLECTION_PROVIDING,
  ],
  badges: [
    {
      label: "Self-Hosted",
      backgroundColor: "#000000",
      textColor: "#FFFFFF",
    },
  ],
  developers: [
    {
      name: "vishnumad",
      website: "https://vishnumad.com",
      github: "https://github.com/vishnumad",
    },
  ],
} satisfies ExtensionInfo;
