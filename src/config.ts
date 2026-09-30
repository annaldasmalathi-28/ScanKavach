/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ScanKavach Configuration Constants
 * Centralized configuration for feature extraction, memory bank construction,
 * safety gating, condition-suggestion classifier, multilingual settings, and clinical disclaimers.
 */

/** Application brand naming */
export const APP_NAME = 'ScanKavach';
export const APP_FULL_TITLE =
  'ScanKavach: Label-Free Anomaly Screening and Decision Support for Medical Images';
export const APP_LOGIN_TAGLINE = 'Your shield for safer medical image screening';

/** Target input resolution for MobileNet v1 0.25 224 */
export const IMG_SIZE = 224;

/** Patch feature layer name from MobileNet v1 with 14x14 spatial resolution */
export const PATCH_LAYER = 'conv_pw_11_relu';

/** Maximum number of patch feature vectors retained in the memory bank */
export const MAX_BANK_PATCHES = 8000;

/** Train/Validation split fraction for the healthy reference set (70% bank, 30% calibration) */
export const BANK_FRACTION = 0.7;

/** Calibration percentile for the 'Review' verdict cutoff */
export const REVIEW_PERCENTILE = 95;

/** Calibration percentile for the 'Refer' verdict cutoff */
export const REFER_PERCENTILE = 99;

/** Relative margin around cutoffs for flagging borderline scores (e.g. 5%) */
export const BORDERLINE_MARGIN = 0.05;

/** Maximum number of healthy reference thumbnails stored in the bank */
export const MAX_THUMBNAILS = 100;

/** Thumbnail edge size in pixels for UI comparisons */
export const THUMB_SIZE = 128;

/** Number of top most anomalous patch scores averaged to compute image anomaly score */
export const TOPK_PATCHES = 3;

/** Minimum number of healthy scans required to build a reference bank */
export const MIN_NORMALS = 20;

/** Recommended number of healthy scans for robust clinical calibration */
export const RECOMMENDED_NORMALS = 60;

/** Out-of-distribution distance multiplier applied to max validation global embedding distance */
export const OOD_MARGIN = 1.5;

/** Mean absolute RGB channel difference above which an image is flagged as a colour photo */
export const COLOR_DIFF_LIMIT = 12;

/** Default Laplacian variance below which an image is flagged as blurry */
export const DEFAULT_BLUR_LIMIT = 15;

/** Minimum grayscale standard deviation required to pass contrast check (scale 0..1) */
export const MIN_CONTRAST_STD = 0.05;

/** Maximum allowed upload size in megabytes */
export const MAX_UPLOAD_MB = 15;

/** Maximum number of history entries persisted per user */
export const HISTORY_LIMIT = 500;

/** Maximum number of audit log entries persisted */
export const AUDIT_LIMIT = 1000;

/** Single constant for the Gemini model identifier */
export const GEMINI_MODEL = 'gemini-2.5-flash';

/** Mandatory screening aid disclaimer shown across all results */
export const CLINICAL_DISCLAIMER =
  'This flags an unusual pattern for clinician review. It is not a diagnosis.';

/** Mandatory condition suggestion research prototype disclaimer */
export const CONDITION_SUGGESTION_DISCLAIMER =
  'This is an AI-suggested finding from a research prototype, not a confirmed diagnosis and not a medical device. It must be reviewed and confirmed by a qualified doctor or radiologist.';

/** Label for condition suggestions */
export const CONDITION_SUGGESTION_LABEL =
  'AI-suggested finding (decision support)';

/** URL to hosted TensorFlow.js MobileNet v1 0.25 224 weights and topology */
export const MOBILENET_MODEL_URL =
  'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json';
