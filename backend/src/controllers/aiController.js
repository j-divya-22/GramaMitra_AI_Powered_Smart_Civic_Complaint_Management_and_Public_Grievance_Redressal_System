import fetch from 'node-fetch';
import { asyncHandler } from '../middleware/errorHandler.js';
import { classifyImageBuffer } from '../services/cnnClassification.js';
import { chatWithComplaintContext } from '../services/llmChat.js';

export const classifyImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Upload an image using the file field.' });
  }
  const result = await classifyImageBuffer(req.file.buffer, {
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
  });
  res.json(result);
});

export const generateComplaintText = asyncHandler(async (req, res) => {
  const { category, description, location, language = 'en', ai_prediction } = req.body;

  const prompt = `You are Gramamitra, a civic assistance AI. Generate a formal complaint description in ${language} for the following civic issue:
Category: ${category}
Description: ${description}
Location: ${location || 'Not specified'}
AI Image Analysis: ${ai_prediction || 'Not provided'}

Write a clear, formal complaint suitable for submission to municipal authorities. Keep it concise but complete.`;

  try {
    const llmResponse = await fetch(`${process.env.LLM_SERVICE_URL || 'http://localhost:8001'}/api/generate-complaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        description,
        location,
        language,
        ai_prediction,
      }),
    });

    if (!llmResponse.ok) {
      throw new Error('LLM service unavailable');
    }

    const result = await llmResponse.json();
    res.json({
      generated_text: result.response || result.generated_text || 'Complaint text could not be generated.',
      language,
    });
  } catch (err) {
    res.json({
      generated_text: `Formal complaint for ${category} issue at ${location || 'the reported location'}. ${description}`,
      language,
      error: 'LLM service temporarily unavailable, using fallback',
    });
  }
});

export const chat = asyncHandler(async (req, res) => {
  const { message, language = 'en', complaint_id: complaintId, session_id: sessionId } = req.body || {};
  const result = await chatWithComplaintContext({
    user: req.user,
    message,
    language,
    complaintId,
    sessionId,
  });
  res.json({ ...result, language });
});

export const translateToEnglish = asyncHandler(async (req, res) => {
  const llmResponse = await fetch(
    `${process.env.LLM_SERVICE_URL || 'http://localhost:8001'}/api/translate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    }
  );
  const result = await llmResponse.json().catch(() => null);
  if (!llmResponse.ok) {
    return res.status(llmResponse.status).json({
      error: result?.error || 'LLM translation service unavailable',
    });
  }
  res.json(result);
});
