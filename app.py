import streamlit as st
import pickle
import numpy as np
import pandas as pd 

data = pd.read_csv("C:\\Users\\varsh\\OneDrive\\Desktop\\CreditCardFraud Detection\\creditcard.csv")

# Load model
model = pickle.load(open('model/fraud_model.pkl', 'rb'))

# Page settings
st.set_page_config(
    page_title="Credit Card Fraud Detection",
    page_icon="💳",
    layout="centered"
)

# Title
st.title("💳 Credit Card Fraud Detection System")

st.markdown("### Detect whether a transaction is Fraudulent or Genuine")

st.write("Enter transaction details below:")
st.info("Model Accuracy: 99%")
# Inputs
row_no = st.number_input(
    "Enter Transaction Row Number",
    min_value=0,
    max_value=len(data)-1,
    step=1
)
time = st.number_input("Transaction Time", min_value=0.0)
amount = st.number_input("Transaction Amount", min_value=0.0)

# Predict button
if st.button("Predict"):

    transaction = data.drop("Class", axis=1).iloc[row_no]
    
    sample = transaction.values.reshape(1, -1)

    prediction = model.predict(sample)

    if prediction[0] == 1:
        st.error("⚠ Fraudulent Transaction Detected")
    else:
        st.success("✅ Genuine Transaction")
# Footer
st.markdown("---")
st.caption("BCA Final Year Project using Machine Learning")

