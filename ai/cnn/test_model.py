import io
import json
import unittest

import numpy as np
from PIL import Image

from cnn.model import CNNModel, InvalidImageError, MODEL_NAME, METADATA_PATH


class CNNModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cnn = CNNModel()
        if cls.cnn.load_error:
            raise cls.cnn.load_error

    def test_metadata_indices_match_eleven_model_outputs(self):
        with METADATA_PATH.open(encoding='utf-8') as metadata_file:
            metadata = json.load(metadata_file)

        self.assertEqual(self.cnn.classes, metadata['class_names'])
        self.assertEqual(
            self.cnn.classes,
            [
                'damaged_footpath',
                'damaged_road_sign',
                'electrical_hazard',
                'infrastructure',
                'normal',
                'open_manhole_borewell',
                'road_damage',
                'roadside_garbage',
                'streetlight_faults',
                'vegetation',
                'waterlogging',
            ],
        )
        self.assertEqual(
            [metadata['class_indices'][name] for name in self.cnn.classes],
            list(range(11)),
        )
        self.assertEqual(self.cnn.model.output_shape[-1], 11)

    def test_preprocessing_leaves_0_to_255_scaling_for_model_rescaling(self):
        image_buffer = io.BytesIO()
        Image.new('RGB', (32, 24), color=(0, 127, 255)).save(image_buffer, format='PNG')
        image = self.cnn.preprocess_image(io.BytesIO(image_buffer.getvalue()))

        self.assertEqual(image.shape, (224, 224, 3))
        self.assertEqual(float(np.max(image)), 255.0)
        self.assertEqual(float(np.min(image)), 0.0)

    def test_prediction_returns_class_confidence_model_and_review_state(self):
        image_buffer = io.BytesIO()
        Image.new('RGB', (32, 24), color=(64, 128, 192)).save(image_buffer, format='JPEG')
        previous_threshold = self.cnn.confidence_threshold
        previous_configuration_error = self.cnn.configuration_error
        self.cnn.confidence_threshold = None
        self.cnn.configuration_error = None
        try:
            result = self.cnn.predict(image_buffer.getvalue())
        finally:
            self.cnn.confidence_threshold = previous_threshold
            self.cnn.configuration_error = previous_configuration_error

        self.assertIn(result['prediction'], self.cnn.classes)
        self.assertGreaterEqual(result['confidence'], 0)
        self.assertLessEqual(result['confidence'], 1)
        self.assertEqual(result['model'], MODEL_NAME)
        self.assertIsInstance(result['needs_review'], bool)
        if result['prediction'] == 'normal':
            self.assertTrue(result['needs_review'])
        else:
            self.assertFalse(result['needs_review'])

    def test_invalid_image_is_rejected(self):
        with self.assertRaises(InvalidImageError):
            self.cnn.predict(b'not an image')


if __name__ == '__main__':
    unittest.main()
