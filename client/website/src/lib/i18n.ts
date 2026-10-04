export type SupportedLanguage = 'en' | 'bn' | 'hi' | 'ur' | 'ar';

export interface TranslationDictionary {
  brand: {
    doctorName: string;
    specialty: string;
    subSpecialty: string;
    tagline: string;
  };
  nav: {
    expertise: string;
    specialties: string;
    services: string;
    resources: string;
    more: string;
    bookAppointment: string;
    login: string;
    register: string;
  };
  banner: {
    eyebrow: string;
    heading1: string;
    heading2: string;
    heading3: string;
    description: string;
    exploreServices: string;
    watchVideo: string;
    expertDoctors: string;
    advancedTech: string;
    personalizedCare: string;
  };
  forms: {
    fullName: string;
    emailAddress: string;
    emailOptional: string;
    phoneNumber: string;
    subject: string;
    message: string;
    preferredDate: string;
    preferredTime: string;
    selectService: string;
    consultationReason: string;
    submit: string;
    submitting: string;
    successMessage: string;
    errorMessage: string;
    requiredField: string;
    phoneRequired: string;
    dateRequired: string;
    timeRequired: string;
    invalidEmail: string;
    invalidPhone: string;
    dayLabel: string;
    dateDayPlaceholder: string;
    timePlaceholder: string;
    manualInputHint: string;
    daysOfWeek: Record<number, string>;
  };
  auth: {
    loginTitle: string;
    loginSubtitle: string;
    registerTitle: string;
    registerSubtitle: string;
    forgotTitle: string;
    forgotSubtitle: string;
    identifierLabel: string;
    identifierPlaceholder: string;
    passwordLabel: string;
    confirmPasswordLabel: string;
    rememberMe: string;
    forgotPassword: string;
    loginSubmit: string;
    registerSubmit: string;
    loggingIn: string;
    registering: string;
    noAccount: string;
    alreadyAccount: string;
    createAccount: string;
    signIn: string;
    backToHome: string;
    loginSuccess: string;
    registerSuccess: string;
    passwordsMismatch: string;
    passwordMinLength: string;
    phoneMandatoryNotice: string;
    sendResetLink: string;
    resetSuccess: string;
  };
  office: {
    eyebrow: string;
    heading: string;
    highlight: string;
    description: string;
    locationTitle: string;
    hospitalName: string;
    hospitalLocation: string;
  };
  footer: {
    description: string;
    explore: string;
    servicesTitle: string;
    getInTouch: string;
    copyright: string;
    privacyPolicy: string;
    terms: string;
    disclaimer: string;
  };
}

