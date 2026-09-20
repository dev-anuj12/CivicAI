import React, { createContext, useContext, useState } from 'react';
import { Language } from '../types';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // Header & Navigation
    'app.title': 'CivicAI',
    'app.tagline': 'One Platform. Every Civic Issue.',
    'nav.citizenPortal': 'Citizen Portal',
    'nav.reportIssue': 'Report Issue',
    'nav.myReports': 'My Reports & Tracking',
    'nav.adminCommand': 'Command Center',
    'nav.superAdmin': 'Super Admin',
    'btn.signIn': 'Sign In',
    'btn.exitAdmin': 'Exit Admin',

    // Reporting flow
    'report.heading': 'Report a Civic Issue',
    'report.subheading': 'Capture photograph, let AI diagnose the issue, and dispatch to municipal teams.',
    'report.step1': 'Upload or Capture Photograph',
    'report.step1.sub': 'Supports real JPG, PNG, and WebP photos. CivicAI AI Vision will automatically inspect and classify the civic defect.',
    'report.step2': 'Issue Category & Specifications',
    'report.step3': 'Incident Location & GPS',
    'report.voiceInput': 'Voice Input (Speech-to-Text)',
    'report.voiceListening': 'Listening... Speak your complaint clearly',
    'report.voiceStop': 'Stop Recording',
    'report.submit': 'Submit Civic Report',
    'report.submitting': 'Registering on Municipal Ledger...',
    'report.duplicateAlert': 'Nearby Duplicate Issue Detected',
    'report.duplicateNotice': 'Similar issues have already been reported nearby. You can attach your report to boost priority, or submit independently.',
    'report.attachExisting': 'Confirm & Attach (+1 Priority Boost)',
    'report.continueNew': 'Submit as New Independent Report',
    'report.success': 'Civic Report Registered Successfully',

    // Statuses & Severities
    'status.REPORTED': 'Reported',
    'status.UNDER_REVIEW': 'Under Review',
    'status.ASSIGNED': 'Assigned',
    'status.IN_PROGRESS': 'In Progress',
    'status.RESOLVED': 'Resolved',
    'status.REJECTED': 'Rejected',

    'sev.LOW': 'Low Severity',
    'sev.MEDIUM': 'Medium Severity',
    'sev.HIGH': 'High Severity',
    'sev.CRITICAL': 'Critical Severity',

    'prio.LOW': 'Low Priority',
    'prio.MEDIUM': 'Medium Priority',
    'prio.HIGH': 'High Priority',
    'prio.URGENT': 'Urgent Priority',

    // Community Verification
    'verify.confirm': 'Confirm Issue (+1)',
    'verify.stillPresent': 'Still Present',
    'verify.resolved': 'Resolved for Me',
    'verify.thankYou': 'Thank you! Your verification has updated the issue priority.',

    // Admin & Copilot
    'copilot.title': 'CivicAI Copilot',
    'copilot.placeholder': 'Ask Copilot about potholes, hotspots, overdue SLAs...',
    'copilot.ask': 'Ask',
    'evidence.beforeAfter': 'Before vs After Resolution Evidence',
    'evidence.officialNotes': 'Official Inspection & Resolution Notes',
  },

  hi: {
    // Header & Navigation
    'app.title': 'CivicAI (नागरिक एआई)',
    'app.tagline': 'एक मंच। हर नागरिक समस्या।',
    'nav.citizenPortal': 'नागरिक पोर्टल',
    'nav.reportIssue': 'समस्या दर्ज करें',
    'nav.myReports': 'मेरी शिकायतें व ट्रैकिंग',
    'nav.adminCommand': 'प्रशासनिक कमांड सेंटर',
    'nav.superAdmin': 'सुपर एडमिन',
    'btn.signIn': 'साइन इन',
    'btn.exitAdmin': 'एडमिन मोड से बाहर आएं',

    // Reporting flow
    'report.heading': 'नागरिक समस्या दर्ज करें',
    'report.subheading': 'फोटो खींचें, एआई से जांच करवाएं और सीधे नगर निगम टीम को भेजें।',
    'report.step1': 'फोटो अपलोड या कैप्चर करें',
    'report.step1.sub': 'असली फोटो अपलोड करें। CivicAI का एआई विजन सिस्टम समस्या को स्वचालित रूप से पहचानेगा।',
    'report.step2': 'समस्या की श्रेणी व विवरण',
    'report.step3': 'घटना स्थल और जीपीएस',
    'report.voiceInput': 'आवाज से बोलकर दर्ज करें (Speech-to-Text)',
    'report.voiceListening': 'सुन रहे हैं... कृपया अपनी समस्या स्पष्ट रूप से बोलें',
    'report.voiceStop': 'रिकॉर्डिंग रोकें',
    'report.submit': 'शिकायत दर्ज करें',
    'report.submitting': 'नगर निगम लेजर में दर्ज किया जा रहा है...',
    'report.duplicateAlert': 'पास में पहले से दर्ज समस्या मिली',
    'report.duplicateNotice': 'इस स्थान के पास पहले से मिलती-जुलती शिकायत दर्ज है। आप इसे पुष्टि करके प्राथमिकता बढ़ा सकते हैं।',
    'report.attachExisting': 'पुष्टि करें और जोड़ें (+1 प्राथमिकता)',
    'report.continueNew': 'नई स्वतंत्र शिकायत दर्ज करें',
    'report.success': 'आपकी शिकायत सफलतापूर्वक दर्ज हो गई है',

    // Statuses & Severities
    'status.REPORTED': 'दर्ज की गई',
    'status.UNDER_REVIEW': 'समीक्षाधीन',
    'status.ASSIGNED': 'विभाग को सौंपी गई',
    'status.IN_PROGRESS': 'कार्य प्रगति पर',
    'status.RESOLVED': 'समाधान पूर्ण',
    'status.REJECTED': 'अस्वीकृत',

    'sev.LOW': 'कम गंभीरता',
    'sev.MEDIUM': 'मध्यम गंभीरता',
    'sev.HIGH': 'उच्च गंभीरता',
    'sev.CRITICAL': 'अति गंभीर',

    'prio.LOW': 'कम प्राथमिकता',
    'prio.MEDIUM': 'मध्यम प्राथमिकता',
    'prio.HIGH': 'उच्च प्राथमिकता',
    'prio.URGENT': 'अति आवश्यक',

    // Community Verification
    'verify.confirm': 'समस्या की पुष्टि करें (+1)',
    'verify.stillPresent': 'समस्या अभी भी मौजूद है',
    'verify.resolved': 'मेरे लिए समाधान हो गया',
    'verify.thankYou': 'धन्यवाद! आपके सत्यापन से समस्या की प्राथमिकता अपडेट हो गई है।',

    // Admin & Copilot
    'copilot.title': 'नागरिक एआई कोपायलट',
    'copilot.placeholder': 'सड़क के गड्ढों, हॉटस्पॉट्स या लंबित मामलों के बारे में पूछें...',
    'copilot.ask': 'पूछें',
    'evidence.beforeAfter': 'समाधान से पहले और बाद के प्रमाण',
    'evidence.officialNotes': 'अधिकारिक निरीक्षण एवं निवारण विवरण',
  },

  mr: {
    // Header & Navigation
    'app.title': 'CivicAI (नागरीक एआय)',
    'app.tagline': 'एकच व्यासपीठ. प्रत्येक नागरी समस्या.',
    'nav.citizenPortal': 'नागरिक दालन',
    'nav.reportIssue': 'तक्रार नोंदवा',
    'nav.myReports': 'माझ्या तक्रारी व ट्रॅकिंग',
    'nav.adminCommand': 'प्रशासकीय नियंत्रण कक्ष',
    'nav.superAdmin': 'सुपर ॲडमिन',
    'btn.signIn': 'साइन इन',
    'btn.exitAdmin': 'ॲडमिन मोड बंद करा',

    // Reporting flow
    'report.heading': 'नागरी समस्या नोंदवा',
    'report.subheading': 'फोटो काढा, एआय द्वारे तपासणी करा आणि थेट महानगरपालिका पथकाकडे पाठवा.',
    'report.step1': 'फोटो अपलोड किंवा कॅप्चर करा',
    'report.step1.sub': 'प्रत्यक्ष फोटो अपलोड करा. CivicAI चे एआय व्हिजन मॉडेल समस्येचे वर्गीकरण करेल.',
    'report.step2': 'समस्येचा प्रकार आणि तपशील',
    'report.step3': 'घटनास्थळ आणि जीपीएस',
    'report.voiceInput': 'आवाजाद्वारे तक्रार नोंदवा (Speech-to-Text)',
    'report.voiceListening': 'ऐकत आहोत... कृपया आपली तक्रार स्पष्टपणे बोला',
    'report.voiceStop': 'रेकॉर्डिंग थांबवा',
    'report.submit': 'तक्रार दाखल करा',
    'report.submitting': 'महानगरपालिका नोंदवहीत नोंद होत आहे...',
    'report.duplicateAlert': 'जवळपास आधीच नोंदवलेली समस्या आढळली',
    'report.duplicateNotice': 'या परिसरात आधीच अशी समस्या नोंदवली गेली आहे. आपण समर्थन देऊन प्राधान्य वाढवू शकता.',
    'report.attachExisting': 'पुष्टी करा आणि जोडा (+1 प्राधान्य)',
    'report.continueNew': 'नवीन स्वतंत्र तक्रार नोंदवा',
    'report.success': 'आपली तक्रार यशस्वीरीत्या नोंदवली गेली आहे',

    // Statuses & Severities
    'status.REPORTED': 'नोंदवली',
    'status.UNDER_REVIEW': 'तपासणी सुरू',
    'status.ASSIGNED': 'विभागाकडे वर्ग',
    'status.IN_PROGRESS': 'काम प्रगतीपथावर',
    'status.RESOLVED': 'निवारण पूर्ण',
    'status.REJECTED': 'नाकारली',

    'sev.LOW': 'कमी तीव्रता',
    'sev.MEDIUM': 'मध्यम तीव्रता',
    'sev.HIGH': 'उच्च तीव्रता',
    'sev.CRITICAL': 'अति गंभीर',

    'prio.LOW': 'कमी प्राधान्य',
    'prio.MEDIUM': 'मध्यम प्राधान्य',
    'prio.HIGH': 'उच्च प्राधान्य',
    'prio.URGENT': 'तातडीचे',

    // Community Verification
    'verify.confirm': 'समस्येची पुष्टी करा (+1)',
    'verify.stillPresent': 'समस्या अजूनही कायम आहे',
    'verify.resolved': 'माझ्यासाठी निवारण झाले',
    'verify.thankYou': 'धन्यवाद! आपल्या पडताळणीमुळे समस्येचे प्राधान्य अद्ययावत झाले आहे.',

    // Admin & Copilot
    'copilot.title': 'नागरीक एआय कोपायलट',
    'copilot.placeholder': 'खड्डे, हॉटस्पॉट्स किंवा प्रलंबित कामांविषयी विचारा...',
    'copilot.ask': 'विचारा',
    'evidence.beforeAfter': 'निवारणापूर्वी आणि नंतरचे पुरावे',
    'evidence.officialNotes': 'अधिकृत पाहणी व निवारण नोंदी',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('civicai_lang');
      if (saved === 'hi' || saved === 'mr' || saved === 'en') return saved as Language;
    } catch {}
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('civicai_lang', lang);
    } catch {}
  };

  const t = (key: string): string => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
