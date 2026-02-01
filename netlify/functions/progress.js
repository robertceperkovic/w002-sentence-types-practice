const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const store = getStore("student-progress");

  // GET - retrieve student progress
  if (event.httpMethod === 'GET') {
    const studentId = event.queryStringParameters?.studentId;

    if (!studentId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Student ID required' }) };
    }

    try {
      const data = await store.get(studentId, { type: 'json' });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || { attempts: [] })
      };
    } catch (error) {
      console.error('Get progress error:', error);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempts: [] })
      };
    }
  }

  // POST - save student progress
  if (event.httpMethod === 'POST') {
    try {
      const { studentId, attempt } = JSON.parse(event.body);

      if (!studentId || !attempt) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Student ID and attempt data required' }) };
      }

      // Get existing data
      let data = { attempts: [] };
      try {
        const existing = await store.get(studentId, { type: 'json' });
        if (existing) data = existing;
      } catch (e) {
        // No existing data, use empty
      }

      // Add new attempt (keep last 20 attempts)
      data.attempts.unshift({
        ...attempt,
        timestamp: new Date().toISOString()
      });
      data.attempts = data.attempts.slice(0, 20);

      // Save
      await store.setJSON(studentId, data);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, totalAttempts: data.attempts.length })
      };
    } catch (error) {
      console.error('Save progress error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save progress' }) };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