export const translations: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    brand: {
      doctorName: 'Ash-Shāfī',
      specialty: 'Gynecology & Obstetrics',
      subSpecialty: 'Medical Specialist',
      tagline: "Exceptional Care For Every Stage of Womanhood",
    },
    nav: {
      expertise: 'Expertise',
      specialties: 'Specialties',
      services: 'Services',
      resources: 'Resources',
      more: 'More',
      bookAppointment: 'Book an Appointment',
      login: 'Login',
      register: 'Register',
    },
    banner: {
      eyebrow: "Women's Health & Wellness",
      heading1: 'Exceptional Care',
      heading2: 'For Every Stage of',
      heading3: 'Womanhood',
      description: 'Expert gynecological care in a safe, supportive and compassionate environment.',
      exploreServices: 'Explore services',
      watchVideo: 'Watch video',
      expertDoctors: 'Expert Doctors',
      advancedTech: 'Advanced Technology',
      personalizedCare: 'Personalized Care',
    },
    forms: {
      fullName: 'Full Name',
      emailAddress: 'Email Address',
      emailOptional: 'Email Address (Optional)',
      phoneNumber: 'Phone Number',
      subject: 'Subject',
      message: 'Your Message / Inquiry',
      preferredDate: 'Appointment Date & Day',
      preferredTime: 'Appointment Time',
      selectService: 'Select Medical Service',
      consultationReason: 'Reason for Consultation',
      submit: 'Send Message',
      submitting: 'Submitting...',
      successMessage: 'Your inquiry has been sent successfully!',
      errorMessage: 'Failed to send your request. Please try again.',
      requiredField: 'This field is required',
      phoneRequired: 'Phone number is mandatory',
      dateRequired: 'Please select or enter an appointment date',
      timeRequired: 'Please select or enter an appointment time',
      invalidEmail: 'Please enter a valid email address',
      invalidPhone: 'Please enter a valid contact phone number',
      dayLabel: 'Day of Week',
      dateDayPlaceholder: 'Type date (e.g. 2026-08-29 or Sat, 29 Aug)',
      timePlaceholder: 'Type time (e.g. 10:00 AM or 16:30)',
      manualInputHint: 'Type manually or pick from dropdown',
      daysOfWeek: {
        0: 'Sunday',
        1: 'Monday',
        2: 'Tuesday',
        3: 'Wednesday',
        4: 'Thursday',
        5: 'Friday',
        6: 'Saturday',
      },
    },
    auth: {
      loginTitle: 'Welcome Back',
      loginSubtitle: 'Sign in to access your patient portal, consultation history, and medical records.',
      registerTitle: 'Create an Account',
      registerSubtitle: 'Register for Ash-Shāfī patient and clinic care portal.',
      forgotTitle: 'Reset Password',
      forgotSubtitle: 'Enter your registered phone or email to receive recovery instructions.',
      identifierLabel: 'Email, Phone Number or Username',
      identifierPlaceholder: 'name@example.com or +8801700000000',
      passwordLabel: 'Password',
      confirmPasswordLabel: 'Confirm Password',
      rememberMe: 'Remember me on this device',
      forgotPassword: 'Forgot Password?',
      loginSubmit: 'Sign In',
      registerSubmit: 'Create Account',
      loggingIn: 'Signing in...',
      registering: 'Creating Account...',
      noAccount: "Don't have an account?",
      alreadyAccount: 'Already have an account?',
      createAccount: 'Sign Up',
      signIn: 'Sign In',
      backToHome: 'Back to Main Website',
      loginSuccess: 'Login successful! Redirecting...',
      registerSuccess: 'Account created successfully! You can now sign in.',
      passwordsMismatch: 'Passwords do not match',
      passwordMinLength: 'Password must be at least 6 characters',
      phoneMandatoryNotice: 'Phone number is mandatory for account verification',
      sendResetLink: 'Send Reset Link',
      resetSuccess: 'Password reset instructions have been sent!',
    },
    office: {
      eyebrow: 'Professional Practice',
      heading: 'Trusted Care,',
      highlight: 'Close to You',
      description: "Ash-Shāfī provides compassionate and specialized women's healthcare at City Hospital, Mohammadpur. Her practice focuses on comprehensive care in Gynecology and Obstetrics.",
      locationTitle: 'Practice Location',
      hospitalName: 'City Hospital',
      hospitalLocation: 'Mohammadpur, Dhaka',
    },
    footer: {
      description: "Compassionate, evidence-based women's healthcare supporting you through every stage of life — from reproductive health and pregnancy to long-term wellness.",
      explore: 'Explore',
      servicesTitle: "Women's Healthcare",
      getInTouch: 'Get in Touch',
      copyright: 'All rights reserved.',
      privacyPolicy: 'Privacy Policy',
      terms: 'Terms & Conditions',
      disclaimer: 'Medical Disclaimer',
    },
  },
  bn: {
    brand: {
      doctorName: 'আশ-শাফী',
      specialty: 'স্ত্রীরোগ ও প্রসূতি বিশেষজ্ঞ',
      subSpecialty: 'চিকিৎসা বিশেষজ্ঞ',
      tagline: 'নারীর জীবনের প্রতিটি পদক্ষেপে নির্ভরযোগ্য সেবা',
    },
    nav: {
      expertise: 'দক্ষতা',
      specialties: 'বিশেষজ্ঞতা',
      services: 'সেবাসমূহ',
      resources: 'রিসোর্স',
      more: 'আরও',
      bookAppointment: 'অ্যাপয়েন্টমেন্ট নিন',
      login: 'লগইন',
      register: 'রেজিস্ট্রেশন',
    },
    banner: {
      eyebrow: 'নারী স্বাস্থ্য ও সুস্থতা',
      heading1: 'বিশেষজ্ঞ সেবা',
      heading2: 'নারীর প্রতিটি',
      heading3: 'অধ্যায়ে',
      description: 'একটি নিরাপদ, সহানুভূতিশীল ও বিশ্বস্ত পরিবেশে অভিজ্ঞ চিকিৎসাসেবা।',
      exploreServices: 'সেবা দেখুন',
      watchVideo: 'ভিডিও দেখুন',
      expertDoctors: 'অভিজ্ঞ চিকিৎসক',
      advancedTech: 'উন্নত প্রযুক্তি',
      personalizedCare: 'ব্যক্তিগত যত্ন',
    },
    forms: {
      fullName: 'পূর্ণ নাম',
      emailAddress: 'ইমেইল ঠিকানা',
      emailOptional: 'ইমেইল ঠিকানা (ঐচ্ছিক)',
      phoneNumber: 'ফোন / মোবাইল নম্বর',
      subject: 'বিষয়',
      message: 'আপনার বার্তা / জিজ্ঞাসা',
      preferredDate: 'সাক্ষাতের তারিখ ও বার',
      preferredTime: 'সাক্ষাতের সময়',
      selectService: 'চিকিৎসা সেবা নির্বাচন করুন',
      consultationReason: 'পরামর্শের কারণ',
      submit: 'বার্তা পাঠান',
      submitting: 'পাঠানো হচ্ছে...',
      successMessage: 'আপনার বার্তা সফলভাবে পাঠানো হয়েছে!',
      errorMessage: 'অনুরোধটি পাঠানো যায়নি। পুনরায় চেষ্টা করুন।',
      requiredField: 'এই তথ্যটি আবশ্যক',
      phoneRequired: 'মোবাইল নম্বর দেওয়া বাধ্যতামূলক',
      dateRequired: 'সাক্ষাতের তারিখ দিন বা নির্বাচন করুন',
      timeRequired: 'সাক্ষাতের সময় দিন বা নির্বাচন করুন',
      invalidEmail: 'সঠিক ইমেইল ঠিকানা দিন',
      invalidPhone: 'সঠিক মোবাইল নম্বর দিন',
      dayLabel: 'বার / দিন',
      dateDayPlaceholder: 'তারিখ টাইপ করুন (যেমন: 2026-08-29 বা শনিবার, ২৯ আগস্ট)',
      timePlaceholder: 'সময় টাইপ করুন (যেমন: 10:00 AM বা 16:30)',
      manualInputHint: 'ক্যালেন্ডার থেকে বেছে নিন অথবা সরাসরি টাইপ করুন',
      daysOfWeek: {
        0: 'রবিবার',
        1: 'সোমবার',
        2: 'মঙ্গলবার',
        3: 'বুধবার',
        4: 'বৃহস্পতিবার',
        5: 'শুক্রবার',
        6: 'শনিবার',
      },
    },
    auth: {
      loginTitle: 'লগইন করুন',
      loginSubtitle: 'রোগী পোর্টাল, পরামর্শের ইতিহাস এবং স্বাস্থ্য বিবরণী দেখতে প্রবেশ করুন।',
      registerTitle: 'নতুন অ্যাকাউন্ট তৈরি করুন',
      registerSubtitle: 'আশ-শাফীর ডিজিটাল স্বাস্থ্যসেবা পোর্টালে নিবন্ধন করুন।',
      forgotTitle: 'পাসওয়ার্ড পুনরুদ্ধার',
      forgotSubtitle: 'আপনার নিবন্ধিত মোবাইল নম্বর বা ইমেইল দিন।',
      identifierLabel: 'ইমেইল, মোবাইল নম্বর বা ইউজারনেম',
      identifierPlaceholder: 'নাম্বার বা ইমেইল লিখুন',
      passwordLabel: 'পাসওয়ার্ড',
      confirmPasswordLabel: 'পাসওয়ার্ড নিশ্চিত করুন',
      rememberMe: 'আমাকে মনে রাখুন',
      forgotPassword: 'পাসওয়ার্ড ভুলে গেছেন?',
      loginSubmit: 'লগইন করুন',
      registerSubmit: 'রেজিস্ট্রেশন করুন',
      loggingIn: 'লগইন হচ্ছে...',
      registering: 'অ্যাকাউন্ট তৈরি হচ্ছে...',
      noAccount: 'অ্যাকাউন্ট নেই?',
      alreadyAccount: 'ইতিমধ্যে অ্যাকাউন্ট আছে?',
      createAccount: 'নতুন সাইন আপ করুন',
      signIn: 'লগইন করুন',
      backToHome: 'মূল ওয়েবসাইটে ফিরুন',
      loginSuccess: 'লগইন সফল হয়েছে! অনুগ্রহ করে অপেক্ষা করুন...',
      registerSuccess: 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! এখন লগইন করুন।',
      passwordsMismatch: 'পাসওয়ার্ড দুটি মেলেনি',
      passwordMinLength: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে',
      phoneMandatoryNotice: 'মোবাইল নম্বর দেওয়া বাধ্যতামূলক',
      sendResetLink: 'রিসেট লিংক পাঠান',
      resetSuccess: 'পাসওয়ার্ড রিসেট নির্দেশিকা পাঠানো হয়েছে!',
    },
    office: {
      eyebrow: 'পেশাদার চিকিৎসা সেবা',
      heading: 'বিশ্বস্ত যত্ন,',
      highlight: 'আপনার নিকটেই',
      description: 'আশ-শাফী সিটি হসপিটাল, মোহাম্মদপুরে সহানুভূতিশীল ও বিশেষায়িত স্বাস্থ্যসেবা প্রদান করেন।',
      locationTitle: 'চেম্বার অবস্থান',
      hospitalName: 'সিটি হসপিটাল',
      hospitalLocation: 'মোহাম্মদপুর, ঢাকা',
    },
    footer: {
      description: 'নারীর প্রজনন স্বাস্থ্য, মাতৃত্বকালীন যত্ন এবং দীর্ঘমেয়াদী সুস্থতার জন্য সহানুভূতিশীল ও তথ্যভিত্তিক চিকিৎসাসেবা।',
      explore: 'অন্বেষণ',
      servicesTitle: 'নারী স্বাস্থ্যসেবা',
      getInTouch: 'যোগাযোগ করুন',
      copyright: 'সর্বস্বত্ব সংরক্ষিত।',
      privacyPolicy: 'গোপনীয়তা নীতি',
      terms: 'শর্তাবলী',
      disclaimer: 'চিকিৎসা দাবিত্যাগ',
    },
  },
  ar: {
    brand: {
      doctorName: 'د. ناميرا تانها',
      specialty: 'أخصائية أمراض النساء والتوليد',
      subSpecialty: 'أخصائية طبية',
      tagline: 'رعاية استثنائية لكل مرحلة من مراحل الأنوثة',
    },
    nav: {
      expertise: 'الخبرات',
      specialties: 'التخصصات',
      services: 'الخدمات',
      resources: 'الموارد',
      more: 'المزيد',
      bookAppointment: 'حجز موعد',
      login: 'تسجيل الدخول',
      register: 'تسجيل جديد',
    },
    banner: {
      eyebrow: 'صحة المرأة والعافية',
      heading1: 'رعاية استثنائية',
      heading2: 'لكل مرحلة من',
      heading3: 'مراحل الأنوثة',
      description: 'رعاية نسائية متخصصة في بيئة آمنة وداعمة ورحيمة.',
      exploreServices: 'استكشاف الخدمات',
      watchVideo: 'مشاهدة الفيديو',
      expertDoctors: 'أطباء خبراء',
      advancedTech: 'تقنية متقدمة',
      personalizedCare: 'رعاية مخصصة',
    },
    forms: {
      fullName: 'الاسم الكامل',
      emailAddress: 'البريد الإلكتروني',
      emailOptional: 'البريد الإلكتروني (اختياري)',
      phoneNumber: 'رقم الهاتف / الجوال',
      subject: 'الموضوع',
      message: 'رسالتك / استفسارك',
      preferredDate: 'تاريخ ويوم الموعد',
      preferredTime: 'وقت الموعد',
      selectService: 'اختر الخدمة الطبية',
      consultationReason: 'سبب الاستشارة',
      submit: 'إرسال الرسالة',
      submitting: 'جاري الإرسال...',
      successMessage: 'تم إرسال استفسارك بنجاح!',
      errorMessage: 'تعذر إرسال الطلب. يرجى المحاولة مرة أخرى.',
      requiredField: 'هذا الحقل مطلوب',
      phoneRequired: 'رقم الهاتف إلزامي',
      dateRequired: 'يرجى تحديد أو إدخال تاريخ الموعد',
      timeRequired: 'يرجى تحديد أو إدخال وقت الموعد',
      invalidEmail: 'يرجى إدخال بريد إلكتروني صالح',
      invalidPhone: 'يرجى إدخال رقم هاتف صحيح',
      dayLabel: 'اليوم',
      dateDayPlaceholder: 'اكتب التاريخ أو اختر من التقويم',
      timePlaceholder: 'اكتب الوقت أو اختر من القائمة',
      manualInputHint: 'اكتب يدويًا أو اختر من التقويم',
      daysOfWeek: {
        0: 'الأحد',
        1: 'الإثنين',
        2: 'الثلاثاء',
        3: 'الأربعاء',
        4: 'الخميس',
        5: 'الجمعة',
        6: 'السبت',
      },
    },
    auth: {
      loginTitle: 'تسجيل الدخول',
      loginSubtitle: 'سجل الدخول للوصول إلى بوابتك الطبية وسجلات الاستشارات.',
      registerTitle: 'إنشاء حساب جديد',
      registerSubtitle: 'سجل في بوابة الرعاية الطبية مع الدكتورة ناميرا.',
      forgotTitle: 'استعادة كلمة المرور',
      forgotSubtitle: 'أدخل رقم الهاتف أو البريد الإلكتروني المسجل.',
      identifierLabel: 'البريد الإلكتروني أو رقم الهاتف أو اسم المستخدم',
      identifierPlaceholder: 'أدخل البريد أو الهاتف',
      passwordLabel: 'كلمة المرور',
      confirmPasswordLabel: 'تأكيد كلمة المرور',
      rememberMe: 'تذكرني',
      forgotPassword: 'نسيت كلمة المرور؟',
      loginSubmit: 'تسجيل الدخول',
      registerSubmit: 'إنشاء الحساب',
      loggingIn: 'جاري تسجيل الدخول...',
      registering: 'جاري إنشاء الحساب...',
      noAccount: 'ليس لديك حساب؟',
      alreadyAccount: 'لديك حساب بالفعل؟',
      createAccount: 'إنشاء حساب',
      signIn: 'تسجيل الدخول',
      backToHome: 'العودة للموقع الرئيسي',
      loginSuccess: 'تم تسجيل الدخول بنجاح!',
      registerSuccess: 'تم إنشاء الحساب بنجاح!',
      passwordsMismatch: 'كلمتا المرور غير متطابقتين',
      passwordMinLength: 'كلمة المرور يجب ألا تقل عن 6 أحرف',
      phoneMandatoryNotice: 'رقم الهاتف إلزامي',
      sendResetLink: 'إرسال رابط الاستعادة',
      resetSuccess: 'تم إرسال تعليمات إعادة تعيين كلمة المرور!',
    },
    office: {
      eyebrow: 'الممارسة المهنية',
      heading: 'رعاية موثوقة،',
      highlight: 'بالقرب منك',
      description: 'تقدم د. ناميرا تانها رعاية صحية نسائية متميزة ومتخصصة في مستشفى سيتي، محمدبور.',
      locationTitle: 'موقع العيادة',
      hospitalName: 'مستشفى سيتي',
      hospitalLocation: 'محمدبور، دكا',
    },
    footer: {
      description: 'رعاية صحية نسائية شاملة ومبنية على الأدلة لدعمك طوال مراحل الحياة.',
      explore: 'استكشاف',
      servicesTitle: 'رعاية صحة المرأة',
      getInTouch: 'تواصل معنا',
      copyright: 'جميع الحقوق محفوظة.',
      privacyPolicy: 'سياسة الخصوصية',
      terms: 'الشروط والأحكام',
      disclaimer: 'إخلاء المسؤولية الطبية',
    },
  },
  ur: {
    brand: {
      doctorName: 'ڈاکٹر نمیرہ تنہا',
      specialty: 'ماہر امراض نسواں و زچگی',
      subSpecialty: 'میڈیکل اسپیشلسٹ',
      tagline: 'خواتین کے ہر دور کے لیے بہترین نگہداشت',
    },
    nav: {
      expertise: 'مہارت',
      specialties: 'تخصصات',
      services: 'خدمات',
      resources: 'وسائل',
      more: 'مزید',
      bookAppointment: 'ملاقات کا وقت طے کریں',
      login: 'لاگ ان',
      register: 'رجسٹر کریں',
    },
    banner: {
      eyebrow: 'خواتین کی صحت اور تندرستی',
      heading1: 'بہترین طبی نگہداشت',
      heading2: 'زندگی کے ہر موڑ پر',
      heading3: 'محفوظ رہنمائی',
      description: 'ایک محفوظ، ہمدردانہ اور پیشہ ورانہ ماحول میں امراض نسواں کی خصوصی دیکھ بھال۔',
      exploreServices: 'خدمات دیکھیں',
      watchVideo: 'ویڈیو دیکھیں',
      expertDoctors: 'ماہر ڈاکٹرز',
      advancedTech: 'جدید ٹیکنالوجی',
      personalizedCare: 'انفرادی نگہداشت',
    },
    forms: {
      fullName: 'پورا نام',
      emailAddress: 'ای میل ایڈریس',
      emailOptional: 'ای میل ایڈریس (اختیاری)',
      phoneNumber: 'فون / موبائل نمبر',
      subject: 'موضوع',
      message: 'آپ کا پیغام / سوال',
      preferredDate: 'ملاقات کی تاریخ اور دن',
      preferredTime: 'ملاقات کا وقت',
      selectService: 'طبی سروس منتخب کریں',
      consultationReason: 'مشورے کی وجہ',
      submit: 'پیغام بھیجیں',
      submitting: 'ارسال ہو رہا ہے...',
      successMessage: 'آپ کا پیغام کامیابی سے موصول ہو گیا ہے!',
      errorMessage: 'پیغام بھیجنے میں ناکامی۔ براہ کرم دوبارہ کوشش کریں۔',
      requiredField: 'یہ معلومات ضروری ہے',
      phoneRequired: 'موبائل نمبر لازمی ہے',
      dateRequired: 'ملاقات کی تاریخ درج کریں یا منتخب کریں',
      timeRequired: 'ملاقات کا وقت درج کریں یا منتخب کریں',
      invalidEmail: 'براہ کرم درست ای میل درج کریں',
      invalidPhone: 'براہ کرم درست موبائل نمبر درج کریں',
      dayLabel: 'دن / بار',
      dateDayPlaceholder: 'تاریخ درج کریں (مثال: 2026-08-29)',
      timePlaceholder: 'وقت درج کریں (مثال: 10:00 AM)',
      manualInputHint: 'خود لکھیں یا کلینڈر سے منتخب کریں',
      daysOfWeek: {
        0: 'اتوار',
        1: 'پیر',
        2: 'منگل',
        3: 'بدھ',
        4: 'جمعرات',
        5: 'جمعہ',
        6: 'ہفتہ',
      },
    },
    auth: {
      loginTitle: 'لاگ ان کریں',
      loginSubtitle: 'اپنے مریض پورٹل اور طبی ریکارڈز تک رسائی کے لیے داخل ہوں۔',
      registerTitle: 'نیا اکاؤنٹ بنائیں',
      registerSubtitle: 'ڈاکٹر نمیرہ تنہا پورٹل میں رجسٹریشن کریں۔',
      forgotTitle: 'پاس ورڈ بحال کریں',
      forgotSubtitle: 'اپنا رجسٹرڈ فون نمبر یا ای میل درج کریں۔',
      identifierLabel: 'ای میل، فون نمبر یا یوزر نیم',
      identifierPlaceholder: 'ای میل یا فون نمبر درج کریں',
      passwordLabel: 'پاس ورڈ',
      confirmPasswordLabel: 'پاس ورڈ کی تصدیق کریں',
      rememberMe: 'مجھے یاد رکھیں',
      forgotPassword: 'پاس ورڈ بھول گئے؟',
      loginSubmit: 'لاگ ان',
      registerSubmit: 'اکاؤنٹ بنائیں',
      loggingIn: 'لاگ ان ہو رہا ہے...',
      registering: 'اکاؤنٹ بن رہا ہے...',
      noAccount: 'اکاؤنٹ نہیں ہے؟',
      alreadyAccount: 'پہلے سے اکاؤنٹ موجود ہے؟',
      createAccount: 'سائن اپ کریں',
      signIn: 'لاگ ان کریں',
      backToHome: 'مرکزی ویب سائٹ پر واپس جائیں',
      loginSuccess: 'لاگ ان کامیاب رہا!',
      registerSuccess: 'اکاؤنٹ کامیابی سے بن گیا ہے!',
      passwordsMismatch: 'پاس ورڈ مماثل نہیں ہیں',
      passwordMinLength: 'پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے',
      phoneMandatoryNotice: 'موبائل نمبر لازمی ہے',
      sendResetLink: 'ری سیٹ لنک بھیجیں',
      resetSuccess: 'پاس ورڈ بحالی کی ہدایات بھیج دی گئی ہیں!',
    },
    office: {
      eyebrow: 'پیشہ ورانہ پریکٹس',
      heading: 'قابل اعتماد علاج،',
      highlight: 'آپ کے قریب',
      description: 'ڈاکٹر نمیرہ تنہا سٹی ہسپتال، محمد پور میں خواتین کے لیے ہمدردانہ اور خصوصی طبی خدمات فراہم کرتی ہیں۔',
      locationTitle: 'کلینک کا مقام',
      hospitalName: 'سٹی ہسپتال',
      hospitalLocation: 'محمد پور، ڈھاکہ',
    },
    footer: {
      description: 'تولیدی صحت، حمل اور طویل مدتی تندرستی کے لیے قابل اعتماد اور ہمدردانہ طبی دیکھ بھال۔',
      explore: 'دریافت کریں',
      servicesTitle: 'خواتین کی صحت کی دیکھ بھال',
      getInTouch: 'رابطہ کریں',
      copyright: 'جملہ حقوق محفوظ ہیں۔',
      privacyPolicy: 'رازداری کی پالیسی',
      terms: 'شرائط و ضوابط',
      disclaimer: 'طبی دستبرداری',
    },
  },
  hi: {
    brand: {
      doctorName: 'डॉ. नमिरा तन्हा',
      specialty: 'स्त्री रोग एवं प्रसूति विशेषज्ञ',
      subSpecialty: 'चिकित्सा विशेषज्ञ',
      tagline: 'नारी जीवन के हर चरण में उत्कृष्ट देखभाल',
    },
    nav: {
      expertise: 'विशेषज्ञता',
      specialties: 'विशेषताएं',
      services: 'सेवाएं',
      resources: 'संसाधन',
      more: 'अधिक',
      bookAppointment: 'अपॉइंटमेंट बुक करें',
      login: 'लॉग इन',
      register: 'पंजीकरण',
    },
    banner: {
      eyebrow: 'महिला स्वास्थ्य एवं कल्याण',
      heading1: 'उत्कृष्ट देखभाल',
      heading2: 'नारी जीवन के',
      heading3: 'हर चरण में',
      description: 'सुरक्षित, सहायक और संवेदनशील वातावरण में विशेषज्ञ स्त्री रोग देखभाल।',
      exploreServices: 'सेवाएं देखें',
      watchVideo: 'वीडियो देखें',
      expertDoctors: 'विशेषज्ञ डॉक्टर',
      advancedTech: 'उन्नत तकनीक',
      personalizedCare: 'व्यक्तिगत देखभाल',
    },
    forms: {
      fullName: 'पूरा नाम',
      emailAddress: 'ईमेल पता',
      emailOptional: 'ईमेल पता (वैकल्पिक)',
      phoneNumber: 'फ़ोन / मोबाइल नंबर',
      subject: 'विषय',
      message: 'आपका संदेश / पूछताछ',
      preferredDate: 'अपॉइंटमेंट की तिथि व दिन',
      preferredTime: 'अपॉइंटमेंट का समय',
      selectService: 'चिकित्सा सेवा चुनें',
      consultationReason: 'परामर्श का कारण',
      submit: 'संदेश भेजें',
      submitting: 'भेजा जा रहा है...',
      successMessage: 'आपका संदेश सफलतापूर्वक भेजा गया!',
      errorMessage: 'अनुरोध भेजने में विफल। कृपया पुनः प्रयास करें।',
      requiredField: 'यह फ़ील्ड आवश्यक है',
      phoneRequired: 'मोबाइल नंबर अनिवार्य है',
      dateRequired: 'कृपया अपॉइंटमेंट की तिथि चुनें या दर्ज करें',
      timeRequired: 'कृपया अपॉइंटमेंट का समय चुनें या दर्ज करें',
      invalidEmail: 'कृपया एक मान्य ईमेल दर्ज करें',
      invalidPhone: 'कृपया एक मान्य फ़ोन नंबर दर्ज करें',
      dayLabel: 'दिन / वार',
      dateDayPlaceholder: 'तिथि दर्ज करें (जैसे: 2026-08-29)',
      timePlaceholder: 'समय दर्ज करें (जैसे: 10:00 AM)',
      manualInputHint: 'कैलेंडर से चुनें या सीधे टाइप करें',
      daysOfWeek: {
        0: 'रविवार',
        1: 'सोमवार',
        2: 'मंगलवार',
        3: 'बुधवार',
        4: 'गुरुवार',
        5: 'शुक्रवार',
        6: 'शनिवार',
      },
    },
    auth: {
      loginTitle: 'लॉग इन करें',
      loginSubtitle: 'अपने मेडिकल रिकॉर्ड और अपॉइंटमेंट के लिए लॉग इन करें।',
      registerTitle: 'नया खाता बनाएं',
      registerSubtitle: 'डॉ. नमिरा तन्हा पोर्टल पर पंजीकरण करें।',
      forgotTitle: 'पासवर्ड रीसेट करें',
      forgotSubtitle: 'अपना पंजीकृत फ़ोन नंबर या ईमेल दर्ज करें।',
      identifierLabel: 'ईमेल, फ़ोन नंबर या यूज़रनेम',
      identifierPlaceholder: 'ईमेल या फ़ोन नंबर दर्ज करें',
      passwordLabel: 'पासवर्ड',
      confirmPasswordLabel: 'पासवर्ड की पुष्टि करें',
      rememberMe: 'मुझे याद रखें',
      forgotPassword: 'पासवर्ड भूल गए?',
      loginSubmit: 'लॉग इन करें',
      registerSubmit: 'खाता बनाएं',
      loggingIn: 'लॉग इन हो रहा है...',
      registering: 'खाता बनाया जा रहा है...',
      noAccount: 'खाता नहीं है?',
      alreadyAccount: 'पहले से खाता है?',
      createAccount: 'साइन अप करें',
      signIn: 'लॉग इन करें',
      backToHome: 'मुख्य वेबसाइट पर लौटें',
      loginSuccess: 'लॉग इन सफल!',
      registerSuccess: 'खाता सफलतापूर्वक बनाया गया!',
      passwordsMismatch: 'पासवर्ड मेल नहीं खाते',
      passwordMinLength: 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए',
      phoneMandatoryNotice: 'मोबाइल नंबर अनिवार्य है',
      sendResetLink: 'रीसेट लिंक भेजें',
      resetSuccess: 'पासवर्ड रीसेट निर्देश भेजे गए हैं!',
    },
    office: {
      eyebrow: 'व्यावसायिक अभ्यास',
      heading: 'विश्वसनीय देखभाल,',
      highlight: 'आपके निकट',
      description: 'डॉ. नमिरा तन्हा सिटी हॉस्पिटल, मोहम्मदपुर में महिलाओं के लिए संवेदनशील और विशेषज्ञ स्वास्थ्य सेवा प्रदान करती हैं।',
      locationTitle: 'क्लिनिक स्थान',
      hospitalName: 'सिटी हॉस्पिटल',
      hospitalLocation: 'मोहम्मदपुर, ढाका',
    },
    footer: {
      description: 'प्रजनन स्वास्थ्य, गर्भावस्था और दीर्घकालिक कल्याण के लिए संवेदनशील और साक्ष्य-आधारित महिला स्वास्थ्य देखभाल।',
      explore: 'एक्सप्लोर करें',
      servicesTitle: 'महिला स्वास्थ्य देखभाल',
      getInTouch: 'संपर्क करें',
      copyright: 'सर्वाधिकार सुरक्षित।',
      privacyPolicy: 'गोपनीयता नीति',
      terms: 'नियम और शर्तें',
      disclaimer: 'चिकित्सा अस्वीकरण',
    },
  },
};

export const isRTL = (lang: SupportedLanguage): boolean => {
  return lang === 'ar' || lang === 'ur';
};

