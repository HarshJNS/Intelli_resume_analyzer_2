/**
 * Intelli Resume Analyzer — script.js
 * Beginner-friendly, well-commented Vanilla JavaScript
 * Backend API fetch() placeholders are marked with // [API]
 */

// ─── DOM REFERENCES ────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const dropzoneInner = document.getElementById('dropzoneInner');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileRemove = document.getElementById('fileRemove');
const uploadSuccess = document.getElementById('uploadSuccess');
const jobDescription = document.getElementById('jobDescription');
const charCount = document.getElementById('charCount');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingState = document.getElementById('loadingState');
const resultsSection = document.getElementById('results');
const reanalyzeBtn = document.getElementById('reanalyzeBtn');

// State
let uploadedFile = null;

// ─── NAVBAR SCROLL ──────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) navbar.classList.add('scrolled');
  else navbar.classList.remove('scrolled');
});

// ─── HAMBURGER MENU ─────────────────────────────────────────────────
hamburger.addEventListener('click', () => {
  document.querySelector('.nav-links') && (() => {
    const links = document.querySelector('.nav-links');
    links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
  })();
});

// ─── CHARACTER COUNTER ───────────────────────────────────────────────
jobDescription.addEventListener('input', () => {
  charCount.textContent = jobDescription.value.length;
});

// ─── DRAG & DROP ─────────────────────────────────────────────────────
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// ─── FILE INPUT ───────────────────────────────────────────────────────
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

// Handle selected file — show preview
function handleFile(file) {
  const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
  const ext = file.name.split('.').pop().toLowerCase();

  if (!['pdf', 'docx', 'doc'].includes(ext)) {
    showToast('Please upload a PDF or DOCX file.', 'error');
    return;
  }

  uploadedFile = file;

  // Show file name and size
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);

  // Change icon based on type
  const icon = document.getElementById('fileTypeIcon');
  icon.className = ext === 'pdf' ? 'fas fa-file-pdf file-type-icon' : 'fas fa-file-word file-type-icon';
  icon.style.color = ext === 'pdf' ? '#ef4444' : '#3b82f6';

  // Show preview, hide drop zone content
  dropzoneInner.style.display = 'none';
  filePreview.style.display = 'flex';

  // Show success message
  uploadSuccess.style.display = 'flex';
  setTimeout(() => { uploadSuccess.style.display = 'none'; }, 3000);
}

// Remove uploaded file
fileRemove.addEventListener('click', () => {
  uploadedFile = null;
  fileInput.value = '';
  dropzoneInner.style.display = 'flex';
  filePreview.style.display = 'none';
  uploadSuccess.style.display = 'none';
});

// Format bytes → KB / MB
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ─── ANALYZE BUTTON ───────────────────────────────────────────────────
analyzeBtn.addEventListener('click', async () => {
  // Validation
  if (!uploadedFile) {
    showToast('Please upload your resume first.', 'error');
    return;
  }
  if (jobDescription.value.trim().length < 30) {
    showToast('Please enter a more detailed job description (min 30 characters).', 'error');
    return;
  }

  // Show loading
  startLoading();

  try {
    const formData = new FormData();
    formData.append('resume', uploadedFile);
    formData.append('job_description', jobDescription.value);

    // Start simulated progress steps for visual feedback
    const simulationPromise = simulateAnalysis();

    // Call the actual backend
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    // Wait for the visual simulation to finish so the UI looks nice
    await simulationPromise;

    if (!response.ok) {
      throw new Error(data.error || 'Analysis failed. Please try again.');
    }

    showResults(data);

  } catch (error) {
    // Hide loading
    document.getElementById('analyzeSection').style.opacity = '1';
    analyzeBtn.disabled = false;
    document.querySelector('.btn-text').style.display = 'flex';
    document.querySelector('.btn-loader').style.display = 'none';
    loadingState.style.display = 'none';

    showToast(error.message, 'error');
  }
});

// ─── LOADING ANIMATION ────────────────────────────────────────────────
const loadingMessages = [
  'Extracting Resume Content...',
  'Analyzing ATS Keywords...',
  'Calculating Match Score...',
  'Generating Suggestions...',
];
const stepIds = ['step1', 'step2', 'step3', 'step4'];

function startLoading() {
  // Hide analyze section, show loading
  document.getElementById('analyzeSection').style.opacity = '0.5';
  analyzeBtn.disabled = true;
  document.querySelector('.btn-text').style.display = 'none';
  document.querySelector('.btn-loader').style.display = 'flex';

  loadingState.style.display = 'block';
  resultsSection.style.display = 'none';

  // Reset steps
  stepIds.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('active', 'done');
    el.querySelector('i').className = 'fas fa-circle';
  });

  document.getElementById('spinnerPct').textContent = '0%';
  document.getElementById('loadingMsg').textContent = loadingMessages[0];
}

