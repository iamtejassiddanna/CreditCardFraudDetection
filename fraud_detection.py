

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.metrics import classification_report

# Load dataset
data = pd.read_csv("C:\\Users\\varsh\\OneDrive\\Desktop\\CreditCardFraud Detection\\creditcard.csv")

# Features and target
X = data.drop('Class', axis=1)
y = data['Class']

# Split dataset
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

# Create model
model = LogisticRegression()

# Train model
model.fit(X_train, y_train)

# Predict
y_pred = model.predict(X_test)

# Accuracy
accuracy = accuracy_score(y_test, y_pred)

print("Accuracy:", accuracy)

print(classification_report(y_test, y_pred))

import os
import pickle

os.makedirs('model', exist_ok=True)

with open('model/fraud_model.pkl', 'wb') as file:
    pickle.dump(model, file)

print("Model Saved Successfully")



fraud_data = data[data['Class'] == 1]

print("Number of fraud transactions:", len(fraud_data))
print(fraud_data.head(10))