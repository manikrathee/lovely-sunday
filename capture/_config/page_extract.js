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

  const uniq = (values) => Array.from(new Set(values.filter(Boolean)));

  const getMeta = (selector) => {
    const el = document.querySelector(selector);
    return el ? clean(el.getAttribute("content") || "") || null : null;
  };

  const headings = {};
  for (const level of [1, 2, 3, 4, 5, 6]) {
    headings[`h${level}`] = Array.from(document.querySelectorAll(`h${level}`))
      .map((el) => clean(el.textContent))
      .filter(Boolean);
  }

  const links = Array.from(document.querySelectorAll("a[href]")).map((el) => ({
    href: toAbs(el.getAttribute("href")),
    text: clean(el.textContent),
    rel: clean(el.getAttribute("rel")),
    target: clean(el.getAttribute("target")),
  }));

  const images = Array.from(document.querySelectorAll("img")).map((el) => ({
    src: toAbs(el.getAttribute("src")),
    alt: clean(el.getAttribute("alt")),
    width: el.naturalWidth || null,
    height: el.naturalHeight || null,
    srcset: uniq(
      (el.getAttribute("srcset") || "")
        .split(",")
        .map((entry) => entry.trim().split(" ")[0])
        .map((src) => toAbs(src))
    ),
  }));

  const videos = Array.from(
    document.querySelectorAll("video, video source, audio, audio source")
  ).map((el) => ({
    tag: el.tagName.toLowerCase(),
    src: toAbs(el.getAttribute("src")),
    type: clean(el.getAttribute("type")),
  }));

  const scripts = Array.from(document.querySelectorAll("script[src]")).map((el) => ({
    src: toAbs(el.getAttribute("src")),
    type: clean(el.getAttribute("type")),
    async: !!el.async,
    defer: !!el.defer,
  }));

  const stylesheets = Array.from(
    document.querySelectorAll("link[rel='stylesheet'], link[as='style']")
  ).map((el) => ({
    href: toAbs(el.getAttribute("href")),
    rel: clean(el.getAttribute("rel")),
    as: clean(el.getAttribute("as")),
  }));

  const icons = uniq(
    Array.from(document.querySelectorAll("link[rel*='icon']"))
      .map((el) => toAbs(el.getAttribute("href")))
      .filter(Boolean)
  );

  const jsonLd = Array.from(document.querySelectorAll("script[type='application/ld+json']"))
    .map((el) => clean(el.textContent))
    .filter(Boolean);

  const navLinks = uniq(
    Array.from(
      document.querySelectorAll("nav a[href], [role='navigation'] a[href], header a[href], footer a[href]")
    ).map((el) => toAbs(el.getAttribute("href")))
  );

  const textRoot =
    document.querySelector("main, article, [role='main']") || document.body || document.documentElement;

  const paragraphs = Array.from(textRoot.querySelectorAll("p"))
    .map((el) => clean(el.textContent))
    .filter(Boolean);

  const listItems = Array.from(textRoot.querySelectorAll("li"))
    .map((el) => clean(el.textContent))
    .filter(Boolean);

  const resourceEntries = performance.getEntriesByType("resource").map((entry) => ({
    name: entry.name || null,
    initiatorType: entry.initiatorType || null,
    duration: Number.isFinite(entry.duration) ? Number(entry.duration.toFixed(2)) : null,
    transferSize: Number.isFinite(entry.transferSize) ? entry.transferSize : null,
    encodedBodySize: Number.isFinite(entry.encodedBodySize) ? entry.encodedBodySize : null,
    decodedBodySize: Number.isFinite(entry.decodedBodySize) ? entry.decodedBodySize : null,
  }));

  return {
    capturedAt: new Date().toISOString(),
    url: location.href,
    title: clean(document.title),
    canonical: toAbs(document.querySelector("link[rel='canonical']")?.getAttribute("href")),
    meta: {
      description: getMeta("meta[name='description']"),
      robots: getMeta("meta[name='robots']"),
      viewport: document.querySelector("meta[name='viewport']")?.getAttribute("content") || null,
    },
    openGraph: {
      title: getMeta("meta[property='og:title']"),
      description: getMeta("meta[property='og:description']"),
      image: toAbs(getMeta("meta[property='og:image']")),
      type: getMeta("meta[property='og:type']"),
      url: toAbs(getMeta("meta[property='og:url']")),
    },
    twitter: {
      card: getMeta("meta[name='twitter:card']"),
      title: getMeta("meta[name='twitter:title']"),
      description: getMeta("meta[name='twitter:description']"),
      image: toAbs(getMeta("meta[name='twitter:image']")),
    },
    headings,
    navLinks,
    mainText: clean(textRoot.innerText || ""),
    paragraphs,
    listItems,
    links,
    images,
    videos,
    scripts,
    stylesheets,
    icons,
    jsonLd,
    resourceEntries,
    counts: {
      links: links.length,
      images: images.length,
      paragraphs: paragraphs.length,
      listItems: listItems.length,
      scripts: scripts.length,
      stylesheets: stylesheets.length,
      jsonLd: jsonLd.length,
      resources: resourceEntries.length,
    },
  };
})();