// Simulate step-by-step loading progress
function simulateAnalysis() {
  return new Promise(resolve => {
    let step = 0;
    const totalSteps = 4;
    const interval = setInterval(() => {
      // Mark previous step done
      if (step > 0) {
        const prev = document.getElementById(stepIds[step - 1]);
        prev.classList.remove('active');
        prev.classList.add('done');
        prev.querySelector('i').className = 'fas fa-check-circle';
      }

      if (step < totalSteps) {
        const cur = document.getElementById(stepIds[step]);
        cur.classList.add('active');
        cur.querySelector('i').className = 'fas fa-circle-notch fa-spin';
        document.getElementById('loadingMsg').textContent = loadingMessages[step];

        // Update circular spinner
        const pct = Math.round(((step + 1) / totalSteps) * 100);
        animateSpinner(pct);

        step++;
      } else {
        clearInterval(interval);
        resolve();
      }
    }, 900);
  });
}

// Animate the SVG spinner
function animateSpinner(pct) {
  const circumference = 251; // 2 * π * 40
  const fill = document.getElementById('spinnerFill');
  const offset = circumference - (pct / 100) * circumference;
  fill.style.strokeDashoffset = offset;
  document.getElementById('spinnerPct').textContent = pct + '%';
}

// ─── FAKE DATA GENERATOR ──────────────────────────────────────────────
// Generates realistic random results based on job description keywords
function generateFakeResults(jd) {
  // Extract words from JD as "keywords"
  const words = jd.match(/\b[A-Za-z][A-Za-z0-9+#.]{2,}\b/g) || [];
  const unique = [...new Set(words.map(w => w.toLowerCase()))].filter(w => w.length > 3);

  // Simulated scores
  const atsScore = randomBetween(62, 94);
  const matchScore = randomBetween(58, 91);
  const skillScore = randomBetween(55, 90);

  // Common tech missing skills
  const possibleMissing = ['Docker', 'AWS', 'Kubernetes', 'GraphQL', 'TensorFlow', 'REST APIs',
    'Redis', 'PostgreSQL', 'MongoDB', 'FastAPI', 'TypeScript', 'CI/CD', 'Spark', 'Airflow', 'Kafka'];
  const missingSkills = shuffle(possibleMissing).slice(0, randomBetween(4, 8));

  // Keywords found in JD
  const foundKeywords = shuffle(unique).slice(0, 10).map(w => ({
    word: capitalize(w),
    score: randomBetween(55, 100),
    found: Math.random() > 0.35,
  }));

  // Strength scores
  const strengths = [
    { name: 'Technical Skills', score: randomBetween(60, 95) },
    { name: 'Soft Skills', score: randomBetween(55, 85) },
    { name: 'Formatting', score: randomBetween(70, 98) },
    { name: 'Experience Relevance', score: randomBetween(55, 90) },
    { name: 'Education Match', score: randomBetween(60, 95) },
  ];

  // Suggestions
  const suggestions = [
    'Add more industry-specific technical keywords from the job description.',
    'Use strong action verbs: "Developed", "Designed", "Optimized", "Led".',
    'Include measurable achievements (e.g., "Improved performance by 40%").',
    'Improve your project descriptions with tech stack details.',
    'Ensure your skills section matches the exact keywords in the JD.',
    'Add certifications related to the job role to boost credibility.',
    'Keep resume to 1–2 pages for better ATS parsing.',
  ];

  return { atsScore, matchScore, skillScore, missingSkills, foundKeywords, strengths, suggestions };
}

// ─── SHOW RESULTS ─────────────────────────────────────────────────────
function showResults(data) {
  // Hide loading, show results
  loadingState.style.display = 'none';
  document.getElementById('analyzeSection').style.opacity = '1';
  analyzeBtn.disabled = false;
  document.querySelector('.btn-text').style.display = 'flex';
  document.querySelector('.btn-loader').style.display = 'none';

  resultsSection.style.display = 'block';

  // Smooth scroll to results
  setTimeout(() => {
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);

  // Render each section
  renderCircularScore('atsFill', 'atsValue', 'atsStatus', data.atsScore);
  renderCircularScore('matchFill', 'matchValue', 'matchStatus', data.matchScore);
  renderCircularScore('skillFill', 'skillValue', 'skillStatus', data.skillScore);

  renderStrengths(data.strengths);
  renderMissingSkills(data.missingSkills);
  renderSuggestions(data.suggestions);
  renderKeywords(data.foundKeywords);
}

// Animate a circular progress ring
function renderCircularScore(fillId, valueId, statusId, score) {
  const fill = document.getElementById(fillId);
  const value = document.getElementById(valueId);
  const status = document.getElementById(statusId);

  // SVG circumference for r=50: 2 * π * 50 ≈ 314
  const circumference = 314;

  // Color based on score
  let color, statusText;
  if (score >= 80) { color = '#10b981'; statusText = '🟢 Excellent'; }
  else if (score >= 60) { color = '#f59e0b'; statusText = '🟡 Good'; }
  else { color = '#ef4444'; statusText = '🔴 Needs Work'; }

  fill.style.stroke = color;
  status.textContent = statusText;
  status.style.color = color;

  // Animate counter and ring
  let current = 0;
  const target = score;
  const step = () => {
    if (current < target) {
      current++;
      const offset = circumference - (current / 100) * circumference;
      fill.style.strokeDashoffset = offset;
      value.textContent = current;
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

// Render strength bars
function renderStrengths(strengths) {
  const grid = document.getElementById('strengthGrid');
  grid.innerHTML = strengths.map(item => {
    const color = item.score >= 80 ? '#10b981' : item.score >= 60 ? '#f59e0b' : '#ef4444';
    return `
      <div class="strength-item">
        <div class="strength-header">
          <span class="strength-name">${item.name}</span>
          <span class="strength-val" style="color:${color}">${item.score}%</span>
        </div>
        <div class="strength-bar">
          <div class="strength-fill" data-width="${item.score}%" style="width:0;background:${color}"></div>
        </div>
      </div>`;
  }).join('');

  // Animate bars after render
  setTimeout(() => {
    document.querySelectorAll('.strength-fill').forEach(el => {
      el.style.width = el.dataset.width;
    });
  }, 100);
}

// Render missing skill chips
function renderMissingSkills(skills) {
  document.getElementById('missingChips').innerHTML = skills.map(skill =>
    `<span class="chip"><i class="fas fa-plus"></i>${skill}</span>`
  ).join('');
}

// Render suggestions list
function renderSuggestions(suggestions) {
  document.getElementById('suggestionsList').innerHTML = suggestions.map(s =>
    `<li><i class="fas fa-arrow-right"></i><span>${s}</span></li>`
  ).join('');
}

// Render keyword analysis grid
function renderKeywords(keywords) {
  document.getElementById('keywordsGrid').innerHTML = keywords.map(kw => `
    <div class="kw-item">
      <div class="kw-word">${kw.word}</div>
      <div class="kw-bar"><div class="kw-fill" style="width:${kw.score}%"></div></div>
      <span class="kw-pct ${kw.found ? 'kw-found' : 'kw-missing'}">
        ${kw.found ? '✓ Found' : '✗ Missing'} · ${kw.score}%
      </span>
    </div>`
  ).join('');
}

// ─── RE-ANALYZE ────────────────────────────────────────────────────────
reanalyzeBtn.addEventListener('click', () => {
  resultsSection.style.display = 'none';
  document.getElementById('upload').scrollIntoView({ behavior: 'smooth' });
});

// ─── TOAST NOTIFICATION ────────────────────────────────────────────────
function showToast(message, type = 'info') {
  // Remove existing toast
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  const bg = type === 'error' ? '#ef4444' : '#10b981';
  toast.style.cssText = `
    position:fixed; bottom:28px; right:28px; z-index:9999;
    background:${bg}; color:#fff; padding:14px 22px;
    border-radius:50px; font-size:.9rem; font-weight:600;
    box-shadow:0 8px 24px rgba(0,0,0,.3);
    display:flex; align-items:center; gap:10px;
    animation:slideIn .3s ease;
  `;
  toast.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>${message}`;
  document.body.appendChild(toast);

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `@keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(style);

  setTimeout(() => toast.remove(), 4000);
}

// ─── HELPERS ───────────────────────────────────────────────────────────
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── SCROLL REVEAL ─────────────────────────────────────────────────────
// Simple intersection observer for fade-in animations on scroll
const observerOptions = { threshold: 0.1 };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animation = 'fadeIn 0.6s ease forwards';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Observe feature cards, framework table rows, etc.
document.querySelectorAll('.feature-card, .score-card, .card').forEach(el => {
  el.style.opacity = '0';
  el.style.animation = 'none';
  observer.observe(el);
});

// ─── INIT ──────────────────────────────────────────────────────────────
console.log('%c Intelli Resume Analyzer ', 'background:#6c63ff;color:#fff;padding:4px 10px;border-radius:4px;font-weight:700;font-size:14px');
console.log('Frontend ready. Connect your Python backend at /api/analyze');
