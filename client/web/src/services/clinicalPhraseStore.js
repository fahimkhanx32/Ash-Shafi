/**
 * clinicalPhraseStore.js
 * Centralized, reactive store for managing clinical phrases across all prescription sections.
 * Supports full CRUD (Create, Read, Update, Delete) with local persistence and section resets.
 */

const STORAGE_KEY = 'ash_shafi_clinical_phrases_v3';

export const SECTION_METADATA = {
  chiefComplaint: {
    label: 'Chief Complaint',
    subtitle: 'Search and insert chief complaints for the patient record',
    bangla: 'প্রধান উপসর্গ',
    color: 'indigo',
    icon: 'Activity',
  },
  coMorbidities: {
    label: 'Co - Morbidities',
    subtitle: 'Search and insert clinical co-morbidities for the patient record',
    bangla: 'সহ-অসুস্থতা',
    color: 'purple',
    icon: 'HeartPulse',
  },
  pastHistory: {
    label: 'Past History',
    subtitle: 'Search and insert medical and surgical past history',
    bangla: 'পূর্বের ইতিহাস',
    color: 'amber',
    icon: 'History',
  },
  personalHistory: {
    label: 'Personal History',
    subtitle: 'Search and insert lifestyle, diet, fluid, and personal history',
    bangla: 'ব্যক্তিগত ইতিহাস',
    color: 'cyan',
    icon: 'User',
  },
  onExamination: {
    label: 'On examination',
    subtitle: 'Search and insert physical examination findings and vitals',
    bangla: 'শারীরিক পরীক্ষা',
    color: 'emerald',
    icon: 'Stethoscope',
  },
  vitals: {
    label: 'On examination',
    subtitle: 'Search and insert physical examination findings and vitals',
    bangla: 'শারীরিক পরীক্ষা',
    color: 'emerald',
    icon: 'Stethoscope',
  },
  smokingHistory: {
    label: 'Smoking History',
    subtitle: 'Search and insert tobacco and smoking history for patient record',
    bangla: 'ধূমপানের ইতিহাস',
    color: 'rose',
    icon: 'Cigarette',
  },
  drugHistory: {
    label: 'Drug History',
    subtitle: 'Search and insert ongoing medications and drug allergies',
    bangla: 'ওষুধের ইতিহাস',
    color: 'emerald',
    icon: 'Pill',
  },
  menstrualHistory: {
    label: 'Menstrual History',
    subtitle: 'Search and insert menstrual, obstetric, and reproductive history',
    bangla: 'মাসিকের ইতিহাস',
    color: 'pink',
    icon: 'Calendar',
  },
  pathologyAndImaging: {
    label: 'Pathology & imaging',
    subtitle: 'Search and insert laboratory, pathology, and imaging reports',
    bangla: 'প্যাথলজি ও ইমেজিং',
    color: 'blue',
    icon: 'FileSpreadsheet',
  },
  investigation: {
    label: 'Investigation / Test',
    subtitle: 'Search and insert diagnostic investigations and tests',
    bangla: 'পরীক্ষা-নিরীক্ষা',
    color: 'violet',
    icon: 'FlaskConical',
  },
  investigations: {
    label: 'Investigation / Test',
    subtitle: 'Search and insert diagnostic investigations and tests',
    bangla: 'পরীক্ষা-নিরীক্ষা',
    color: 'violet',
    icon: 'FlaskConical',
  },
  advice: {
    label: 'Advice ( উপদেশ )',
    subtitle: 'Search and insert clinical and lifestyle advice for patient',
    bangla: 'উপদেশ',
    color: 'teal',
    icon: 'CheckCircle2',
  },
  investigationAdvice: {
    label: 'Investigation advice',
    subtitle: 'Search and insert instructions for tests and report submission',
    bangla: 'পরীক্ষার পরামর্শ',
    color: 'sky',
    icon: 'FileSearch',
  },
  testAdvices: {
    label: 'Test advice',
    subtitle: 'Search and insert recommended diagnostic lab tests',
    bangla: 'প্রস্তাবিত ল্যাব পরীক্ষা',
    color: 'violet',
    icon: 'FlaskConical',
  },
  diagnoses: {
    label: 'Diagnoses',
    subtitle: 'Search and insert clinical diagnoses for patient',
    bangla: 'রোগ নির্ণয়',
    color: 'rose',
    icon: 'Stethoscope',
  },
};

