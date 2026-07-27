import AnnouncementBar from "./AnnouncementBar.astro";

const meta = {
  title: "Site/Announcement Bar",
  component: AnnouncementBar,
  parameters: {
    docs: {
      description: {
        component: "Dismissible, polite-status announcement used for time-sensitive site messaging.",
      },
    },
  },
  args: {
    message:
      "Sign up for our email list and be the first to see Lovely Sunday's latest looks.",
  },
};

export default meta;

export const Default = {};

export const WithStudioNote = {
  args: {
    message: "Studio notes, first looks, and new releases. Sent sparingly.",
  },
};
