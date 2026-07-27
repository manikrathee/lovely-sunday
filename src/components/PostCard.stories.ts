import PostCard from "./PostCard.astro";

const meta = {
  title: "Content/Post Card",
  component: PostCard,
  parameters: {
    docs: {
      description: {
        component: "Editorial card used by archive and collection grids.",
      },
    },
  },
  args: {
    slug: "lookbook/balmain-blazer",
    post: {
      data: {
        title: "Balmain Blazer",
        thumbnail: "/img/clay-image-1.jpg",
      },
    },
  },
};

export default meta;

export const WithImage = {
  args: {},
};

export const WithoutImage = {
  args: {
    slug: "daily-diary",
    post: {
      data: {
        title: "Daily Diary",
      },
    },
  },
};
