export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers });
    }

    if (!url) {
        return new Response(
            JSON.stringify({ error: 'URL parameter is required' }),
            { status: 400, headers }
        );
    }

    // Get Diffbot API token from environment
    const diffbotToken = process.env.DIFFBOT_TOKEN;

    try {
        let extractedText = '';
        let title = 'Untitled';
        let source = 'fallback';

        // Extract with Diffbot (or fallback)
        if (diffbotToken) {
            const diffbotResult = await extractWithDiffbot(url, diffbotToken);
            if (diffbotResult) {
                extractedText = diffbotResult.text;
                title = diffbotResult.title;
                source = 'diffbot';
            }
        }

        // Fallback extraction if Diffbot fails or unavailable
        if (!extractedText) {
            const fallbackResult = await fallbackExtraction(url);
            extractedText = fallbackResult.content;
            title = fallbackResult.title;
            source = 'fallback';
        }

        const wordCount = extractedText.split(/\s+/).filter(w => w.length > 0).length;

        return new Response(JSON.stringify({
            title,
            content: extractedText,
            wordCount,
            url,
            source
        }), { headers });

    } catch (error) {
        console.error('Extract error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Failed to extract article' }),
            { status: 500, headers }
        );
    }
}

// Extract article using Diffbot API
async function extractWithDiffbot(url, token) {
    try {
        const diffbotUrl = `https://api.diffbot.com/v3/article?token=${token}&url=${encodeURIComponent(url)}`;
        const response = await fetch(diffbotUrl);
        const data = await response.json();

        if (!response.ok || data.error) {
            console.error('Diffbot error:', data.error || data);
            return null;
        }

        const article = data.objects?.[0];
        if (!article || !article.text) return null;

        return {
            title: article.title || 'Untitled',
            text: article.text
        };
    } catch (error) {
        console.error('Diffbot fetch error:', error);
        return null;
    }
}

// Fallback extraction when Diffbot is unavailable
async function fallbackExtraction(url) {
    try {
        const targetUrl = new URL(url);

        const response = await fetch(targetUrl.href, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; RSVPReader/1.0; +https://readsfast.vercel.app)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status}`);
        }

        const html = await response.text();
        return extractArticle(html, url);
    } catch (error) {
        throw error;
    }
}

// Basic article extraction without external libraries
function extractArticle(html, url) {
    let cleaned = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
        html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : 'Untitled';

    let content = '';
    const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
        cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

    if (articleMatch) {
        content = articleMatch[1];
    } else {
        const paragraphs = cleaned.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
        content = paragraphs.join('\n');
    }

    let text = content
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

    text = decodeHtmlEntities(text);
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    return { title, content: text, wordCount, url };
}

function decodeHtmlEntities(text) {
    return text
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&hellip;/g, '...')
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&lsquo;/g, "'")
        .replace(/&rsquo;/g, "'");
}
