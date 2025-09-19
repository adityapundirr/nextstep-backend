import { OpenAI } from 'openai';

export default async function handler(req, res) {
    // Set CORS headers for your Netlify frontend
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', 'https://nextstep-guide.netlify.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Only POST requests are allowed' });
    }

    try {
        // Initialize OpenAI with API key from environment variables
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OpenAI API key is not configured.");
        }
        
        const openai = new OpenAI({ apiKey });

        // Extract quiz answers from request body
        const { answers } = req.body;
        if (!answers) {
            return res.status(400).json({ error: 'Quiz answers are required.' });
        }
        
        // Define your prompts (same as your Google Cloud version)
        const getRecommenderPrompt = (quizAnswersJson) => {
            return `You are an expert career and academic advisor AI specifically designed for students in India, particularly those in Class 10 and 12.

Your task: Analyze the student's quiz responses and recommend the most suitable academic stream or field of interest.

For Class 10 students: Recommend one of these streams:
- science_stream
- commerce_stream  
- arts_stream

For Class 12 students: Recommend a specific field from this list:
- software_development_it
- data_science_analytics
- mechanical_engineering
- civil_engineering
- electrical_engineering
- biotechnology
- medicine_healthcare
- finance_banking
- marketing_brand_strategy
- entrepreneurship_business
- psychology_counseling
- journalism_media
- graphic_design_animation
- architecture_planning
- environmental_science

Quiz Data: ${quizAnswersJson}

Return your response as a JSON object with this exact structure:
{
    "recommended_field_id": "field_name_here",
    "confidence_score": 85,
    "reasoning": "Detailed explanation of why this field suits the student"
}`;
        };

        const getMindMapPrompt = (fieldName, fieldDescription) => {
            return `You are a world-class expert and educator creating a comprehensive career mind map for Indian students.

Create a detailed mind map for: ${fieldName}
Description: ${fieldDescription}

Structure your response as a JSON object with these main branches:

{
    "title": "${fieldName}",
    "description": "Brief overview of this field",
    "branches": {
        "academics": {
            "title": "Academic Path",
            "items": [
                {
                    "name": "Required subjects/courses",
                    "details": "Specific subjects to focus on"
                }
            ]
        },
        "skills": {
            "title": "Essential Skills",
            "items": [
                {
                    "name": "Technical skills needed",
                    "details": "Specific technical competencies"
                }
            ]
        },
        "career_paths": {
            "title": "Career Opportunities",
            "items": [
                {
                    "name": "Job roles available",
                    "details": "Specific positions and responsibilities"
                }
            ]
        },
        "future_scope": {
            "title": "Future Prospects",
            "items": [
                {
                    "name": "Growth opportunities",
                    "details": "Long-term career development"
                }
            ]
        }
    }
}`;
        };

        console.log('Stage 1: Analyzing quiz answers with OpenAI...');
        
        // Stage 1: Get field recommendation
        const recommenderPrompt = getRecommenderPrompt(JSON.stringify(answers, null, 2));
        const recommenderResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: "You are a JSON-only API that responds with valid JSON." },
                { role: "user", content: recommenderPrompt }
            ],
            max_tokens: 1000,
            temperature: 0.3
        });

        const responseText = recommenderResponse.choices.message.content;
        const recommendationData = JSON.parse(responseText);
        const topFieldId = recommendationData.recommended_field_id;
        
        if (!topFieldId) {
            return res.status(500).json({ error: "Could not determine field of interest." });
        }

        console.log(`Stage 2: Generating mind map for ${topFieldId} with OpenAI...`);
        
        // Stage 2: Generate mind map
        const title = topFieldId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const description = recommendationData.reasoning || "A fascinating field with many opportunities.";
        const mindMapPrompt = getMindMapPrompt(title, description);

        const mindMapResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: "You are a JSON-only API that responds with valid JSON." },
                { role: "user", content: mindMapPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.5
        });

        const mindMapJsonText = mindMapResponse.choices.message.content;
        const mindMapData = JSON.parse(mindMapJsonText);
        
        // Return the complete response
        return res.status(200).json({
            recommended_field_id: topFieldId,
            confidence_score: recommendationData.confidence_score,
            reasoning: recommendationData.reasoning,
            mind_map_data: mindMapData
        });

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
        return res.status(500).json({ 
            error: 'Internal server error during AI processing.',
            details: error.message 
        });
    }
}
