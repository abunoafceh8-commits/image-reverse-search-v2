// Image Reverse Search - Find where images appear on the web
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function searchGoogleImages(imageUrl) {
  try {
    // Google Lens / Reverse Image Search
    const r = await fetch(`https://www.google.com/searchbyimage?image_url=${encodeURIComponent(imageUrl)}`, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    const html = await r.text();
    const results = [];
    
    // Extract visual matches
    const matches = [...html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/g)];
    matches.slice(0, 20).forEach(m => {
      if (!m[1].includes('google.com') && !m[1].includes('gstatic.com')) {
        results.push({
          url: m[1],
          title: m[2],
          source: 'Google',
          confidence: 0.8
        });
      }
    });
    
    return results;
  } catch { return []; }
}

async function searchYandex(imageUrl) {
  try {
    const r = await fetch(`https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(imageUrl)}`, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    const html = await r.text();
    const results = [];
    
    // Extract similar images
    const sites = [...html.matchAll(/data-bem="[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([^<]+)</g)];
    sites.slice(0, 15).forEach(m => {
      results.push({
        url: m[1],
        title: m[2],
        source: 'Yandex',
        confidence: 0.75
      });
    });
    
    return results;
  } catch { return []; }
}

async function searchTinEye(imageUrl) {
  try {
    // TinEye API simulation
    const results = [{
      url: `https://tineye.com/search?url=${encodeURIComponent(imageUrl)}`,
      title: 'TinEye Search Results',
      source: 'TinEye',
      confidence: 0.9
    }];
    return results;
  } catch { return []; }
}

async function searchBing(imageUrl) {
  try {
    const r = await fetch(`https://www.bing.com/images/search?view=detailv2&iss=sbiupload&q=imgurl:${encodeURIComponent(imageUrl)}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000)
    });
    const html = await r.text();
    const results = [];
    
    const links = [...html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*title="([^"]+)"/g)];
    links.slice(0, 10).forEach(m => {
      if (!m[1].includes('bing.com') && !m[1].includes('microsoft.com')) {
        results.push({
          url: m[1],
          title: m[2],
          source: 'Bing',
          confidence: 0.7
        });
      }
    });
    
    return results;
  } catch { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.method === 'POST' 
    ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {})
    : {};
  const imageUrl = body.imageUrl || req.query?.imageUrl || '';
  
  if (!imageUrl) return res.status(400).json({ error: 'Image URL required' });

  // Run all searches in parallel
  const [google, yandex, tineye, bing] = await Promise.allSettled([
    searchGoogleImages(imageUrl),
    searchYandex(imageUrl),
    searchTinEye(imageUrl),
    searchBing(imageUrl)
  ]);

  const results = [
    ...(google.status === 'fulfilled' ? google.value : []),
    ...(yandex.status === 'fulfilled' ? yandex.value : []),
    ...(tineye.status === 'fulfilled' ? tineye.value : []),
    ...(bing.status === 'fulfilled' ? bing.value : [])
  ];

  res.json({
    results,
    total: results.length,
    sources: {
      google: google.status === 'fulfilled' ? google.value.length : 0,
      yandex: yandex.status === 'fulfilled' ? yandex.value.length : 0,
      tineye: tineye.status === 'fulfilled' ? tineye.value.length : 0,
      bing: bing.status === 'fulfilled' ? bing.value.length : 0
    },
    imageUrl,
    timestamp: new Date().toISOString()
  });
}
