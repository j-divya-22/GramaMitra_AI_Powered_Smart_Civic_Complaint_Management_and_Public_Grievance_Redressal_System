import io
import unittest

from PIL import Image

from main import app, cnn_model


class CNNApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_classify_requires_an_image_file(self):
        response = self.client.post('/api/classify', json={})
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.get_json())

    def test_classify_rejects_invalid_image_bytes(self):
        response = self.client.post(
            '/api/classify',
            data={'file': (io.BytesIO(b'invalid image'), 'broken.png')},
            content_type='multipart/form-data',
        )
        self.assertEqual(response.status_code, 400)

    def test_classify_returns_model_result_for_uploaded_image(self):
        image_buffer = io.BytesIO()
        Image.new('RGB', (32, 32), color=(150, 100, 50)).save(image_buffer, format='JPEG')
        image_buffer.seek(0)
        response = self.client.post(
            '/api/classify',
            data={'file': (image_buffer, 'evidence.jpg')},
            content_type='multipart/form-data',
        )

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertIn(result['prediction'], cnn_model.classes)
        self.assertIn('confidence', result)
        self.assertIn('model', result)


if __name__ == '__main__':
    unittest.main()
