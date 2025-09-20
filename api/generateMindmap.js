const { OpenAI } = require("openai");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://nextstep-guide.netlify.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Only POST requests allowed" });

  try {
    if (!process.env.OPENAI_API_KEY)
      throw new Error("Missing OPENAI_API_KEY");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: "Answers are required array" });
    }

    const prompt = `Generate mind map from: ${JSON.stringify(answers)}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful mind map assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    res.status(200).json({ mindmap: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
