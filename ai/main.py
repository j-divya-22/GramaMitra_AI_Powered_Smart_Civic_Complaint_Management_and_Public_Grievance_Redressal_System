import os
import logging

from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge

load_dotenv()

from llm.service import LLMService

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = int(os.environ.get('CNN_MAX_UPLOAD_MB', '8')) * 1024 * 1024
CORS(app)

CNN_ENABLED = os.environ.get('CNN_ENABLED', 'true').strip().lower() in {'1', 'true', 'yes', 'on'}
if CNN_ENABLED:
    from cnn.model import CNNModel, InvalidImageError, ModelUnavailableError
    cnn_model = CNNModel()
else:
    cnn_model = None
llm_service = None if CNN_ENABLED else LLMService()
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'Gramamitra AI'})

@app.route('/api/classify', methods=['POST'])
def classify():
    if not CNN_ENABLED:
        return jsonify({'error': 'CNN classification is disabled in this AI service process.'}), 503
    uploaded_file = request.files.get('file')
    if uploaded_file is None:
        return jsonify({'error': 'Upload an image using the file field.'}), 400

    try:
        result = cnn_model.predict(uploaded_file.read())
        return jsonify(result)
    except InvalidImageError as error:
        return jsonify({'error': str(error)}), 400
    except ModelUnavailableError as error:
        logger.error('CNN classification unavailable: %s', error)
        return jsonify({'error': str(error)}), 503
    except Exception:
        logger.exception('Unexpected CNN classification failure')
        return jsonify({
            'error': 'Image classification failed unexpectedly.'
        }), 500


@app.errorhandler(RequestEntityTooLarge)
def handle_upload_too_large(error):
    return jsonify({'error': 'Image exceeds the configured upload size limit.'}), 413

@app.route('/api/generate-complaint', methods=['POST'])
def generate_complaint():
    if llm_service is None:
        return jsonify({'error': 'The LLM service is not enabled in this process.'}), 503
    data = request.get_json(silent=True) or {}
    category = data.get('category', '')
    description = data.get('description', '')
    location = data.get('location', '')
    language = data.get('language', 'en')
    ai_prediction = data.get('ai_prediction', '')

    try:
        result = llm_service.generate_complaint(
            category=category,
            description=description,
            location=location,
            language=language,
            ai_prediction=ai_prediction,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'generated_text': f'Formal complaint for {category} issue. {description}',
            'language': language,
            'error': str(e)
        }), 500

@app.route('/api/translate', methods=['POST'])
def translate():
    if llm_service is None:
        return jsonify({'error': 'The LLM service is not enabled in this process.'}), 503
    data = request.get_json(silent=True) or {}
    text = data.get('text')
    source_language = data.get('source_language', '')

    if not isinstance(text, str) or not text.strip() or len(text) > 5000:
        return jsonify({'error': 'Complaint text must contain between 1 and 5000 characters'}), 400
    if not isinstance(source_language, str) or not source_language.strip() or len(source_language) > 20:
        return jsonify({'error': 'A valid source language code is required'}), 400

    try:
        result = llm_service.translate_to_english(text.strip(), source_language.strip())
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'English translation is unavailable: {e}'}), 503

@app.route('/api/chat', methods=['POST'])
def chat():
    if llm_service is None:
        return jsonify({'error': 'The LLM service is not enabled in this process.'}), 503
    data = request.get_json(silent=True) or {}
    message = data.get('message', '')
    language = data.get('language', 'en')
    context = data.get('context', '')
    max_tokens = data.get('max_tokens')

    try:
        result = llm_service.chat(
            message=message,
            language=language,
            context=context,
            max_tokens=max_tokens,
        )
        if result.get('error'):
            logger.error('LLM chat generation failed: %s', result['error'])
            return jsonify(result), 502
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'response': 'AI service temporarily unavailable.',
            'language': language,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('LLM_PORT', 8001) if not CNN_ENABLED
               else os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
