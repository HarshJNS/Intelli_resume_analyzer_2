# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import traceback
import analyzer

app = Flask(__name__)
# Enable CORS so the frontend can communicate with the backend
CORS(app)

@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        # 1. Get Job Description
        job_description = request.form.get("job_description", "")
        if not job_description or len(job_description) < 30:
            return jsonify({"error": "Job description must be at least 30 characters."}), 400

        # 2. Get File
        if "resume" not in request.files:
            return jsonify({"error": "No resume file uploaded."}), 400
        
        file = request.files["resume"]
        if file.filename == "":
            return jsonify({"error": "No selected file."}), 400

        filename_lower = file.filename.lower()
        file_bytes = file.read()

        # 3. Parse File
        resume_text = ""
        if filename_lower.endswith(".pdf"):
            resume_text = analyzer.extract_text_from_pdf(file_bytes)
        elif filename_lower.endswith(".docx") or filename_lower.endswith(".doc"):
            resume_text = analyzer.extract_text_from_docx(file_bytes)
        else:
            return jsonify({"error": "Unsupported file format. Please upload PDF or DOCX."}), 400

        if not resume_text.strip():
            return jsonify({"error": "Could not extract text from the file. It may be empty or an image-based PDF."}), 400

        # 4. Analyze
        results = analyzer.analyze_resume(resume_text, job_description)

        # Map backend 'keyword_details' to frontend expected structure for keywords
        # The frontend expects: { word, score, found }
        # And missing skills expects an array of strings
        # And strengths expects: [{name, score}]
        # The analyzer.py already formats these correctly!
        
        # Need to make sure the keys map exactly to what frontend expects in showResults(data)
        frontend_data = {
            "atsScore": results["ats_score"],
            "matchScore": results["match_score"],
            "skillScore": results["skill_score"],
            "missingSkills": results["missing_skills"],
            "foundKeywords": results["keyword_details"],
            "strengths": results["strengths"],
            "suggestions": results["suggestions"]
        }

        return jsonify(frontend_data), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "Intelli Resume Analyzer API is running."})

if __name__ == "__main__":
    app.run(debug=True, port=5001)
