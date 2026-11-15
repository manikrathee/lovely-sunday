/**
 * Client runtime: Swup page transitions, scroll reveal, and header state.
 *
 * - Scroll reveal for `[data-reveal]` elements (`[data-reveal-watch]` elements
 *   are observed but never hidden; used by the footer to start its wordmark).
 * - Keeps the header's `aria-current` correct after client-side navigation.
 */
import Swup from "swup";
import HeadPlugin from "@swup/head-plugin";

const root = document.documentElement;
const REVEAL_SELECTOR = "[data-reveal]";
const WATCH_SELECTOR = "[data-reveal], [data-reveal-watch]";

let observer: IntersectionObserver | null = null;

const motionEnabled = () =>
  "IntersectionObserver" in window &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function bindReveal() {
  observer?.disconnect();
  observer = null;

  if (!motionEnabled()) {
    root.classList.remove("reveal-ready");
    document.querySelectorAll(WATCH_SELECTOR).forEach((el) => el.classList.add("is-visible"));
    return;
  }

  root.classList.add("reveal-ready");

  observer = new IntersectionObserver(
    (entries) => {
      let index = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        if (el.matches(REVEAL_SELECTOR)) {
          // Items entering together cascade, capped at 300ms.
          el.style.setProperty("--reveal-delay", `${Math.min(index, 6) * 50}ms`);
          index += 1;
        }
        el.classList.add("is-visible");
        observer?.unobserve(el);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );

  document.querySelectorAll(WATCH_SELECTOR).forEach((el) => {
    if (!el.classList.contains("is-visible")) observer?.observe(el);
  });
}

function updateAriaCurrent() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  document.querySelectorAll<HTMLAnchorElement>(".site-head-nav a[data-section]").forEach((link) => {
    const sections = (link.dataset.section ?? "").split(/\s+/).filter(Boolean);
    const current = sections.some((section) => path === section || path.startsWith(`${section}/`));
    if (current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

const swup = new Swup({
  containers: ["#swup"],
  cache: true,
  animationSelector: "[class*='transition-']",
  plugins: [new HeadPlugin()],
});

swup.hooks.on("page:view", () => {
  bindReveal();
  updateAriaCurrent();
});

bindReveal();
updateAriaCurrent();
