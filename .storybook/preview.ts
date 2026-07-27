import "../src/styles/vars.css";
import "../src/styles/content.css";
import "../src/styles/layout.css";
import "../src/styles/components/site-shell.css";

const preview = {
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    controls: {
      expanded: true,
    },
    options: {
      storySort: {
        order: ["Site", ["Header", "Announcement Bar", "Footer"], "Content", "Social"],
      },
    },
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: { width: "390px", height: "844px" },
        },
        tablet: {
          name: "Tablet",
          styles: { width: "768px", height: "1024px" },
        },
        desktop: {
          name: "Desktop",
          styles: { width: "1440px", height: "1000px" },
        },
      },
    },
  },
};

export default preview;
