(() => {
  const toAbs = (href) => {
    try {
      return new URL(href, location.href).href;
    } catch {
      return null;
    }
  };

  const selectors = [
    "nav a[href]",
    "[role='navigation'] a[href]",
    "header a[href]",
    "footer a[href]",
  ];

  const links = [];
  for (const selector of selectors) {
    for (const el of document.querySelectorAll(selector)) {
      const value = toAbs(el.getAttribute("href"));
      if (value) {
        links.push(value);
      }
    }
  }

  return Array.from(new Set(links));
})();