export const SECTION_QUICK_CHIPS = {
  coMorbidities: [
    { label: 'DM (Diabetes Mellitus - Type 2)', icon: 'Droplet' },
    { label: 'HTN (Hypertension)', icon: 'HeartPulse' },
    { label: 'CKD (Chronic Kidney Disease Stage V-D)', icon: 'ShieldAlert' },
    { label: 'Hypothyroidism', icon: 'Sparkles' },
    { label: 'IHD (Ischemic Heart Disease)', icon: 'Heart' },
    { label: 'Bronchial Asthma', icon: 'Wind' },
    { label: 'Dyslipidemia', icon: 'Activity' },
    { label: 'Hyperuricemia / Gout', icon: 'Flame' },
    { label: 'Chronic Glomerulonephritis (CGN)', icon: 'Shield' },
    { label: 'Benign Prostatic Hyperplasia (BPH)', icon: 'Activity' },
  ],
  chiefComplaint: [
    { label: 'Fever (for 3 days)', icon: 'Flame' },
    { label: 'Vomiting and nausea', icon: 'AlertCircle' },
    { label: 'Bilateral loin pain', icon: 'Activity' },
    { label: 'Decreased urine output (Oliguria)', icon: 'Droplets' },
    { label: 'Pedal edema (swelling of both legs)', icon: 'Footprints' },
    { label: 'Shortness of breath on exertion', icon: 'Wind' },
    { label: 'Burning sensation during micturition (Dysuria)', icon: 'Flame' },
    { label: 'Generalized weakness & fatigue', icon: 'BatteryLow' },
    { label: 'High blood pressure on routine checkup', icon: 'HeartPulse' },
    { label: 'Frothy urine for 2 weeks', icon: 'Droplet' },
  ],
  pastHistory: [
    { label: 'Surgical: C-Section (2005)', icon: 'Scissors' },
    { label: 'Past DVT in right lower limb', icon: 'Activity' },
    { label: 'History of Appendectomy', icon: 'Scissors' },
    { label: 'History of Cholecystectomy', icon: 'Scissors' },
    { label: 'Past blood transfusion (2 units in 2021)', icon: 'Droplets' },
    { label: 'Previous renal stone removal (PCNL)', icon: 'Shield' },
    { label: 'No known major surgical history', icon: 'CheckCircle2' },
    { label: 'History of acute kidney injury (AKI) 1 yr ago', icon: 'History' },
    { label: 'No history of TB or bronchial asthma', icon: 'CheckCircle2' },
  ],
  personalHistory: [
    { label: 'Non-vegetarian diet, moderate appetite', icon: 'Utensils' },
    { label: 'Sedentary lifestyle, low physical activity', icon: 'Activity' },
    { label: 'Adequate fluid intake (approx 2L/day)', icon: 'Droplets' },
    { label: 'Fluid restricted diet (1000 ml/day + urine output)', icon: 'Droplet' },
    { label: 'Normal bowel & bladder habits', icon: 'CheckCircle2' },
    { label: 'Normal sleep pattern (6-7 hrs/night)', icon: 'Moon' },
    { label: 'High dietary salt intake', icon: 'AlertCircle' },
    { label: 'Occasional betel nut / pan chewer', icon: 'AlertTriangle' },
    { label: 'No history of substance abuse or alcohol', icon: 'ShieldCheck' },
  ],
  onExamination: [
    { label: 'BP: 120/80 mmHg, Pulse: 78 b/min, regular', icon: 'Activity' },
    { label: 'S1 + S2 heard, no murmur or added sounds', icon: 'Heart' },
    { label: 'Chest: Bilaterally clear, vesicular breath sounds', icon: 'Wind' },
    { label: 'Abdomen: Soft, non-tender, no organomegaly', icon: 'ShieldCheck' },
    { label: 'Pedal edema: Absent', icon: 'Footprints' },
    { label: 'Anemia: Absent, Jaundice: Absent, Cyanosis: Absent', icon: 'Eye' },
    { label: 'Bilateral lower limb: Distal pulses palpable', icon: 'Activity' },
    { label: 'GCS: 15/15, oriented to time, place, and person', icon: 'Brain' },
  ],
  vitals: [
    { label: 'BP: 120/80 mmHg, Pulse: 78 b/min, regular', icon: 'Activity' },
    { label: 'S1 + S2 heard, no murmur', icon: 'Heart' },
    { label: 'Chest: Bilaterally clear', icon: 'Wind' },
    { label: 'Abdomen: Soft, non-tender', icon: 'ShieldCheck' },
    { label: 'Pedal edema: Absent', icon: 'Footprints' },
    { label: 'Anemia: Absent, Jaundice: Absent', icon: 'Eye' },
  ],
  smokingHistory: [
    { label: 'Non-smoker', icon: 'CheckCircle2' },
    { label: 'Ex-smoker (Quit 5 years ago, previously 10 cigs/day)', icon: 'History' },
    { label: 'Current Smoker (10 cigarettes/day for 10 years, 5 pack-years)', icon: 'Cigarette' },
    { label: 'Passive smoker (Family members smoke at home)', icon: 'Users' },
    { label: 'Smokeless tobacco: Jorda / Zarda chewer', icon: 'AlertTriangle' },
    { label: 'Hookah / Shisha occasional user', icon: 'Wind' },
    { label: 'Never used any tobacco products', icon: 'ShieldCheck' },
  ],
  drugHistory: [
    { label: 'Tab. Metformin 500 mg (1+0+1, after food)', icon: 'Pill' },
    { label: 'Tab. Amlodipine 5 mg (0+0+1, after dinner)', icon: 'Pill' },
    { label: 'Tab. Losartan Potassium 50 mg (1+0+0)', icon: 'Pill' },
    { label: 'Inj. Insulin 30/70 (18 units morning, 12 units evening)', icon: 'Syringe' },
    { label: 'Tab. Calcium Carbonate + Vit D3 (0+1+0)', icon: 'Pill' },
    { label: 'Tab. Torsemide 10 mg (1+0+0, morning)', icon: 'Pill' },
    { label: 'No known drug allergies (NKDA)', icon: 'ShieldCheck' },
    { label: 'History of penicillin hypersensitivity', icon: 'AlertTriangle' },
    { label: 'History of NSAID-induced gastritis', icon: 'AlertCircle' },
  ],
  menstrualHistory: [
    { label: 'Regular menstrual cycle (28±2 days, flow: normal 4-5 days)', icon: 'Calendar' },
    { label: 'Menopause attained at age 48 years', icon: 'History' },
    { label: 'Dysmenorrhea during first 2 days of cycle', icon: 'Activity' },
    { label: 'LMP: 14 days ago', icon: 'Clock' },
    { label: 'Obstetric history: Para: 2 (NVD) + 1 IUD, Gravida: 3', icon: 'Users' },
    { label: 'Irregular cycles with oligomenorrhea', icon: 'AlertCircle' },
    { label: 'Post-menopausal with no abnormal bleeding', icon: 'CheckCircle2' },
  ],
  pathologyAndImaging: [
    { label: 'S. Creatinine: 6.68 mg/dL', icon: 'FileText' },
    { label: 'Hemoglobin (Hb): 12.50 gm/dL', icon: 'Activity' },
    { label: 'Blood Urea Nitrogen (BUN): 75 mg/dL', icon: 'FileSpreadsheet' },
    { label: 'Serum Electrolytes: Na+ 138, K+ 4.8, Cl- 102 mmol/L', icon: 'FlaskConical' },
    { label: 'Fasting Blood Sugar (FBS): 6.8 mmol/L', icon: 'Droplet' },
    { label: 'USG KUB: Bilateral grade-II renal parenchymal changes', icon: 'Scan' },
    { label: 'Urine R/M/E: Albumin ++, Pus cells: 8-10 /HPF', icon: 'Microscope' },
    { label: 'ECG: Normal sinus rhythm, no acute ischemic changes', icon: 'HeartPulse' },
    { label: 'Chest X-Ray: Clear lung fields, normal cardiothoracic ratio', icon: 'FileImage' },
  ],
  investigation: [
    { label: 'CBC with ESR', icon: 'FlaskConical' },
    { label: 'Serum Creatinine & eGFR', icon: 'Activity' },
    { label: 'Serum Electrolytes (Na+, K+, Cl-, HCO3-)', icon: 'Droplets' },
    { label: 'Blood Sugar: Fasting (FBS) & 2 hrs ABF', icon: 'Droplet' },
    { label: 'HbA1c', icon: 'Percent' },
    { label: 'Urine R/M/E & 24-Hour Urinary Total Protein (UTP)', icon: 'FileText' },
    { label: 'USG of Whole Abdomen with KUB and PVR', icon: 'Scan' },
    { label: 'Lipid Profile (Fasting)', icon: 'Heart' },
    { label: 'Serum Uric Acid & Serum Calcium', icon: 'FlaskConical' },
    { label: 'Serum Albumin & Total Protein', icon: 'FileSpreadsheet' },
  ],
  investigations: [
    { label: 'CBC with ESR', icon: 'FlaskConical' },
    { label: 'Serum Creatinine & eGFR', icon: 'Activity' },
    { label: 'Serum Electrolytes (Na+, K+, Cl-)', icon: 'Droplets' },
    { label: 'Blood Sugar: Fasting & 2 hrs ABF', icon: 'Droplet' },
    { label: 'HbA1c', icon: 'Percent' },
    { label: 'USG of Whole Abdomen with KUB and PVR', icon: 'Scan' },
    { label: 'Urine R/M/E & 24-Hour UTP', icon: 'FileText' },
    { label: 'Lipid Profile (Fasting)', icon: 'Heart' },
  ],
  advice: [
    { label: 'পানি মেপে খাবেন (১.৫ - ২ লিটার/দিন)', icon: 'Droplets' },
    { label: 'খাবারে অতিরিক্ত কাঁচা লবণ সম্পূর্ণ বর্জন করুন', icon: 'AlertTriangle' },
    { label: 'ডায়াবেটিসের সুষম খাদ্যতালিকা নিয়মিত মেনে চলুন', icon: 'Utensils' },
    { label: 'প্রতিদিন সকালে খালি পেটে রক্তচাপ ও শর্করা পরীক্ষা করুন', icon: 'Activity' },
    { label: 'ভারী কাজ ও অতিরিক্ত পরিশ্রম থেকে বিরত থাকুন', icon: 'Shield' },
    { label: 'ধূমপান, জর্দা ও তামাকজাত দ্রব্য সম্পূর্ণ বর্জন করুন', icon: 'Cigarette' },
    { label: 'ডাক্তারের পরামর্শ ছাড়া কোনো ওষুধ বন্ধ বা পরিবর্তন করবেন না', icon: 'Pill' },
    { label: 'ব্যথানাশক ওষুধ (NSAIDs) সম্পূর্ণ এড়িয়ে চলুন', icon: 'ShieldAlert' },
  ],
  investigationAdvice: [
    { label: 'পরবর্তী সাক্ষাতের পূর্বে সকল রক্ত ও প্রস্রাবের রিপোর্ট করিয়ে আনবেন', icon: 'FileText' },
    { label: 'খালি পেটে (Fasting 8-10 hrs) রক্ত পরীক্ষা করাবেন', icon: 'Clock' },
    { label: 'আল্ট্রাসনোগ্রাম করার ১ ঘণ্টা পূর্বে প্রচুর পানি পান করে ব্লাডার পূর্ণ রাখবেন', icon: 'Droplets' },
    { label: 'পূর্বের সকল প্রেসক্রিপশন ও পরীক্ষা-নিরীক্ষার ফাইল সাথে নিয়ে আসবেন', icon: 'Folder' },
    { label: 'রিপোর্ট পাওয়ার পর দ্রুত চেম্বারে যোগাযোগ করুন', icon: 'PhoneCall' },
    { label: '২৪ ঘণ্টার প্রস্রাবের নমুনা নিয়মমাফিক সংগ্রহ করবেন', icon: 'FlaskConical' },
  ],
  testAdvices: [
    { label: 'CBC with ESR', icon: 'FlaskConical' },
    { label: 'Serum Creatinine & eGFR', icon: 'Activity' },
    { label: 'Serum Electrolytes (Na+, K+, Cl-, HCO3-)', icon: 'Droplets' },
    { label: 'Blood Sugar: Fasting (FBS) & 2 hrs ABF', icon: 'Droplet' },
    { label: 'HbA1c', icon: 'Percent' },
    { label: 'Urine R/M/E & 24-Hour Urinary Total Protein (UTP)', icon: 'FileText' },
    { label: 'USG of Whole Abdomen with KUB and PVR', icon: 'Scan' },
    { label: 'Lipid Profile (Fasting)', icon: 'Heart' },
    { label: 'Serum Uric Acid & Serum Calcium', icon: 'FlaskConical' },
  ],
  diagnoses: [
    { label: 'Chronic Kidney Disease (CKD Stage V-D)', icon: 'ShieldAlert' },
    { label: 'Chronic Kidney Disease (CKD Stage 3b)', icon: 'Activity' },
    { label: 'Diabetic Kidney Disease (DKD)', icon: 'Droplet' },
    { label: 'Hypertensive Nephrosclerosis', icon: 'HeartPulse' },
    { label: 'Urinary Tract Infection (UTI)', icon: 'Flame' },
    { label: 'Nephrotic Syndrome', icon: 'Shield' },
    { label: 'Essential Hypertension', icon: 'HeartPulse' },
    { label: 'Type 2 Diabetes Mellitus with Complications', icon: 'Droplet' },
  ],
};

