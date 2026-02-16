(() => {
  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();

  const toAbs = (value) => {
    if (!value) return null;
    try {
      return new URL(value, location.href).href;
    } catch {
      return null;
    }
  };

  const textRoot =
    document.querySelector("main, article, [role='main']") || document.body || document.documentElement;
  const mainText = clean(textRoot.innerText || "");
  let textHash = 0;
  for (let i = 0; i < mainText.length; i++) {
    textHash = (textHash * 31 + mainText.charCodeAt(i)) >>> 0;
  }

  return {
    checkedAt: new Date().toISOString(),
    url: location.href,
    title: clean(document.title),
    canonical: toAbs(document.querySelector("link[rel='canonical']")?.getAttribute("href")),
    h1: Array.from(document.querySelectorAll("h1"))
      .map((el) => clean(el.textContent))
      .filter(Boolean),
    imageCount: document.querySelectorAll("img").length,
    linkCount: document.querySelectorAll("a[href]").length,
    mainTextHash: textHash,
  };
})();
