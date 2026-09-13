import * as cheerio from "cheerio";

export async function analyzeSeo(html: string, baseUrl: string) {
  const $ = cheerio.load(html);
  const origin = new URL(baseUrl).origin;

  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content") || null;
  const canonical = $('link[rel="canonical"]').attr("href") || null;
  const robotsMeta = $('meta[name="robots"]').attr("content") || null;
  const lang = $("html").attr("lang") || null;

  const og: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr("property");
    const content = $(el).attr("content");
    if (prop && content) og[prop] = content;
  });

  const twitter: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr("name");
    const content = $(el).attr("content");
    if (name && content) twitter[name] = content;
  });

  const jsonLd: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      jsonLd.push(JSON.parse($(el).contents().text()));
    } catch {
      // ignore malformed JSON-LD
    }
  });

  const h1 = $("h1").map((_, el) => $(el).text().trim()).get();
  const headingCounts: Record<string, number> = {};
  for (let i = 1; i <= 6; i++) headingCounts[`h${i}`] = $(`h${i}`).length;

  const images = $("img");
  const imagesTotal = images.length;
  const imagesWithoutAlt = images.filter((_, el) => !$(el).attr("alt")).length;

  const [robotsTxt, sitemap] = await Promise.all([
    fetch(`${origin}/robots.txt`).then((r) => (r.ok ? r.text() : null)).catch(() => null),
    fetch(`${origin}/sitemap.xml`).then((r) => (r.ok ? true : false)).catch(() => false),
  ]);

  return {
    title,
    titleLength: title?.length || 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length || 0,
    canonical,
    robotsMeta,
    robotsTxt: robotsTxt !== null,
    sitemapXml: sitemap,
    openGraph: og,
    twitterCard: twitter,
    structuredData: jsonLd,
    h1,
    h1Count: h1.length,
    headingCounts,
    imagesTotal,
    imagesWithoutAlt,
    language: lang,
  };
}