export const DEFAULT_PHRASES = {
  chiefComplaint: [
    'Fever (for 3 days)',
    'Vomiting and nausea',
    'Bilateral loin pain',
    'Decreased urine output (Oliguria)',
    'Generalized weakness & fatigue',
    'Shortness of breath on exertion',
    'Swelling of both legs (Pedal edema)',
    'Burning sensation during micturition (Dysuria)',
    'Loss of appetite & metallic taste',
    'Persistent dry cough',
    'High blood pressure on routine checkup',
    'Frothy urine for 2 weeks',
  ],
  coMorbidities: [
    'DM (Diabetes Mellitus - Type 2)',
    'HTN (Hypertension)',
    'CKD (Chronic Kidney Disease Stage V-D)',
    'Hypothyroidism',
    'IHD (Ischemic Heart Disease)',
    'Bronchial Asthma',
    'Dyslipidemia',
    'Hyperuricemia / Gout',
    'Chronic Glomerulonephritis (CGN)',
    'Benign Prostatic Hyperplasia (BPH)',
  ],
  pastHistory: [
    'Surgical: C-Section (2005)',
    'Past DVT in right lower limb',
    'History of Appendectomy',
    'History of Cholecystectomy',
    'Past blood transfusion (2 units in 2021)',
    'Previous renal stone removal (PCNL)',
    'No known major surgical history',
    'No history of TB, jaundice or bronchial asthma',
    'History of acute kidney injury (AKI) 1 yr ago',
  ],
  personalHistory: [
    'Non-vegetarian diet, moderate appetite',
    'Sedentary lifestyle, low physical activity',
    'Adequate fluid intake (approx 2L/day)',
    'Fluid restricted diet (1000 ml/day + urine output)',
    'Normal bowel & bladder habits',
    'Normal sleep pattern (6-7 hrs/night)',
    'High dietary salt intake',
    'No history of substance abuse or alcohol',
    'Occasional betel nut / pan chewer',
  ],
  onExamination: [
    'BP: 120/80 mmHg, Pulse: 78 b/min, regular, normal volume',
    'Heart: S1 + S2 heard, no murmur or added sounds',
    'Chest: Bilaterally clear, vesicular breath sounds, no rhonchi/creps',
    'Abdomen: Soft, non-tender, no organomegaly or palpable mass',
    'Pedal edema: Absent',
    'Bilateral lower limb: No edema, distal pulses well palpable',
    'Anemia: Absent, Jaundice: Absent, Cyanosis: Absent, Clubbing: Absent',
    'GCS: 15/15, well oriented to time, place, and person',
    'Pupil: Bilaterally equal and reactive to light (PEARL)',
    'Plantar reflex: Bilaterally flexor',
  ],
  vitals: [
    'BP: 120/80 mmHg, Pulse: 78 b/min, regular',
    'S1 + S2 heard, no murmur',
    'Chest: Bilaterally clear, vesicular breath sounds',
    'Abdomen: Soft, non-tender, no organomegaly',
    'Pedal edema: Absent',
    'Anemia: Absent, Jaundice: Absent, Cyanosis: Absent',
  ],
  smokingHistory: [
    'Non-smoker',
    'Ex-smoker (Quit 5 years ago, previously 10 cigs/day)',
    'Current Smoker (10 cigarettes/day for 10 years, 5 pack-years)',
    'Passive smoker (Family members smoke at home)',
    'Smokeless tobacco: Jorda / Zarda chewer',
    'Hookah / Shisha occasional user',
    'Never used any tobacco products',
  ],
  drugHistory: [
    'Tab. Metformin 500 mg (1+0+1, after food)',
    'Tab. Amlodipine 5 mg (0+0+1, after dinner)',
    'Tab. Losartan Potassium 50 mg (1+0+0)',
    'Inj. Insulin 30/70 (18 units morning, 12 units evening)',
    'Tab. Calcium Carbonate + Vit D3 (0+1+0)',
    'Tab. Torsemide 10 mg (1+0+0, morning)',
    'No known drug allergies (NKDA)',
    'History of penicillin hypersensitivity',
    'History of NSAID-induced gastritis',
  ],
  menstrualHistory: [
    'Regular menstrual cycle (28±2 days, flow: normal 4-5 days)',
    'Menopause attained at age 48 years',
    'Dysmenorrhea during first 2 days of cycle',
    'LMP: 14 days ago',
    'Obstetric history: Para: 2 (NVD) + 1 IUD, Gravida: 3',
    'Irregular cycles with oligomenorrhea',
    'Post-menopausal with no abnormal bleeding',
  ],
  pathologyAndImaging: [
    'S. Creatinine: 6.68 mg/dL',
    'Hemoglobin (Hb): 12.50 gm/dL',
    'Blood Urea Nitrogen (BUN): 75 mg/dL',
    'Serum Electrolytes: Na+ 138, K+ 4.8, Cl- 102 mmol/L',
    'Fasting Blood Sugar (FBS): 6.8 mmol/L',
    'USG KUB: Bilateral grade-II renal parenchymal changes',
    'Urine R/M/E: Albumin ++, Pus cells: 8-10 /HPF',
    'ECG: Normal sinus rhythm, no acute ischemic changes',
    'Chest X-Ray: Clear lung fields, normal cardiothoracic ratio',
  ],
  investigation: [
    'CBC with ESR',
    'Serum Creatinine & eGFR',
    'Serum Electrolytes (Na+, K+, Cl-, HCO3-)',
    'Blood Sugar: Fasting (FBS) & 2 hrs ABF',
    'HbA1c',
    'Urine R/M/E & 24-Hour Urinary Total Protein (UTP)',
    'USG of Whole Abdomen with KUB and PVR',
    'Lipid Profile (Fasting)',
    'Serum Uric Acid & Serum Calcium',
    'Serum Albumin & Total Protein',
    'Viral Serology (HBsAg, Anti-HCV)',
  ],
  investigations: [
    'CBC with ESR',
    'Serum Creatinine & eGFR',
    'Serum Electrolytes (Na+, K+, Cl-, HCO3-)',
    'Blood Sugar: Fasting (FBS) & 2 hrs ABF',
    'HbA1c',
    'Urine R/M/E & 24-Hour Urinary Total Protein (UTP)',
    'USG of Whole Abdomen with KUB and PVR',
    'Lipid Profile (Fasting)',
    'Serum Uric Acid & Serum Calcium',
    'Serum Albumin & Total Protein',
  ],
  advice: [
    'পানি মেপে খাবেন (১.৫ - ২ লিটার/দিন)',
    'খাবারে অতিরিক্ত কাঁচা লবণ সম্পূর্ণ বর্জন করুন',
    'ডায়াবেটিসের সুষম খাদ্যতালিকা নিয়মিত মেনে চলুন',
    'প্রতিদিন সকালে খালি পেটে রক্তচাপ ও রক্তের শর্করা পরীক্ষা করুন',
    'ভারী কাজ ও অতিরিক্ত মানসিক/শারীরিক পরিশ্রম থেকে বিরত থাকুন',
    'ধূমপান, জর্দা ও তামাকজাত দ্রব্য সম্পূর্ণ বর্জন করুন',
    'ওষুধ নিয়মিত খাবেন, ডাক্তারের পরামর্শ ছাড়া কোনো ওষুধ বন্ধ বা পরিবর্তন করবেন না',
    'ব্যথানাশক ওষুধ (NSAIDs) সম্পূর্ণ এড়িয়ে চলুন',
    'জরুরি কোনো শারীরিক সমস্যা বা প্রস্রাব কমে গেলে দ্রুত চেম্বারে বা হাসপাতালে যোগাযোগ করুন',
  ],
  investigationAdvice: [
    'পরবর্তী সাক্ষাতের পূর্বে সকল রক্ত ও প্রস্রাবের রিপোর্ট করিয়ে আনবেন',
    'খালি পেটে (Fasting 8-10 hrs) রক্ত পরীক্ষা করাবেন',
    'আল্ট্রাসনোগ্রাম করার ১ ঘণ্টা পূর্বে প্রচুর পানি পান করে ব্লাডার পূর্ণ রাখবেন',
    'পূর্বের সকল প্রেসক্রিপশন ও পরীক্ষা-নিরীক্ষার ফাইল সাথে নিয়ে আসবেন',
    'রিপোর্ট পাওয়ার পর দ্রুত চেম্বারে যোগাযোগ করুন',
    '২৪ ঘণ্টার প্রস্রাবের নমুনা নিয়মমাফিক সংগ্রহ করবেন',
  ],
  testAdvices: [
    'CBC with ESR',
    'Serum Creatinine & eGFR',
    'Serum Electrolytes (Na+, K+, Cl-, HCO3-)',
    'Blood Sugar: Fasting (FBS) & 2 hrs ABF',
    'HbA1c',
    'Urine R/M/E & 24-Hour Urinary Total Protein (UTP)',
    'USG of Whole Abdomen with KUB and PVR',
    'Lipid Profile (Fasting)',
    'Serum Uric Acid & Serum Calcium',
    'Serum Albumin & Total Protein',
    'Viral Serology (HBsAg, Anti-HCV)',
  ],
  diagnoses: [
    'Chronic Kidney Disease (CKD Stage V-D)',
    'Chronic Kidney Disease (CKD Stage 3b)',
    'Diabetic Kidney Disease (DKD)',
    'Hypertensive Nephrosclerosis',
    'Urinary Tract Infection (UTI)',
    'Nephrotic Syndrome',
    'Acute on Chronic Kidney Injury (AKI on CKD)',
    'Renal Calculus with Mild Hydronephrosis',
    'Essential Hypertension',
    'Type 2 Diabetes Mellitus with Complications',
  ],
};

