import numpy as np
from flask import Flask, request, jsonify, render_template
import pickle
import pandas as pd
from io import StringIO
from preprocessing import extract_features
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = "mongodb+srv://raj6395:qwertyuiop@cluster0.6cymw.mongodb.net/?retryWrites=true&w=majority&tls=true&tlsAllowInvalidCertificates=true"
client = MongoClient(uri, server_api=ServerApi('1'))
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)

# MongoDB database and collection
db = client['FetoSense']  
collection = db['csv_files']

app = Flask(__name__, '/static')
# Load the model
model = pickle.load(open("model.sav", 'rb'))
N = 60
f_s = 30
T = 1/f_s
denominator = 10

@app.route('/api', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return 'No file uploaded'
    file = request.files['file']
    
    if file.filename == '':
        return 'Empty file uploaded'
    try:
        file_str = file.read().decode('utf-8')
        file_obj = StringIO(file_str)
        
        # Read CSV with the 13th column "label"
        df = pd.read_csv(file_obj, usecols=["ax1", "ay1", "az1", "ax2", "ay2", "az2", 
                                            "ax3", "ay3", "az3", "ax4", "ay4", "az4", "label"])
        
        # Separate the 12 columns for input data and the "label" column
        input_data_df = df.drop(columns=["label"])
        label_column = df["label"]
        
        # Processing the 12 columns
        num_slices = input_data_df.shape[0] // N
        temp = input_data_df.values[:num_slices * N, :]
        input_data = temp.reshape((num_slices, N, 12))
        
        # Extract features and make predictions
        X_new = extract_features(input_data, T, N, f_s, denominator)
        predictions = model.predict(X_new)
        
        # Document to be saved in MongoDB
        document = {
            'filename': file.filename,
            'content': df.to_dict(orient='records'),  # Save all 13 columns, including "label"
            'predictions': predictions.tolist(),      # Save predictions
            'labels': label_column.tolist()            # Save the labels for reference
        }
        collection.insert_one(document)

        return jsonify({'predictions': predictions.tolist(), 'labels': label_column.tolist()}), 200
    except Exception as e:
        return f'Error: {str(e)}'

@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run()
