import os
import json
import pickle
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, accuracy_score
from sklearn.preprocessing import RobustScaler
from sklearn.pipeline import Pipeline
import kagglehub
from kagglehub import KaggleDatasetAdapter

def main():
    print("Step 1: Loading credit card fraud dataset via kagglehub...")
    # Load the cached dataset
    df = kagglehub.load_dataset(
        KaggleDatasetAdapter.PANDAS,
        "mlg-ulb/creditcardfraud",
        "creditcard.csv"
    )

    print(f"Dataset loaded. Shape: {df.shape}")

    # Prepare features and target
    X_full = df.drop('Class', axis=1)
    y_full = df['Class']

    print("Step 2: Performing feature importance analysis to identify top predictors...")
    # Split for feature importance training (we use a smaller split of 20% to run it extremely fast)
    X_train_imp, _, y_train_imp, _ = train_test_split(
        X_full, y_full, 
        test_size=0.8, 
        random_state=42, 
        stratify=y_full
    )
    
    # Train a fast Random Forest to find important features
    imp_model = RandomForestClassifier(n_estimators=30, max_depth=10, random_state=42, n_jobs=-1)
    imp_model.fit(X_train_imp, y_train_imp)
    
    # Get importances
    importances = imp_model.feature_importances_
    feature_names = X_full.columns
    
    # Map feature names to importances
    feat_imp_df = pd.DataFrame({
        'Feature': feature_names,
        'Importance': importances
    }).sort_values(by='Importance', ascending=False)
    
    print("\nFeature Importances ranked:")
    print(feat_imp_df.head(10))
    
    # Filter out Time and Amount from the PCA ranking since we want to always keep them.
    pca_importances = feat_imp_df[~feat_imp_df['Feature'].isin(['Time', 'Amount'])]
    top_5_pca = pca_importances['Feature'].head(5).tolist()
    
    # Combine selected features: Time, top 5 PCA components, and Amount
    selected_features = ['Time'] + top_5_pca + ['Amount']
    print(f"\nSelected 7 Features for training and prediction: {selected_features}")

    # Step 3: Train final model using only selected features
    X_reduced = df[selected_features]
    y_reduced = df['Class']

    print("\nStep 3: Splitting dataset on simplified features...")
    X_train, X_test, y_train, y_test = train_test_split(
        X_reduced, y_reduced, 
        test_size=0.2, 
        random_state=42, 
        stratify=y_reduced
    )

    # Downsample genuine transactions in the training split to handle extreme class imbalance.
    # We use a 10:1 ratio of genuine-to-fraud to balance sensitivity and false positives.
    idx_genuine = y_train[y_train == 0].index
    idx_fraud = y_train[y_train == 1].index
    
    np.random.seed(42)
    sampled_genuine_idx = np.random.choice(idx_genuine, size=len(idx_fraud) * 10, replace=False)
    balanced_idx = np.concatenate([sampled_genuine_idx, idx_fraud])
    
    X_train_bal = X_train.loc[balanced_idx]
    y_train_bal = y_train.loc[balanced_idx]
    
    print(f"Downsampled training set from {len(X_train)} to {len(X_train_bal)} samples (10:1 ratio).")

    print("Step 4: Training final Random Forest model on balanced training split...")
    model_pipeline = Pipeline([
        ('scaler', RobustScaler()),
        ('classifier', RandomForestClassifier(
            n_estimators=50, 
            max_depth=10, 
            random_state=42, 
            n_jobs=-1
        ))
    ])

    model_pipeline.fit(X_train_bal, y_train_bal)

    print("Step 5: Evaluating simplified model performance...")
    y_pred = model_pipeline.predict(X_test)
    y_pred_proba = model_pipeline.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    conf = confusion_matrix(y_test, y_pred)
    report = classification_report(y_test, y_pred, output_dict=True)

    # Calculate ROC curve coordinates
    from sklearn.metrics import roc_curve
    fpr, tpr, _ = roc_curve(y_test, y_pred_proba)
    
    # Downsample ROC curve to exactly 100 points for efficient transmission and charting
    fpr_downsampled = np.linspace(0, 1, 100)
    tpr_downsampled = np.interp(fpr_downsampled, fpr, tpr)

    print(f"Simplified Model Accuracy: {acc:.5f}")
    print(f"Simplified Model ROC AUC Score: {roc_auc:.5f}")
    print("Confusion Matrix:")
    print(conf)

    # Save directories
    os.makedirs('model', exist_ok=True)

    print("Step 6: Exporting model artifacts...")
    # Save Model Pipeline
    with open('model/fraud_model.pkl', 'wb') as f:
        pickle.dump(model_pipeline, f)
    print("Model saved to model/fraud_model.pkl")

    # Save Selected Features List
    with open('model/selected_features.json', 'w') as f:
        json.dump(selected_features, f, indent=4)
    print("Selected features saved to model/selected_features.json")

    # Save metrics
    metrics = {
        "accuracy": acc,
        "roc_auc": roc_auc,
        "precision_fraud": report['1']['precision'],
        "recall_fraud": report['1']['recall'],
        "f1_fraud": report['1']['f1-score'],
        "confusion_matrix": {
            "tn": int(conf[0][0]),
            "fp": int(conf[0][1]),
            "fn": int(conf[1][0]),
            "tp": int(conf[1][1])
        },
        "selected_features": selected_features,
        "roc_curve": {
            "fpr": fpr_downsampled.tolist(),
            "tpr": tpr_downsampled.tolist()
        }
    }
    with open('model/model_metrics.json', 'w') as f:
        json.dump(metrics, f, indent=4)
    print("Metrics saved to model/model_metrics.json")

    print("Step 7: Generating test sample transactions for UI...")
    # Select some genuine and fraud samples to test in the UI (only including selected features + Class + id)
    df_reduced = df[selected_features + ['Class']]
    
    genuine_samples = df_reduced[df_reduced['Class'] == 0].sample(n=25, random_state=42)
    fraud_samples = df_reduced[df_reduced['Class'] == 1].sample(n=25, random_state=42)

    samples = []
    
    for idx, row in genuine_samples.iterrows():
        sample_dict = row.to_dict()
        sample_dict['id'] = int(idx)
        samples.append(sample_dict)
        
    for idx, row in fraud_samples.iterrows():
        sample_dict = row.to_dict()
        sample_dict['id'] = int(idx)
        samples.append(sample_dict)

    with open('model/sample_transactions.json', 'w') as f:
        json.dump(samples, f, indent=4)
    print("Sample transactions saved to model/sample_transactions.json")
    print("Simplified training pipeline finished successfully!")

if __name__ == '__main__':
    main()
