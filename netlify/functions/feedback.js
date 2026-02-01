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
    const { question, correctAnswer, studentAnswer, isCorrect } = JSON.parse(event.body);

    const prompt = `You are a friendly writing tutor giving brief feedback on sentence type identification.

Sentence: "${question}"
Correct type: ${correctAnswer}
Student answered: ${studentAnswer}
Result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}

${isCorrect
  ? `Give 2 sentences: (1) Praise their correct answer. (2) Briefly explain what makes this a ${correctAnswer} sentence.`
  : `Give 3 sentences: (1) Kindly note their answer was close but not quite right. (2) Explain why this is a ${correctAnswer} sentence - mention the specific clause structure or conjunctions. (3) End with encouragement.`}

Be warm and concise. No bullet points.`;

    // Try with timeout and retry
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let lastError = null;

    // Try up to 2 times
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://w002-sentence-types-practice.netlify.app',
            'X-Title': 'Sentence Types Practice'
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 150,
            temperature: 0.6
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          lastError = `HTTP ${response.status}`;
          continue;
        }

        const data = await response.json();

        if (data.error) {
          lastError = data.error.message || 'API error';
          continue;
        }

        const feedback = data.choices?.[0]?.message?.content;

        if (feedback && feedback.length > 10) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedback: feedback.trim() })
          };
        }

        lastError = 'Empty response';
      } catch (fetchError) {
        lastError = fetchError.message;
        if (fetchError.name === 'AbortError') break;
      }
    }

    // If all retries failed, return a helpful fallback
    const fallback = isCorrect
      ? `Great job! You correctly identified this as a ${correctAnswer} sentence.`
      : `This is actually a ${correctAnswer} sentence. Look for the clause structure and connecting words to help identify sentence types.`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: fallback, fallback: true })
    };

  } catch (error) {
    console.error('Function error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
