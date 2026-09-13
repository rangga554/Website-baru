import * as cheerio from "cheerio";

export function analyzePage(html: string, baseUrl: string) {
  const $ = cheerio.load(html);
  const origin = new URL(baseUrl).origin;

  const links = $("a[href]");
  let internal = 0;
  let external = 0;
  links.each((_, el) => {
    const href = $(el).attr("href") || "";
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.origin === origin) internal++;
      else external++;
    } catch {
      internal++;
    }
  });

  return {
    scripts: $("script").length,
    stylesheets: $('link[rel="stylesheet"]').length + $("style").length,
    images: $("img").length,
    links: links.length,
    externalLinks: external,
    internalLinks: internal,
    iframes: $("iframe").length,
    forms: $("form").length,
    videos: $("video").length,
    audio: $("audio").length,
  };
}
