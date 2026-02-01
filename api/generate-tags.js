// Vercel Serverless Function for AI Tag Generation
// POST /api/generate-tags
// Body: { title: string, url: string }
// Response: { tags: string[] }

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { title, url } = req.body;

    if (!title && !url) {
        return res.status(400).json({ error: 'Title or URL is required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY not set');
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const prompt = `以下のWebページのタイトルとURLから、適切なタグを3-5個、日本語で生成してください。
タグはカンマ区切りで出力してください。タグのみを出力し、他の説明は不要です。

タイトル: ${title || '不明'}
URL: ${url || '不明'}

タグ:`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 100,
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Gemini API error:', errorData);
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // タグを抽出（カンマ区切り）
        const tags = generatedText
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0 && tag.length < 20) // 長すぎるタグを除外
            .slice(0, 5); // 最大5個

        return res.status(200).json({ tags });

    } catch (error) {
        console.error('Tag generation error:', error);
        return res.status(500).json({
            error: 'Failed to generate tags',
            message: error.message
        });
    }
}
