/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ScanKavach Multilingual Internationalization (i18n)
 * Provides seamless localization across English, Hindi, Spanish, and French.
 */

export type SupportedLanguage = 'en' | 'hi' | 'es' | 'fr';

const LANG_KEY = 'scankavach_lang';

export interface Translations {
  appName: string;
  tagline: string;
  navDashboard: string;
  navBank: string;
  navAnalyze: string;
  navBatch: string;
  navClassifier: string;
  navAssistant: string;
  navHub: string;
  navAudit: string;
  navAbout: string;
  verdictNormal: string;
  verdictReview: string;
  verdictRefer: string;
  borderlineBadge: string;
  clinicalDisclaimer: string;
  decisionSupportLabel: string;
  decisionSupportDisclaimer: string;
  safetyGatePassed: string;
  safetyGateRejected: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, Translations> = {
  en: {
    appName: 'ScanKavach',
    tagline: 'Your shield for safer medical image screening',
    navDashboard: 'Dashboard',
    navBank: 'Reference Bank',
    navAnalyze: 'Scan Screening',
    navBatch: 'Batch Triage',
    navClassifier: 'Condition Classifier',
    navAssistant: 'AI Assistant',
    navHub: 'Health Hub',
    navAudit: 'Model Card & Audit',
    navAbout: 'About & Self-Test',
    verdictNormal: 'Normal',
    verdictReview: 'Review',
    verdictRefer: 'Refer',
    borderlineBadge: 'Borderline: Needs Human Review',
    clinicalDisclaimer: 'This flags an unusual pattern for clinician review. It is not a diagnosis.',
    decisionSupportLabel: 'AI-suggested finding (decision support)',
    decisionSupportDisclaimer:
      'This is an AI-suggested finding from a research prototype, not a confirmed diagnosis and not a medical device. It must be reviewed and confirmed by a qualified doctor or radiologist.',
    safetyGatePassed: 'Safety Gate: Passed',
    safetyGateRejected: 'Safety Gate: Stopped',
  },
  hi: {
    appName: 'ScanKavach',
    tagline: 'सुरक्षित मेडिकल इमेज स्क्रीनिंग के लिए आपकी ढाल (कवच)',
    navDashboard: 'डैशबोर्ड',
    navBank: 'रेफरेंस बैंक',
    navAnalyze: 'स्कैन स्क्रीनिंग',
    navBatch: 'बैच प्राथमिकता',
    navClassifier: 'पैटर्न क्लासिफायर',
    navAssistant: 'एआई सहायक',
    navHub: 'हेल्थ हब',
    navAudit: 'मॉडल कार्ड और ऑडिट',
    navAbout: 'परिचय व परीक्षण',
    verdictNormal: 'सामान्य',
    verdictReview: 'पुनरावलोकन',
    verdictRefer: 'रेफरल',
    borderlineBadge: 'सीमावर्ती: मानवीय समीक्षा आवश्यक',
    clinicalDisclaimer: 'यह चिकित्सक की समीक्षा के लिए असामान्य पैटर्न को दर्शाता है। यह कोई निदान नहीं है।',
    decisionSupportLabel: 'एआई-सुझाया गया निष्कर्ष (निर्णय समर्थन)',
    decisionSupportDisclaimer:
      'यह अनुसंधान प्रोटोटाइप से एआई-सुझाया गया निष्कर्ष है, कोई पुष्ट निदान या चिकित्सा उपकरण नहीं। योग्य चिकित्सक द्वारा पुष्टि अनिवार्य है।',
    safetyGatePassed: 'सुरक्षा द्वार: स्वीकृत',
    safetyGateRejected: 'सुरक्षा द्वार: अस्वीकृत',
  },
  es: {
    appName: 'ScanKavach',
    tagline: 'Su escudo para un cribado de imágenes médicas más seguro',
    navDashboard: 'Panel Principal',
    navBank: 'Banco de Referencia',
    navAnalyze: 'Cribado de Imagen',
    navBatch: 'Triaje por Lotes',
    navClassifier: 'Clasificador de Patrones',
    navAssistant: 'Asistente IA',
    navHub: 'Centro de Salud',
    navAudit: 'Ficha del Modelo y Auditoría',
    navAbout: 'Acerca de y Autodiagnóstico',
    verdictNormal: 'Normal',
    verdictReview: 'Revisión',
    verdictRefer: 'Derivar',
    borderlineBadge: 'Límite: Requiere Revisión Humana',
    clinicalDisclaimer: 'Esto señala un patrón inusual para la revisión del médico. No es un diagnóstico.',
    decisionSupportLabel: 'Hallazgo sugerido por IA (apoyo a la decisión)',
    decisionSupportDisclaimer:
      'Este es un hallazgo sugerido por IA de un prototipo de investigación, no un diagnóstico confirmado ni un dispositivo médico. Debe ser revisado por un médico calificado.',
    safetyGatePassed: 'Control de Seguridad: Aprobado',
    safetyGateRejected: 'Control de Seguridad: Detenido',
  },
  fr: {
    appName: 'ScanKavach',
    tagline: 'Votre bouclier pour un dépistage plus sûr des images médicales',
    navDashboard: 'Tableau de bord',
    navBank: 'Banque de référence',
    navAnalyze: 'Dépistage de cliché',
    navBatch: 'Triage par lot',
    navClassifier: 'Classificateur de motifs',
    navAssistant: 'Assistant IA',
    navHub: 'Pôle Santé',
    navAudit: 'Fiche modèle et audit',
    navAbout: 'À propos et autotest',
    verdictNormal: 'Normal',
    verdictReview: 'À réviser',
    verdictRefer: 'Référer',
    borderlineBadge: 'Zone limite: Nécessite un examen humain',
    clinicalDisclaimer: "Ceci signale un schéma inhabituel pour examen clinique. Ce n'est pas un diagnostic.",
    decisionSupportLabel: "Résultat suggéré par l'IA (aide à la décision)",
    decisionSupportDisclaimer:
      "Il s'agit d'un résultat suggéré par l'IA issu d'un prototype de recherche, et non d'un diagnostic confirmé ni d'un dispositif médical.",
    safetyGatePassed: 'Filtre de sécurité: Validé',
    safetyGateRejected: 'Filtre de sécurité: Interrompu',
  },
};

let currentLang: SupportedLanguage = 'en';

export function getLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && (saved === 'en' || saved === 'hi' || saved === 'es' || saved === 'fr')) {
      currentLang = saved;
      return currentLang;
    }
  } catch {
    // Default
  }
  return 'en';
}

export function setLanguage(lang: SupportedLanguage): void {
  currentLang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Ignore
  }
}

export function t(): Translations {
  return TRANSLATIONS[getLanguage()];
}
