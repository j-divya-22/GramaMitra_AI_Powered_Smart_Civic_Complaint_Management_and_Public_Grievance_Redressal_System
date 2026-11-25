import os
import logging
import threading
from pathlib import Path

logger = logging.getLogger(__name__)
LLM_GGUF_PATH = Path(os.environ.get(
    'LLM_MODEL_PATH',
    Path(__file__).with_name('Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf'),
)).expanduser()

if not LLM_GGUF_PATH.is_absolute():
    ai_directory = Path(__file__).resolve().parent.parent
    candidates = (
        ai_directory / LLM_GGUF_PATH,
        Path(__file__).resolve().parent / LLM_GGUF_PATH,
    )
    LLM_GGUF_PATH = next(
        (candidate.resolve() for candidate in candidates if candidate.is_file()),
        (ai_directory / LLM_GGUF_PATH).resolve(),
    )

class LLMService:
    def __init__(self):
        self.llm = None
        self.load_error = None
        self.lock = threading.Lock()
        self.context_size = int(os.environ.get('LLM_CONTEXT_SIZE', '4096'))
        self._load_local_model()

    def _load_local_model(self):
        try:
            if not LLM_GGUF_PATH.is_file():
                raise FileNotFoundError(f'Local LLM GGUF not found: {LLM_GGUF_PATH}')
            from llama_cpp import Llama
            n_gpu_layers = int(os.environ.get('LLM_GPU_LAYERS', '0'))
            self.llm = Llama(
                model_path=str(LLM_GGUF_PATH),
                n_ctx=self.context_size,
                n_gpu_layers=n_gpu_layers,
                verbose=False,
            )
        except Exception as error:
            self.load_error = error
            logger.exception('Could not load local LLM')

    def generate_complaint(self, category, description, location, language='en', ai_prediction=''):
        prompt = self._build_complaint_prompt(category, description, location, language, ai_prediction)
        return self._call_llm(prompt, language)

    def translate_to_english(self, text, source_language):
        prompt = f"""Translate the citizen's complaint from language code {source_language} into English.
Preserve its meaning and all factual details. Do not add advice, explanations, or facts.
Return only the English translation.

Citizen complaint:
{text}"""
        result = self._call_llm(prompt, 'en')
        if result.get('error'):
            raise RuntimeError(result['error'])

        translated_text = result.get('generated_text', '').strip()
        if not translated_text:
            raise RuntimeError('The translation service returned an empty translation')

        return {
            'translated_text': translated_text,
            'source_language': source_language,
            'language': 'en',
            'model': LLM_GGUF_PATH.name,
        }

    def chat(self, message, language='en', context='', max_tokens=None):
        prompt = self._build_chat_prompt(message, language, context)
        return self._call_llm(prompt, language, max_tokens=max_tokens)

    def _build_complaint_prompt(self, category, description, location, language, ai_prediction):
        return f"""You are Gramamitra, a civic assistance AI for India. Generate a formal complaint in {language}.

Category: {category}
Citizen Description: {description}
Location: {location or 'Not specified'}
AI Image Analysis: {ai_prediction or 'Not provided'}

Write a formal, clear complaint suitable for submission to municipal authorities in {language}."""

    def _build_chat_prompt(self, message, language, context):
        return f"""You are Gramamitra, a helpful multilingual civic assistant for Indian citizens. Respond in {language}.

Citizen Query: {message}
Context: {context or 'None'}

Be helpful, polite, and provide accurate civic guidance."""

    def _call_llm(self, prompt, language, max_tokens=None):
        if self.llm is None:
            return {
                'generated_text': 'I apologize, the local AI model is unavailable.',
                'language': language,
                'error': f'Local LLM unavailable: {self.load_error}',
            }

        try:
            configured_max_tokens = int(os.environ.get('LLM_MAX_TOKENS', '1024'))
            generation_limit = configured_max_tokens
            if max_tokens is not None:
                generation_limit = min(configured_max_tokens, max(64, int(max_tokens)))

            with self.lock:
                result = self.llm.create_chat_completion(
                    messages=[
                        {
                            'role': 'system',
                            'content': (
                                'You are Gramamitra, a civic complaint assistant. '
                                'Answer from the supplied data only, preserve every requested record, '
                                'and never invent missing facts.'
                            ),
                        },
                        {'role': 'user', 'content': prompt},
                    ],
                    max_tokens=generation_limit,
                    temperature=float(os.environ.get('LLM_TEMPERATURE', '0.2')),
                    top_p=float(os.environ.get('LLM_TOP_P', '0.9')),
                )
            text = result.get('choices', [{}])[0].get('message', {}).get('content', '').strip()
            finish_reason = result.get('choices', [{}])[0].get('finish_reason')
            if finish_reason == 'length':
                logger.error('Local LLM response reached max_tokens=%s', generation_limit)
                return {
                    'generated_text': text,
                    'language': language,
                    'model': LLM_GGUF_PATH.name,
                    'error': 'The response reached the configured generation limit. Ask a narrower question or increase LLM_MAX_TOKENS.',
                }
            if text:
                return {
                    'generated_text': text,
                    'language': language,
                    'model': LLM_GGUF_PATH.name,
                    'response': text,
                    'finish_reason': finish_reason,
                }
        except Exception as error:
            logger.exception('Local LLM inference failed')
            return {
                'generated_text': 'I apologize, the local AI model could not generate a response.',
                'language': language,
                'error': f'Local LLM inference failed: {error}',
            }

        return {
            'generated_text': 'I apologize, the local AI model returned an empty response.',
            'language': language,
            'error': 'Local LLM returned an empty response',
        }
