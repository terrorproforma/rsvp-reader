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

    try {
        // Validate URL
        const targetUrl = new URL(url);

        // Fetch the webpage
        const response = await fetch(targetUrl.href, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; RSVPReader/1.0; +https://readsfast.vercel.app)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            return new Response(
                JSON.stringify({ error: `Failed to fetch URL: ${response.status}` }),
                { status: 400, headers }
            );
        }

        const html = await response.text();

        // Simple article extraction using regex patterns
        // This handles most article sites without external dependencies
        const article = extractArticle(html, targetUrl.href);

        return new Response(JSON.stringify(article), { headers });
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message || 'Failed to extract article' }),
            { status: 500, headers }
        );
    }
}

// Simple article extraction without external libraries
function extractArticle(html, url) {
    // Remove scripts, styles, comments
    let cleaned = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
        html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
        html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : 'Untitled';

    // Try to find article content in common containers
    let content = '';

    // Look for article or main content
    const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
        cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
        cleaned.match(/<div[^>]*class="[^"]*(?:post-content|article-content|entry-content|content-body|post-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    if (articleMatch) {
        content = articleMatch[1];
    } else {
        // Fallback: find the largest text block
        const paragraphs = cleaned.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
        content = paragraphs.join('\n');
    }

    // Convert HTML to plain text
    let text = content
        // Preserve paragraph breaks
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        // Remove all remaining HTML tags
        .replace(/<[^>]+>/g, '')
        // Decode HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        // Clean up whitespace
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

    // Decode any remaining HTML entities
    text = decodeHtmlEntities(text);

    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    return {
        title,
        content: text,
        wordCount,
        url,
    };
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
