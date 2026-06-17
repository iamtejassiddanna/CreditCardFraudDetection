import unittest
import json
from app import app

class FraudDetectionAppTestCase(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        app.config['TESTING'] = True
        self.client = app.test_client()

    def test_home_page(self):
        """Test that the index home page loads correctly."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'SentinelAI', response.data)

    def test_metrics_api(self):
        """Test that metrics endpoint returns valid performance stats."""
        response = self.client.get('/api/metrics')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data.decode('utf-8'))
        self.assertIn('accuracy', data)
        self.assertIn('roc_auc', data)
        self.assertIn('recall_fraud', data)
        self.assertIn('confusion_matrix', data)
        self.assertIn('selected_features', data)
        self.assertTrue(data['confusion_matrix']['tp'] > 50) # Verify that we are successfully detecting a significant portion of fraud cases

    def test_random_transaction_api(self):
        """Test loading random sample transactions (any, genuine, fraud)."""
        # 1. Any transaction
        response = self.client.get('/api/random_transaction')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data.decode('utf-8'))
        self.assertIn('Amount', data)
        self.assertIn('Time', data)
        self.assertIn('Class', data)
        # Check that one of our top selected PCA features is present
        self.assertIn('V17', data)

        # 2. Genuine transaction filter
        response_genuine = self.client.get('/api/random_transaction?type=genuine')
        self.assertEqual(response_genuine.status_code, 200)
        data_genuine = json.loads(response_genuine.data.decode('utf-8'))
        self.assertEqual(data_genuine['Class'], 0)

        # 3. Fraudulent transaction filter
        response_fraud = self.client.get('/api/random_transaction?type=fraud')
        self.assertEqual(response_fraud.status_code, 200)
        data_fraud = json.loads(response_fraud.data.decode('utf-8'))
        self.assertEqual(data_fraud['Class'], 1)

    def test_predict_api(self):
        """Test that transaction scoring predicts outcomes and returns probabilities."""
        # 1. Fetch metrics to get active features list
        response_metrics = self.client.get('/api/metrics')
        self.assertEqual(response_metrics.status_code, 200)
        metrics = json.loads(response_metrics.data.decode('utf-8'))
        selected_features = metrics.get('selected_features', ['Time', 'V17', 'V14', 'V16', 'V10', 'V12', 'Amount'])

        # 2. Query a random sample transaction first to get realistic features
        response_sample = self.client.get('/api/random_transaction?type=fraud')
        self.assertEqual(response_sample.status_code, 200)
        sample = json.loads(response_sample.data.decode('utf-8'))
        
        # 3. Prepare prediction payload using only the selected features
        payload = {}
        for feature in selected_features:
            payload[feature] = sample[feature]

        # 4. Send POST request
        response_predict = self.client.post(
            '/api/predict',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response_predict.status_code, 200)
        
        result = json.loads(response_predict.data.decode('utf-8'))
        self.assertIn('is_fraud', result)
        self.assertIn('fraud_probability', result)
        self.assertIn('prediction_label', result)
        self.assertEqual(result['status'], 'success')
        
        # Check that fraud probability is high for a fraud sample
        self.assertTrue(result['fraud_probability'] > 0.4)

if __name__ == '__main__':
    unittest.main()
