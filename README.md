# ScanKavach: Label-Free Anomaly Screening and Decision Support for Medical Images

> **"Your shield for safer medical image screening"** ("Kavach" means shield in Sanskrit/Hindi)

**ScanKavach** is an unsupervised and self-contained clinical screening and decision-support web application for medical images (chest X-rays and radiographic scans). It learns **what healthy scans look like** (without requiring disease labels) to flag unusual visual patterns for clinician review, and optionally provides condition-suggestion pattern matching using user-trained supervised prototypes.

> **Clinical Screening Disclaimer:**
> *This flags an unusual pattern for clinician review. It is not a diagnosis.*

> **Decision Support Disclaimer:**
> *This is an AI-suggested finding from a research prototype, not a confirmed diagnosis and not a medical device. It must be reviewed and confirmed by a qualified doctor or radiologist.*

---

## 1. Quick Start

### Installation & Execution
```bash
# 1. Install dependencies
npm install

# 2. Run the development server (runs at http://localhost:3000)
npm run dev

# 3. Run the automated unit test suite (Vitest)
npm test

# 4. Build for production
npm run build
```

---

## 2. Architecture & Modules

### 🛡️ 1. Input Safety Gate
Before executing expensive feature extraction, the input safety gate screens incoming images to eliminate false alarms:
1. **Colour Photo Check:** Flags any RGB divergence (`colorDiff > 12`) to block selfies and colour photos.
2. **Contrast & Blank Scan Check:** Flags flat or unexposed scans (`contrastStd < 0.05`).
3. **Blur Check:** Measures discrete Laplacian variance against the calibrated threshold (default 15).
4. **Out-of-Distribution Check:** Compares global cosine distance against the maximum healthy validation distance multiplied by `OOD_MARGIN` (1.5x) to catch mismatched body parts.
*If the safety gate fails, no score, verdict, or suggestion is rendered.*

### 🧠 2. PatchCore Memory Bank Architecture
- **Frozen Backbone:** MobileNet v1 0.25 224 extracts deep 14x14 spatial feature maps (196 patch embeddings per scan) at layer `conv_pw_11_relu`.
- **Chunked GPU Matrix Multiplication:** Query patches are scored against up to 8,000 reference patches using chunked `tf.matMul` and `tf.tidy`, running in <1 second on standard browser WebGL.
- **Image Anomaly Score:** Computed as the mean of the top-3 most anomalous patch distances.

### ⚖️ 3. Empirical Threshold Calibration
- **Strict Split Protocol:** 70% of uploaded normal scans form the reference memory bank; 30% are held out as an independent validation set.
- **Unbiased Baselines:** Scans in the bank are never used to calibrate cutoffs (as they score near zero against themselves).
- **Cutoffs Derived:**
  - **Review Threshold:** 95th percentile of validation anomaly scores (~5% healthy false-positives by design).
  - **Refer Threshold:** 99th percentile of validation anomaly scores.
  - **Borderline Flag:** Any score falling within a 5% relative margin of either cutoff is flagged: *"Borderline: needs human review"*.

### 🔍 4. Nearest Healthy Scan & Heatmap Explanation
- **Side-by-Side Review:** Compares the screened patient scan directly against the nearest healthy reference scan in the bank (by global embedding distance).
- **Interactive Heatmap:** Bilinearly smoothed colormap overlay with an on/off toggle and opacity slider.
- **Spatial Grid Localization:** Identifies peak anomaly coordinates on a 3x3 grid (e.g. *lower right of the image*) and calculates the percentage of anomalous image area.

### 🔬 5. Condition-Suggestion Classifier with Fusion Logic
- Trains lightweight dense or cosine-prototype classifiers on extracted global embeddings for conditions like Pneumonia, Cardiomegaly, Pleural Effusion, or COVID-19.
- **Fusion Logic:** Flags conflicts when the anomaly score is Normal but the classifier suggests high confidence for pathology, or when the anomaly score is Refer but the classifier suggests Normal.
- Labelled strictly as: *"AI-suggested finding (decision support)"* with phrasing like *"Pattern most similar to: Pneumonia (82% model confidence)"*.

### ⚡ 6. Batch Triage
- Upload and screen multiple radiographs simultaneously with sorting by priority (Refer > Review > Normal > Rejected).
- Export triage summaries to CSV for clinical workflows.

### 📄 7. PDF Clinical Screening Reports
- One-click export via `jspdf` including image thumbnail, patient ID, calibrated verdict, percentile, top findings, and mandatory clinical disclaimers.

### 🌐 8. Multilingual Support (i18n)
- Seamless real-time switching between English (EN), Hindi (HI / हिंदी), Spanish (ES), and French (FR) for all clinical disclaimers and UI labels.

### 🏥 9. Health Hub & Clinical Resources
- Reference library of common radiographic signs, lung zones, triage urgency guidelines, and recommended imaging protocols.

### 📜 10. Model Card & Audit Logging
- Complete AI transparency documentation covering dataset details, intended use, ethical considerations, and browser runtime constraints.
- Local audit log recording timestamped screening actions with zero PII or image retention.

### 🤖 11. Dual-Mode AI Assistant
- **Mode A: Offline Local Rule-Based (Default):** Always works with zero API keys or network calls. Answers questions about borderline scores, image quality, thresholds, and bank sizing.
- **Mode B: Gemini Powered:** If `VITE_GEMINI_API_KEY` is provided, integrates with the `@google/genai` TypeScript SDK using `gemini-2.5-flash`. Automatically falls back to offline local mode if unreachable or timed out (10s).
- **Clinical Safety Filter:** Strictly intercepts and refuses requests for medical diagnosis, disease identification, or medication prescription.
- **Privacy Rule:** Only text summaries (scores, percentiles, region) are passed to the assistant; medical image pixels **never leave the user's device**.

---

## 3. Privacy & Device-Local Security Model
- **No Custom Backend:** Runs entirely client-side on the user's computer or tablet.
- **EXIF Metadata Stripping:** All uploaded files are drawn onto an in-memory HTML5 canvas before processing, purging camera tags and patient metadata.
- **Local Persistence:** Reference banks, histories, and audit logs are stored exclusively in browser IndexedDB.

---

## 4. License
Apache-2.0
