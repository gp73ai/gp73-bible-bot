export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "No question provided" });
  }

  try {
    // 1. Try Supabase first
    const supabaseRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/documents?select=content&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );

    const supabaseData = await supabaseRes.json();

    if (supabaseData && supabaseData.length > 0) {
      return res.status(200).json({
        source: "supabase",
        answer: supabaseData[0].content,
      });
    }

    // 2. Fallback to OpenAI
    const aiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.3",
        input: `Answer this Bible question clearly and spiritually: ${question}`,
      }),
    });

    const aiData = await aiRes.json();

    return res.status(200).json({
      source: "openai",
      answer:
        aiData.output?.[0]?.content?.[0]?.text ||
        "No response from AI",
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
}