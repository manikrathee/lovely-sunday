import ImageBlock from "./ImageBlock.astro";

export default {
  title: "Content/Image Block",
  component: ImageBlock,
  parameters: {
    docs: {
      description: {
        component: "Responsive editorial image wrapper. It renders nothing when no source is provided.",
      },
    },
  },
};

export const Default = {
  args: {
    src: "/img/clay-images-10.jpg",
    alt: "Editorial still life",
  },
};

export const EagerHero = {
  args: {
    src: "/img/clay-images-15.jpg",
    alt: "Featured Lovely Sunday editorial",
    loading: "eager",
  },
};
