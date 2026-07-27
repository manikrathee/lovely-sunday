import LinkBlock from "./LinkBlock.astro";

export default {
  title: "Content/Link Block",
  component: LinkBlock,
  parameters: {
    docs: {
      description: {
        component: "Previous/next navigation link for sequential editorial content.",
      },
    },
  },
};

export const Next = {
  args: {
    href: "/lookbook/",
    label: "Explore the lookbook",
    direction: "next",
  },
};

export const Previous = {
  args: {
    href: "/daily-diary/",
    label: "Back to the archive",
    direction: "prev",
  },
};
