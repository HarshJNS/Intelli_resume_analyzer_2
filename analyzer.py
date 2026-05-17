"""
analyzer.py — Core NLP Analysis Engine
Handles: PDF/DOCX parsing, ATS scoring, TF-IDF semantic matching,
         keyword extraction, skill gap analysis, suggestions.
"""

import re
import string
import math
from collections import Counter
# pyrefly: ignore [missing-import]
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Load spaCy NLP model (English core)
import sys
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    import subprocess
    subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_sm"])
    nlp = spacy.load("en_core_web_sm")

# ── PDF Parsing ──────────────────────────────────────────────────────
def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF (fitz)."""
    try:
        # pyrefly: ignore [missing-import]
        import fitz  # PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text("text")
        doc.close()
        return text.strip()
    except Exception as e:
        raise ValueError(f"PDF parsing failed: {str(e)}")


# ── DOCX Parsing ─────────────────────────────────────────────────────
def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    try:
        import io
        # pyrefly: ignore [missing-import]
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)
    except Exception as e:
        raise ValueError(f"DOCX parsing failed: {str(e)}")


# ── Text Preprocessing with spaCy ──────────────────────────────────────
def preprocess(text: str) -> list:
    """Normalize, clean, and tokenize text using spaCy lemmatization."""
    # Lowercase and remove special characters
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s\+#\.]', ' ', text)
    
    # Process text through spaCy NLP pipeline
    doc = nlp(text)
    
    # Extract lemmas, ignoring stopwords and punctuation
    tokens = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct and len(token.lemma_) > 2]
    return tokens


# ── TF-IDF Similarity with Scikit-Learn ────────────────────────────────
def compute_tfidf_similarity(resume_tokens: list, jd_tokens: list) -> float:
    """
    Compute cosine similarity between resume and job description
    using Scikit-Learn's TF-IDF Vectorizer and Cosine Similarity.
    """
    resume_str = " ".join(resume_tokens)
    jd_str = " ".join(jd_tokens)
    
    if not resume_str or not jd_str:
        return 0.0

    vectorizer = TfidfVectorizer()
    # Fit and transform the texts into TF-IDF vectors
    tfidf_matrix = vectorizer.fit_transform([resume_str, jd_str])
    
    # Calculate cosine similarity between the two vectors
    similarity_score = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
    
    return round(similarity_score * 100, 2)


# ── ATS Score Engine ─────────────────────────────────────────────────
# Common ATS-penalized patterns
ATS_BAD_PATTERNS = [
    r'(table|column|header|footer)',       # Tables/columns confuse parsers
    r'(image|photo|graphic)',              # Images not parseable
    r'[^\x00-\x7F]+',                     # Non-ASCII characters
]

ATS_GOOD_SECTIONS = [
    'experience', 'education', 'skills', 'summary', 'objective',
    'projects', 'certifications', 'achievements', 'contact'
]

def compute_ats_score(resume_text: str, resume_tokens: list, jd_tokens: list) -> dict:
    """
    Calculate ATS compatibility score (0–100).
    Factors: section presence, keyword density, formatting, length.
    """
    score = 50  # base

    lower_text = resume_text.lower()

    # +5 per standard section found (max 30)
    section_bonus = sum(5 for sec in ATS_GOOD_SECTIONS if sec in lower_text)
    score += min(section_bonus, 30)

    # Keyword overlap bonus (max 15)
    jd_set = set(jd_tokens)
    resume_set = set(resume_tokens)
    overlap_ratio = len(jd_set & resume_set) / len(jd_set) if jd_set else 0
    score += min(int(overlap_ratio * 30), 15)

    # Length check: ideal 300–800 words
    word_count = len(resume_text.split())
    if 300 <= word_count <= 800:
        score += 10
    elif word_count < 150:
        score -= 10

    # Penalize ATS-bad patterns
    for pattern in ATS_BAD_PATTERNS:
        if re.search(pattern, lower_text):
            score -= 5

    # Cap between 10 and 98
    return {
        "ats_score": max(10, min(98, score)),
        "word_count": word_count,
        "sections_found": [s for s in ATS_GOOD_SECTIONS if s in lower_text]
    }


# ── Keyword Analysis ─────────────────────────────────────────────────
TECH_SKILLS_MASTER = [
    "python","java","javascript","typescript","c++","c#","go","rust","kotlin","swift",
    "react","angular","vue","node","django","flask","fastapi","spring","express",
    "sql","mysql","postgresql","mongodb","redis","elasticsearch","cassandra",
    "aws","gcp","azure","docker","kubernetes","terraform","ansible","ci/cd","jenkins",
    "machine learning","deep learning","nlp","tensorflow","pytorch","scikit-learn",
    "pandas","numpy","matplotlib","spark","kafka","airflow","dbt",
    "git","github","linux","rest","graphql","grpc","microservices","agile","scrum",
    "data analysis","data science","computer vision","transformers","llm","rag"
]

def extract_keywords(resume_tokens: list, jd_tokens: list) -> dict:
    """
    Compare tech keywords found in JD vs resume.
    Returns found, missing, and all keyword scores.
    """
    jd_text   = " ".join(jd_tokens)
    res_text  = " ".join(resume_tokens)

    found_in_jd = [skill for skill in TECH_SKILLS_MASTER if skill.replace(" ", "") in jd_text.replace(" ", "") or skill in jd_text]
    if not found_in_jd:
        # Fallback: use top JD tokens
        found_in_jd = list(set(jd_tokens))[:15]

    found     = [k for k in found_in_jd if k.replace(" ","") in res_text.replace(" ","")]
    missing   = [k for k in found_in_jd if k not in found]

    keyword_details = []
    for kw in found_in_jd[:12]:
        freq = res_text.count(kw.replace(" ",""))
        keyword_details.append({
            "word":  kw.title(),
            "found": kw in found,
            "score": min(100, 50 + freq * 15)
        })

    return {
        "found_keywords":   found,
        "missing_keywords": missing[:10],
        "keyword_details":  keyword_details
    }


# ── Resume Strength ───────────────────────────────────────────────────
SOFT_SKILLS = ["leadership","communication","teamwork","problem","analytical",
               "creative","organized","adaptable","collaborative","motivated"]

ACTION_VERBS = ["developed","designed","built","implemented","optimized","led",
                "managed","created","improved","analyzed","deployed","architected"]

def analyze_strength(resume_text: str, resume_tokens: list, match_score: float) -> list:
    """Score 5 resume dimensions."""
    lower = resume_text.lower()
    tokens_set = set(resume_tokens)

    # Technical Skills: overlap with master list
    tech_found = sum(1 for s in TECH_SKILLS_MASTER if s in lower)
    tech_score = min(95, 40 + tech_found * 6)

    # Soft Skills
    soft_found = sum(1 for s in SOFT_SKILLS if s in lower)
    soft_score = min(90, 30 + soft_found * 10)

    # Formatting: checks for sections + length
    sections = sum(1 for s in ATS_GOOD_SECTIONS if s in lower)
    format_score = min(98, 50 + sections * 6)

    # Experience Relevance: based on match
    exp_score = min(95, int(match_score * 0.85) + 10)

    # Education
    edu_score = 75 if any(w in lower for w in ['bachelor','master','phd','degree','university','college']) else 50

    return [
        {"name": "Technical Skills",     "score": tech_score},
        {"name": "Soft Skills",          "score": soft_score},
        {"name": "Formatting",           "score": format_score},
        {"name": "Experience Relevance", "score": exp_score},
        {"name": "Education Match",      "score": edu_score},
    ]


# ── Suggestions Engine ────────────────────────────────────────────────
def generate_suggestions(resume_text: str, missing_keywords: list, ats_score: int) -> list:
    """Rule-based suggestion generator."""
    suggestions = []
    lower = resume_text.lower()

    if missing_keywords:
        suggestions.append(f"Add missing skills to your resume: {', '.join(missing_keywords[:5])}.")

    if not any(verb in lower for verb in ACTION_VERBS):
        suggestions.append("Use strong action verbs: 'Developed', 'Optimized', 'Architected', 'Led'.")

    if not re.search(r'\d+\s*%|\d+x|\$\d+|\d+\s*(users|clients|projects)', lower):
        suggestions.append("Add measurable achievements (e.g., 'Improved performance by 40%', 'Served 10K users').")

    if 'summary' not in lower and 'objective' not in lower:
        suggestions.append("Add a professional Summary section at the top of your resume.")

    if 'certification' not in lower and 'certified' not in lower:
        suggestions.append("Include relevant certifications (AWS, Google Cloud, PMP, etc.).")

    if len(resume_text.split()) < 300:
        suggestions.append("Your resume seems short. Aim for 400–700 words for better ATS parsing.")

    if ats_score < 65:
        suggestions.append("Avoid tables, columns, and images — they confuse ATS parsers.")

    suggestions.append("Tailor your resume specifically for each job application.")
    suggestions.append("Ensure your contact info (email, LinkedIn, GitHub) is clearly visible.")

    return suggestions[:7]


# ── Master Analyze Function ───────────────────────────────────────────
def analyze_resume(resume_text: str, job_description: str) -> dict:
    """
    Full analysis pipeline:
    1. Preprocess both texts
    2. TF-IDF similarity → match score
    3. ATS score
    4. Keyword analysis
    5. Strength analysis
    6. Suggestions
    Returns a single results dict consumed by the frontend.
    """
    resume_tokens = preprocess(resume_text)
    jd_tokens     = preprocess(job_description)

    # Scores
    match_score  = compute_tfidf_similarity(resume_tokens, jd_tokens)
    ats_data     = compute_ats_score(resume_text, resume_tokens, jd_tokens)
    skill_score  = min(95, int(match_score * 0.9) + 5)

    # Keywords
    kw_data      = extract_keywords(resume_tokens, jd_tokens)

    # Strength
    strength     = analyze_strength(resume_text, resume_tokens, match_score)

    # Suggestions
    suggestions  = generate_suggestions(resume_text, kw_data["missing_keywords"], ats_data["ats_score"])

    return {
        "ats_score":       ats_data["ats_score"],
        "match_score":     match_score,
        "skill_score":     skill_score,
        "word_count":      ats_data["word_count"],
        "sections_found":  ats_data["sections_found"],
        "missing_skills":  kw_data["missing_keywords"],
        "found_keywords":  kw_data["found_keywords"],
        "keyword_details": kw_data["keyword_details"],
        "strengths":       strength,
        "suggestions":     suggestions,
    }