class ClinicalPhraseStore {
  constructor() {
    this.subscribers = new Set();
    this.phrases = this.loadPhrases();
  }

  loadPhrases() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = { ...DEFAULT_PHRASES };
        for (const key of Object.keys(DEFAULT_PHRASES)) {
          if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
            merged[key] = parsed[key];
          }
        }
        return merged;
      }
    } catch (err) {
      console.warn('Failed to load clinical phrases from localStorage, using defaults', err);
    }
    return { ...DEFAULT_PHRASES };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.phrases));
    } catch (err) {
      console.error('Failed to save clinical phrases to localStorage', err);
    }
    this.notify();
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify() {
    for (const sub of this.subscribers) {
      try {
        sub(this.phrases);
      } catch (err) {
        console.error('Subscriber error in ClinicalPhraseStore', err);
      }
    }
  }

  /**
   * Get phrases for a specific section
   */
  getPhrases(sectionKey) {
    return this.phrases[sectionKey] || DEFAULT_PHRASES[sectionKey] || [];
  }

  /**
   * Get curated quick chips for the top ribbon
   */
  getQuickChips(sectionKey) {
    return SECTION_QUICK_CHIPS[sectionKey] || (this.getPhrases(sectionKey) || []).slice(0, 10).map((p) => ({ label: p, icon: 'Sparkles' }));
  }

  /**
   * Get section metadata
   */
  getMetadata(sectionKey) {
    return SECTION_METADATA[sectionKey] || {
      label: sectionKey,
      subtitle: `Search and insert ${sectionKey} for patient record`,
      bangla: '',
      color: 'blue',
      icon: 'FileText',
    };
  }

  /**
   * Get all phrases
   */
  getAllPhrases() {
    return { ...this.phrases };
  }

  /**
   * Create a new phrase in a section
   */
  addPhrase(sectionKey, phraseText) {
    const text = (phraseText || '').trim();
    if (!text) return false;

    if (!this.phrases[sectionKey]) {
      this.phrases[sectionKey] = [];
    }

    // Avoid exact duplicate
    if (this.phrases[sectionKey].includes(text)) {
      return false;
    }

    // Insert at front for immediate visibility
    this.phrases[sectionKey] = [text, ...this.phrases[sectionKey]];
    this.save();
    return true;
  }

  /**
   * Update an existing phrase by index
   */
  updatePhrase(sectionKey, index, newText) {
    const text = (newText || '').trim();
    if (!text || !this.phrases[sectionKey] || index < 0 || index >= this.phrases[sectionKey].length) {
      return false;
    }

    const updated = [...this.phrases[sectionKey]];
    updated[index] = text;
    this.phrases[sectionKey] = updated;
    this.save();
    return true;
  }

  /**
   * Delete a phrase by index
   */
  deletePhrase(sectionKey, index) {
    if (!this.phrases[sectionKey] || index < 0 || index >= this.phrases[sectionKey].length) {
      return false;
    }

    const updated = this.phrases[sectionKey].filter((_, i) => i !== index);
    this.phrases[sectionKey] = updated;
    this.save();
    return true;
  }

  /**
   * Reorder phrases within a section
   */
  reorderPhrases(sectionKey, fromIndex, toIndex) {
    if (!this.phrases[sectionKey]) return false;
    const list = [...this.phrases[sectionKey]];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
      return false;
    }
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    this.phrases[sectionKey] = list;
    this.save();
    return true;
  }

  /**
   * Reset a specific section back to default factory phrases
   */
  resetSection(sectionKey) {
    if (DEFAULT_PHRASES[sectionKey]) {
      this.phrases[sectionKey] = [...DEFAULT_PHRASES[sectionKey]];
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Reset all sections back to default factory phrases
   */
  resetAll() {
    this.phrases = { ...DEFAULT_PHRASES };
    this.save();
    return true;
  }
}

export const clinicalPhraseStore = new ClinicalPhraseStore();
