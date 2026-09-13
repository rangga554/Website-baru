type TechRule = { name: string; test: (html: string, headers: Record<string, string>) => boolean; category: string };

const rules: TechRule[] = [
  { name: "WordPress", category: "CMS", test: (h) => /wp-content|wp-includes|generator"\s*content="WordPress/i.test(h) },
  { name: "Shopify", category: "CMS", test: (h) => /cdn\.shopify\.com|Shopify\.theme/i.test(h) },
  { name: "Wix", category: "CMS", test: (h) => /static\.wixstatic\.com|wix\.com/i.test(h) },
  { name: "Squarespace", category: "CMS", test: (h) => /squarespace\.com|static1\.squarespace/i.test(h) },
  { name: "Next.js", category: "Framework", test: (h) => /__NEXT_DATA__|_next\/static/i.test(h) },
  { name: "Nuxt", category: "Framework", test: (h) => /__NUXT__|_nuxt\//i.test(h) },
  { name: "React", category: "Framework", test: (h) => /data-reactroot|react-dom|__REACT_DEVTOOLS/i.test(h) },
  { name: "Vue", category: "Framework", test: (h) => /data-v-|__VUE__|vue\.js/i.test(h) },
  { name: "Angular", category: "Framework", test: (h) => /ng-version|angular\.js/i.test(h) },
  { name: "Laravel", category: "Backend", test: (_h, hd) => /laravel_session/i.test(hd["set-cookie"] || "") },
  { name: "Django", category: "Backend", test: (_h, hd) => /csrftoken|django/i.test(hd["set-cookie"] || "") },
  { name: "Express", category: "Backend", test: (_h, hd) => /express/i.test(hd["x-powered-by"] || "") },
  { name: "PHP", category: "Backend", test: (_h, hd) => /php/i.test(hd["x-powered-by"] || "") || /PHPSESSID/i.test(hd["set-cookie"] || "") },
  { name: "ASP.NET", category: "Backend", test: (_h, hd) => /asp\.net/i.test(hd["x-powered-by"] || "") || /ASP\.NET_SessionId/i.test(hd["set-cookie"] || "") },
  { name: "Node.js", category: "Backend", test: (_h, hd) => /node/i.test(hd["x-powered-by"] || "") },
  { name: "Bootstrap", category: "CSS", test: (h) => /bootstrap(\.min)?\.css|bootstrap\.bundle/i.test(h) },
  { name: "Tailwind CSS", category: "CSS", test: (h) => /tailwind/i.test(h) },
  { name: "jQuery", category: "JS Library", test: (h) => /jquery(\.min)?\.js/i.test(h) },
  { name: "Cloudflare", category: "CDN/Security", test: (_h, hd) => !!hd["cf-ray"] },
  { name: "Google Analytics", category: "Analytics", test: (h) => /gtag\(|google-analytics\.com|googletagmanager\.com\/gtag/i.test(h) },
  { name: "Google Tag Manager", category: "Analytics", test: (h) => /googletagmanager\.com\/gtm\.js/i.test(h) },
  { name: "Meta Pixel", category: "Analytics", test: (h) => /connect\.facebook\.net.*fbevents/i.test(h) },
];

export function detectTech(html: string, headers: Record<string, string>) {
  const found = rules.filter((r) => {
    try {
      return r.test(html, headers);
    } catch {
      return false;
    }
  });
  return found.map((f) => ({ name: f.name, category: f.category }));
}
