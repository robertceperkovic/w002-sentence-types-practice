exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const { question, correctAnswer, studentAnswer, isCorrect, sentenceType } = JSON.parse(event.body);

    const prompt = `You are a helpful writing instructor providing brief, encouraging feedback to a student practicing sentence type identification.

The student was asked to identify the type of this sentence:
"${question}"

Correct answer: ${correctAnswer}
Student's answer: ${studentAnswer}
Result: ${isCorrect ? 'Correct' : 'Incorrect'}

${isCorrect
  ? `Provide a brief (2-3 sentences) encouraging response that:
1. Affirms their correct answer
2. Briefly explains why this is a ${correctAnswer.toLowerCase()} sentence (mention the key structural element that makes it so)`
  : `Provide a brief (3-4 sentences) helpful response that:
1. Gently acknowledge their attempt
2. Explain why this is actually a ${correctAnswer.toLowerCase()} sentence
3. Point out the specific structural element(s) they should look for (clauses, conjunctions, etc.)
4. End with brief encouragement`}

Keep your response concise and student-friendly. Do not use bullet points or numbered lists.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://w002-sentence-types-practice.netlify.app',
        'X-Title': 'Sentence Types Practice'
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('OpenRouter error:', data.error);
      return { statusCode: 500, body: JSON.stringify({ error: 'AI service error' }) };
    }

    const feedback = data.choices?.[0]?.message?.content || 'Unable to generate feedback.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback })
    };

  } catch (error) {
    console.error('Function error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
