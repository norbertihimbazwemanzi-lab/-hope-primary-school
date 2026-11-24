interface ApiRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    send: (body: string) => void;
    end: () => void;
  };
}

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).end();
  }

  const rawForwardedHost = req.headers?.['x-forwarded-host'];
  const forwardedHost = Array.isArray(rawForwardedHost) ? rawForwardedHost[0] : rawForwardedHost;
  const rawHost = req.headers?.host;
  const hostHeader = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  const resolvedHost = String(forwardedHost || hostHeader || '').split(',')[0].trim();
  const isSafeHost = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(resolvedHost);

  const originFromHeaders =
    isSafeHost && resolvedHost && !resolvedHost.includes('localhost') && !resolvedHost.includes('127.0.0.1')
      ? `https://${resolvedHost}`
      : '';

  const baseUrl = (
    process.env.APP_URL ||
    originFromHeaders ||
    'https://mugina-hope-primary-school-u2su.vercel.app'
  ).replace(/\/+$/, '');

  const lastMod = new Date().toISOString().split('T')[0];
  const routes = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/about', changefreq: 'monthly', priority: '0.9' },
    { path: '/staff', changefreq: 'monthly', priority: '0.8' },
    { path: '/admissions', changefreq: 'weekly', priority: '0.9' },
    { path: '/fees', changefreq: 'monthly', priority: '0.9' },
    { path: '/campus-life', changefreq: 'weekly', priority: '0.8' },
    { path: '/contact', changefreq: 'monthly', priority: '0.8' },
  ];

  const urlsXml = routes
    .map(
      (r) => `  <url>
    <loc>${baseUrl}${r.path}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>
`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  return res.status(200).send(xml);
}
