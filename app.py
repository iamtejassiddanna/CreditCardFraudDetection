import os
import json
import pickle
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# Paths
MODEL_PATH = 'model/fraud_model.pkl'
METRICS_PATH = 'model/model_metrics.json'
SAMPLES_PATH = 'model/sample_transactions.json'
FEATURES_PATH = 'model/selected_features.json'

# Global variables to cache model, data, and active features
model = None
model_metrics = None
sample_transactions = None
FEATURE_NAMES = ['Time', 'V17', 'V14', 'V16', 'V10', 'V12', 'Amount'] # Default fallback

def load_resources():
    global model, model_metrics, sample_transactions, FEATURE_NAMES
    
    # Load Model Pipeline
    if os.path.exists(MODEL_PATH):
        try:
            with open(MODEL_PATH, 'rb') as f:
                model = pickle.load(f)
            print("Model loaded successfully.")
        except Exception as e:
            print(f"Error loading model: {e}")
    else:
        print("Model file not found. Please run train.py first.")

    # Load Metrics
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH, 'r') as f:
                model_metrics = json.load(f)
            print("Metrics loaded successfully.")
        except Exception as e:
            print(f"Error loading metrics: {e}")
    else:
        print("Metrics file not found. Run train.py first.")

    # Load Selected Features Config
    if os.path.exists(FEATURES_PATH):
        try:
            with open(FEATURES_PATH, 'r') as f:
                FEATURE_NAMES = json.load(f)
            print(f"Selected features loaded: {FEATURE_NAMES}")
        except Exception as e:
            print(f"Error loading selected features: {e}")
    else:
        print("Selected features file not found. Using defaults.")

    # Load Sample Transactions
    if os.path.exists(SAMPLES_PATH):
        try:
            with open(SAMPLES_PATH, 'r') as f:
                sample_transactions = json.load(f)
            print("Sample transactions loaded successfully.")
        except Exception as e:
            print(f"Error loading sample transactions: {e}")
    else:
        print("Sample transactions file not found. Run train.py first.")

# Initial loading of resources
load_resources()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    global model_metrics
    if model_metrics is None:
        load_resources()
    if model_metrics is not None:
        return jsonify(model_metrics)
    return jsonify({"error": "Metrics not available. Run training first."}), 500

@app.route('/api/random_transaction', methods=['GET'])
def get_random_transaction():
    global sample_transactions
    if sample_transactions is None:
        load_resources()
    
    if not sample_transactions:
        return jsonify({"error": "Sample transactions not available."}), 500
    
    # Optional filter: 'fraud' or 'genuine'
    tx_type = request.args.get('type', 'any').lower()
    
    if tx_type == 'fraud':
        filtered = [t for t in sample_transactions if t.get('Class') == 1]
    elif tx_type == 'genuine':
        filtered = [t for t in sample_transactions if t.get('Class') == 0]
    else:
        filtered = sample_transactions

    if not filtered:
        return jsonify({"error": f"No samples found matching type: {tx_type}"}), 404
        
    random_idx = np.random.choice(len(filtered))
    tx = filtered[random_idx]
    
    return jsonify(tx)

@app.route('/api/predict', methods=['POST'])
def predict():
    global model, FEATURE_NAMES
    if model is None:
        load_resources()
        if model is None:
            return jsonify({"error": "Model is not trained or loaded."}), 500
            
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        # Parse inputs into a dictionary with exact feature names
        inputs = {}
        for feature in FEATURE_NAMES:
            if feature not in data:
                return jsonify({"error": f"Missing feature: {feature}"}), 400
            inputs[feature] = float(data[feature])
            
        # Create DataFrame with exact column ordering
        df_input = pd.DataFrame([inputs], columns=FEATURE_NAMES)
        
        # Predict class and probability
        prediction = int(model.predict(df_input)[0])
        probabilities = model.predict_proba(df_input)[0]
        fraud_probability = float(probabilities[1])
        
        # Return response
        return jsonify({
            "is_fraud": bool(prediction == 1),
            "fraud_probability": fraud_probability,
            "prediction_label": "Fraudulent" if prediction == 1 else "Genuine",
            "status": "success"
        })
        
    except ValueError as val_err:
        return jsonify({"error": f"Invalid input format: {str(val_err)}"}), 400
    except Exception as e:
        return jsonify({"error": f"Prediction error: {str(e)}"}), 500

if __name__ == '__main__':
    load_resources()
    app.run(debug=True, port=5000)
