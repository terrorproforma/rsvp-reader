export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers });
    }

    if (!url) {
        return new Response(JSON.stringify({ error: 'URL parameter is required' }), { status: 400, headers });
    }

    const diffbotToken = process.env.DIFFBOT_TOKEN;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    try {
        let extractedText = '';
        let title = 'Untitled';
        let source = 'fallback';

        // Extract with Diffbot
        if (diffbotToken) {
            const diffbotResult = await extractWithDiffbot(url, diffbotToken);
            if (diffbotResult) {
                extractedText = diffbotResult.text;
                title = diffbotResult.title;
                source = 'diffbot';
            }
        }

        // Fallback if Diffbot fails
        if (!extractedText) {
            const fallbackResult = await fallbackExtraction(url);
            extractedText = fallbackResult.content;
            title = fallbackResult.title;
            source = 'fallback';
        }

        // Clean start/end with Gemini (chunked approach - fast!)
        if (geminiApiKey && extractedText.length > 500) {
            const cleanedText = await cleanWithGeminiChunked(extractedText, geminiApiKey);
            if (cleanedText) {
                extractedText = cleanedText;
                source += '+gemini';
            }
        }

        const wordCount = extractedText.split(/\s+/).filter(w => w.length > 0).length;

        return new Response(JSON.stringify({ title, content: extractedText, wordCount, url, source }), { headers });

    } catch (error) {
        console.error('Extract error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Failed to extract article' }), { status: 500, headers });
    }
}

// Clean only first/last chunks with Gemini (fast, stays under timeout)
async function cleanWithGeminiChunked(text, apiKey) {
    try {
        const CHUNK_SIZE = 1500;
        const startChunk = text.substring(0, CHUNK_SIZE);
        const endChunk = text.substring(text.length - CHUNK_SIZE);
        const middleStart = CHUNK_SIZE;
        const middleEnd = text.length - CHUNK_SIZE;

        // Skip if article is too short to have middle section
        if (middleEnd <= middleStart) {
            return await cleanFullWithGemini(text, apiKey);
        }

        const prompt = `You are a text trimmer. Your job is to REMOVE noise from the START and END of article text, preserving EXACT formatting and content otherwise.

RULES:
1. Do NOT add any new text (no titles, no summaries)
2. Do NOT rewrite or rephrase anything
3. PRESERVE all paragraph breaks (newlines) exactly as they are
4. Only REMOVE the following types of noise:

FOR START: Remove ONLY these specific types of lines:
- Subscriber count lines like "Welcome to the X newly..." or "Join X,XXX subscribers"
- "Subscribe here" prompts or subscription links
- Do NOT remove author greetings like "Hi friends" - these are part of the article

FOR END: Remove lines containing:
- "Thanks for reading" / "That's all for today"
- Author sign-offs (e.g., "Packy", "Best, [Name]")
- Paywall notices / "Keep reading with a free trial"
- "Join us behind the paywall"
- Sponsor thanks / credits lines

Return your response in this EXACT format:

===START===
[trimmed start chunk, with original formatting preserved]
===END===
[trimmed end chunk, with original formatting preserved]

---
START CHUNK TO TRIM:
${startChunk}

---
END CHUNK TO TRIM:
${endChunk}`;

        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 4000, temperature: 0 }
                })
            }
        );

        const data = await response.json();
        if (!response.ok) {
            console.error('Gemini error:', data);
            return null;
        }

        const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!result) return null;

        // Parse the cleaned chunks
        const startMatch = result.match(/===START===\s*([\s\S]*?)===END===/);
        const endMatch = result.match(/===END===\s*([\s\S]*)$/);

        if (startMatch && endMatch) {
            const cleanedStart = startMatch[1].trim();
            const cleanedEnd = endMatch[1].trim();
            const middle = text.substring(middleStart, middleEnd);

            // Preserve paragraph structure with proper spacing
            return cleanedStart + '\n\n' + middle + '\n\n' + cleanedEnd;
        }

        return null;
    } catch (error) {
        console.error('Gemini chunk error:', error);
        return null;
    }
}

// Fallback for short articles
async function cleanFullWithGemini(text, apiKey) {
    try {
        const prompt = `Clean this article text. Remove newsletter intros, subscription prompts, author greetings, paywall notices, and sign-offs. Return ONLY the cleaned article:

${text}`;

        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 4000, temperature: 0.1 }
                })
            }
        );

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch {
        return null;
    }
}

async function extractWithDiffbot(url, token) {
    try {
        const diffbotUrl = `https://api.diffbot.com/v3/article?token=${token}&url=${encodeURIComponent(url)}`;
        const response = await fetch(diffbotUrl);
        const data = await response.json();
        if (!response.ok || data.error) return null;
        const article = data.objects?.[0];
        return article?.text ? { title: article.title || 'Untitled', text: article.text } : null;
    } catch {
        return null;
    }
}

async function fallbackExtraction(url) {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSVPReader/1.0)', 'Accept': 'text/html' }
    });
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    const html = await response.text();

    let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i) || cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    let content = articleMatch ? articleMatch[1] : (cleaned.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []).join('\n');

    content = content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    return { title, content, wordCount: content.split(/\s+/).length, url };
}
