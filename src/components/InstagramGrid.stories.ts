import InstagramGrid from "./InstagramGrid.astro";

const posts = [
  {
    shortcode: "lovely-sunday-1",
    imageUrl: "/img/clay-images-6.jpg",
    permalink: "https://www.instagram.com/_lovelysunday/",
    caption: "Lovely Sunday editorial detail",
  },
  {
    shortcode: "lovely-sunday-2",
    imageUrl: "/img/clay-images-7.jpg",
    permalink: "https://www.instagram.com/_lovelysunday/",
    caption: "A favorite look from the archive",
  },
  {
    shortcode: "lovely-sunday-3",
    imageUrl: "/img/clay-images-8.jpg",
    permalink: "https://www.instagram.com/_lovelysunday/",
    caption: "Travel diary moment",
  },
];

export default {
  title: "Social/Instagram Grid",
  component: InstagramGrid,
  parameters: {
    docs: {
      description: {
        component: "Responsive social-photo grid. Empty results intentionally render no section.",
      },
    },
  },
  args: {
    title: "From @_lovelysunday on Instagram",
    subtitle: "Recent looks and travel moments.",
    posts,
  },
};

export const Populated = {
  args: {
    posts,
  },
};

export const Empty = {
  args: {
    posts: [],
  },
};
