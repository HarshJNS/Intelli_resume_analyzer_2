import os
# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
# pyrefly: ignore [missing-import]
from werkzeug.utils import secure_filename
from analyzer import extract_text_from_pdf, extract_text_from_docx, analyze_resume

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    # 1. Validate request
    if 'resume' not in request.files:
        return jsonify({"error": "No resume file provided."}), 400
    
    file = request.files['resume']
    job_description = request.form.get('job_description', '').strip()
    
    if not file.filename:
        return jsonify({"error": "No selected file."}), 400
        
    if not job_description:
        return jsonify({"error": "No job description provided."}), 400
        
    if len(job_description) < 30:
        return jsonify({"error": "Job description is too short."}), 400
        
    try:
        # 2. Extract text based on file type
        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        file_bytes = file.read()
        
        if ext == 'pdf':
            resume_text = extract_text_from_pdf(file_bytes)
        elif ext in ['docx', 'doc']:
            resume_text = extract_text_from_docx(file_bytes)
        else:
            return jsonify({"error": "Unsupported file format. Please upload PDF or DOCX."}), 400
            
        if not resume_text.strip():
            return jsonify({"error": "Could not extract any text from the file."}), 400
            
        # 3. Perform AI analysis
        result = analyze_resume(resume_text, job_description)
        
        # 4. Map backend snake_case to frontend camelCase expectations
        mapped_result = {
            "atsScore": result.get("ats_score", 0),
            "matchScore": result.get("match_score", 0),
            "skillScore": result.get("skill_score", 0),
            "missingSkills": result.get("missing_skills", []),
            "foundKeywords": result.get("keyword_details", []), # script.js expects object array
            "strengths": result.get("strengths", []),
            "suggestions": result.get("suggestions", []),
        }
        
        return jsonify(mapped_result)
        
    except Exception as e:
        print(f"Error during analysis: {e}")
        return jsonify({"error": "An internal error occurred during analysis."}), 500

if __name__ == '__main__':
    # Run the Flask development server on port 5001
    app.run(debug=True, port=5001)
