import io
import json
import logging
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

MODEL_PATH = Path(os.environ.get(
    'CNN_MODEL_PATH',
    Path(__file__).with_name('civic_mobilenet_v3_v3_11.keras'),
)).expanduser().resolve()
METADATA_PATH = Path(os.environ.get(
    'CNN_METADATA_PATH',
    Path(__file__).with_name('class_metadata_v3.json'),
)).expanduser().resolve()
MODEL_NAME = 'civic_mobilenet_v3_v3_11'


class InvalidImageError(ValueError):
    pass


class ModelUnavailableError(RuntimeError):
    pass


class CNNModel:
    def __init__(self):
        self.model = None
        self.classes = []
        self.confidence_threshold = self._read_confidence_threshold()
        self.configuration_error = None
        self.load_error = None
        self._load_model()

    @staticmethod
    def _read_confidence_threshold():
        value = os.environ.get('CNN_CONFIDENCE_THRESHOLD', '').strip()
        if not value:
            return None

        try:
            threshold = float(value)
        except ValueError:
            return None
        if not 0 <= threshold <= 1:
            return None
        return threshold

    def _load_model(self):
        try:
            with METADATA_PATH.open(encoding='utf-8') as metadata_file:
                metadata = json.load(metadata_file)

            class_names = metadata.get('class_names')
            class_to_index = metadata.get('class_indices', metadata.get('class_to_index'))
            if (
                not isinstance(class_names, list)
                or not class_names
                or not all(isinstance(name, str) and name for name in class_names)
                or len(set(class_names)) != len(class_names)
            ):
                raise ValueError('CNN metadata must contain unique class_names.')
            if not isinstance(class_to_index, dict) or set(class_to_index) != set(class_names):
                raise ValueError('CNN metadata class indices must map every class name.')
            image_size = metadata.get('image_size')
            if image_size != [224, 224]:
                raise ValueError('CNN metadata image_size must be [224, 224].')

            indices = []
            for name in class_names:
                index = class_to_index[name]
                if isinstance(index, bool) or not isinstance(index, int):
                    raise ValueError('CNN class indices must be integers.')
                indices.append(index)
            if sorted(indices) != list(range(len(class_names))):
                raise ValueError('CNN class indices must be unique and contiguous from zero.')

            ordered_classes = [None] * len(class_names)
            for name, index in class_to_index.items():
                ordered_classes[index] = name
            if ordered_classes != class_names:
                raise ValueError('CNN class_names order does not match class indices.')

            if not MODEL_PATH.is_file():
                raise FileNotFoundError(f'CNN model file not found: {MODEL_PATH}')

            os.environ.setdefault('KERAS_BACKEND', 'tensorflow')
            import keras

            model = keras.models.load_model(MODEL_PATH, compile=False)
            input_shape = model.input_shape
            output_shape = model.output_shape
            if (
                not isinstance(input_shape, tuple)
                or len(input_shape) != 4
                or tuple(input_shape[1:]) != (224, 224, 3)
            ):
                raise ValueError(f'Unexpected CNN input shape: {input_shape}')
            if (
                not isinstance(output_shape, tuple)
                or len(output_shape) != 2
                or output_shape[-1] != len(ordered_classes)
            ):
                raise ValueError(
                    f'CNN output shape {output_shape} does not match '
                    f'{len(ordered_classes)} metadata classes.'
                )

            self.classes = ordered_classes
            self.model = model
            logger.info('Loaded CNN model %s from %s', MODEL_NAME, MODEL_PATH)
        except Exception as error:
            self.load_error = error
            logger.exception('Could not load CNN model from %s', MODEL_PATH)

        raw_threshold = os.environ.get('CNN_CONFIDENCE_THRESHOLD', '').strip()
        if raw_threshold and self.confidence_threshold is None:
            self.configuration_error = (
                'CNN_CONFIDENCE_THRESHOLD must be a number between 0 and 1.'
            )
            logger.error(self.configuration_error)

    @staticmethod
    def preprocess_image(image_source):
        try:
            with Image.open(image_source) as opened_image:
                image = ImageOps.exif_transpose(opened_image).convert('RGB')
                image = image.resize((224, 224), Image.Resampling.BILINEAR)
                # The serialized model contains MobileNetV3 Rescaling(1/127.5, -1).
                return np.asarray(image, dtype=np.float32)
        except (UnidentifiedImageError, OSError, ValueError) as error:
            raise InvalidImageError('The uploaded file is not a valid supported image.') from error

    def predict(self, image_bytes):
        if self.load_error is not None or self.model is None:
            raise ModelUnavailableError(
                f'The CNN model is unavailable: {self.load_error or "model not loaded"}'
            )
        if self.configuration_error:
            raise ModelUnavailableError(self.configuration_error)
        if not isinstance(image_bytes, (bytes, bytearray)) or not image_bytes:
            raise InvalidImageError('An image file is required.')

        image_array = self.preprocess_image(io.BytesIO(image_bytes))
        batch = np.expand_dims(image_array, axis=0)
        probabilities = np.asarray(self.model.predict(batch, verbose=0))
        if (
            probabilities.shape != (1, len(self.classes))
            or not np.isfinite(probabilities).all()
            or (probabilities < 0).any()
            or (probabilities > 1).any()
        ):
            raise ModelUnavailableError('CNN returned invalid class probabilities.')

        class_index = int(np.argmax(probabilities[0]))
        confidence = float(probabilities[0][class_index])
        prediction = self.classes[class_index]
        review_reason = None
        if prediction == 'normal':
            review_reason = 'no_issue_detected'
        elif self.confidence_threshold is not None and confidence < self.confidence_threshold:
            review_reason = 'below_confidence_threshold'

        return {
            'prediction': prediction,
            'confidence': round(confidence, 6),
            'model': MODEL_NAME,
            'needs_review': review_reason is not None,
            'review_reason': review_reason,
            'confidence_threshold': self.confidence_threshold,
        }
