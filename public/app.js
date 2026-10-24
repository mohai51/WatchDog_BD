/**
 * WatchDog BD — Community-Powered Crime Reporting & Public Safety Intelligence
 * Modern Map-First Frontend Application (Leaflet.js + Chart.js)
 */

const $ = id => document.getElementById(id);
const $text = (id, val) => { const el = $(id); if (el) el.textContent = val; };

// 1. Translations & Lexicon (Bilingual BN & EN)
const I18N = {
  bn: {
    brandTag: 'কমিউনিটি পাবলিক সেফটি ইন্টেলিজেন্স',
    navMap: 'ম্যাপ দেখুন',
    navHow: 'কীভাবে কাজ করে',
    navSafety: 'জরুরি সেবা',
    navTrack: 'রিপোর্ট ট্র্যাক করুন',
    navCompare: 'জেলার তুলনা',
    ctaReport: '+ রিপোর্ট করুন',
    heroEyebrow: 'নাগরিক অংশগ্রহণমূলক অপরাধ পর্যবেক্ষণ ও নিরাপত্তা তথ্য',
    heroHeading: 'আপনার এলাকার অপরাধ পরিস্থিতি সম্পর্কে জানুন',
    heroSub: 'বাংলাদেশের ৬৪ জেলার অপরাধসংক্রান্ত রিপোর্ট, নিরাপত্তা তথ্য ও বিশ্লেষণ এক প্ল্যাটফর্মে। নাগরিক সতর্কতা ও সঠিক তথ্যের জন্য উন্মুক্ত উদ্যোগ।',
    ctaExplore: 'ম্যাপ অনুসন্ধান করুন',
    ctaReportSecondary: 'একটি ঘটনা রিপোর্ট করুন',
    trustNotice: 'রিপোর্টগুলো যাচাইকৃত • কোনো মনগড়া পরিসংখ্যান নয়',
    statTotalReports: 'প্রকাশিত মোট রিপোর্ট',
    statTotalNote: 'সারাদেশের যাচাইকৃত রেকর্ড',
    statDistricts: 'আওতাভুক্ত জেলা',
    statDistrictsNote: 'খাঁটি বাস্তব GeoJSON সীমানা',
    statDrugReports: 'মাদকসংক্রান্ত রেকর্ড',
    statDrugNote: 'প্রকাশিত ও পর্যালোচিত',
    statLastUpdate: 'সর্বশেষ আপডেট',
    statUpdateNote: 'লাইভ ডাটাবেস সিঙ্ক',
    searchPlaceholder: 'জেলা খুঁজুন... (e.g. Dhaka, Bogra, সিলেট)',
    allCategories: 'সব ধরনের অপরাধ (All Categories)',
    catExtortion: 'চাঁদাবাজি (Extortion)',
    catTheft: 'চুরি (Theft)',
    catRobbery: 'ডাকাতি (Robbery)',
    catSnatching: 'ছিনতাই (Snatching)',
    catDrug: 'মাদকসংক্রান্ত (Drug-related)',
    catDrug_related: 'মাদকসংক্রান্ত (Drug-related)',
    catHarassment: 'হয়রানি (Harassment)',
    catAssault: 'হামলা (Assault)',
    catRape: 'ধর্ষণ (Rape)',
    catFraud: 'প্রতারণা (Fraud)',
    catOther: 'অন্যান্য (Other)',
    footerBrandDesc: 'WatchDog BD বাংলাদেশে প্রথম কমিউনিটি-ভিত্তিক অপরাধ রিপোর্টিং প্ল্যাটফর্ম। অপরাধমুক্ত বাংলাদেশ গড়তে আমরা দৃঢ় অঙ্গীকারবদ্ধ।',
    rangeAll: 'সব সময় (All Time)',
    range7d: 'গত ৭ দিন (Last 7 Days)',
    range30d: 'গত ৩০ দিন (Last 30 Days)',
    range6m: 'গত ৬ মাস (Last 6 Months)',
    btnReset: 'রিসেট',
    divAll: 'সব বিভাগ',
    legendTitle: 'অনুমোদিত রিপোর্ট সংখ্যা',
    legendLow: '০-১ (কম)',
    legendMid: '৩-৫',
    legendHigh: '১০+ (বেশি)',
    drawerTotalReports: 'মোট অনুমোদিত রিপোর্ট',
    drawerNationalShare: 'জাতীয় অনুপাত',
    btnReportHere: 'এই জেলায় রিপোর্ট করুন',
    btnShare: 'শেয়ার',
    headingCategories: 'ঘটনার ধরন অনুযায়ী বিন্যাস',
    headingMonthly: 'গত ৬ মাসের ট্রেন্ড',
    headingVerifiedIncidents: 'যাচাইকৃত ঘটনার বিবরণ',
    methodologyDisclaimer: 'এই তথ্য নাগরিক রিপোর্ট এবং গণমাধ্যমে প্রকাশিত সত্য ঘটনার ওপর ভিত্তি করে তৈরি। এটি অপরাধের হার বা কোনো জেলার সামগ্রিক নিরাপত্তার চূড়ান্ত মাপকাঠি নয়।',
    mapFooterVector: 'খাঁটি ৬৪ জেলার সীমানা • কোনো বাহ্যিক ট্র্যাকিং বা রাস্তার লেয়ার নেই',
    mapReady: 'ম্যাপ প্রস্তুত',
    modalReportTitle: 'ঘটনার রিপোর্ট জমা দিন',
    modalReportSubtitle: 'সচেতন নাগরিক হিসেবে সত্য তথ্য দিয়ে জননিরাপত্তায় ভূমিকা রাখুন।',
    step1Title: 'ধাপ ১: ঘটনার প্রাথমিক তথ্য',
    fieldCategory: 'অপরাধের ধরন',
    fieldDistrict: 'জেলা',
    fieldDate: 'ঘটনার তারিখ',
    fieldTime: 'আনুমানিক সময়',
    fieldLocation: 'আনুমানিক এলাকা / স্থান (বাসা বা ব্যক্তিগত ঠিকানা দেবেন না)',
    btnNext: 'পরবর্তী ধাপ',
    step2Title: 'ধাপ ২: ঘটনার বিস্তারিত ও সত্যতা',
    fieldWitness: 'ঘটনায় আপনার সংশ্লিষ্টতা',
    optVictim: 'আমি নিজেই ঘটনার ভুক্তভোগী',
    optWitness: 'আমি সরাসরি ঘটনার প্রত্যক্ষদর্শী',
    optInformed: 'আমি বিশ্বস্ত স্থানীয় সূত্র বা সংবাদ থেকে অবহিত',
    fieldDesc: 'ঘটনার বস্তুনিষ্ঠ বিবরণ (কমপক্ষে ১৫ অক্ষর)',
    fieldReference: 'তথ্যসূত্র বা সংবাদের লিংক (যদি থাকে)',
    fieldName: 'আপনার নাম (ঐচ্ছিক - জনসম্মুখে গোপন রাখা হবে)',
    fieldContact: 'যোগাযোগের নম্বর/ইমেইল (ঐচ্ছিক - সম্পূর্ণ গোপন)',
    btnBack: 'পূর্ববর্তী ধাপ',
    step3Title: 'ধাপ ৩: চূড়ান্ত পর্যালোচনা ও জমা',
    confirmDeclaration: 'আমি ঘোষণা করছি যে এই তথ্য আমার জানা মতে সম্পূর্ণ সত্য এবং কোনো ব্যক্তিকে হয়রানি করার উদ্দেশ্যে উদ্দেশ্যপ্রণোদিতভাবে মিথ্যা তথ্য দেওয়া হচ্ছে না।',
    btnSubmit: 'জমা দিন (Submit Report)',
    successTitle: 'রিপোর্টটি সফলভাবে জমা হয়েছে!',
    successSub: 'আমাদের মডারেশন টিম তথ্য যাচাইয়ের পর এটি প্ল্যাটফর্মে প্রকাশ করবে। আপনার রিপোর্টের অবস্থা ট্র্যাক করতে নিচের গোপন রেফারেন্স কোডটি সংরক্ষণ করুন:',
    btnClose: 'ঠিক আছে (সম্পন্ন)',
    trackModalTitle: 'রিপোর্টের অবস্থা জানুন',
    trackModalSub: 'আপনার সাবমিশন কোড দিয়ে মডারেশন ও অনুমোদনের লাইভ স্ট্যাটাস দেখুন।',
    trackLabel: 'গোপন ট্র্যাকিং রেফারেন্স (e.g. WD-8F3K9A)',
    btnSearchStatus: 'অনুসন্ধান করুন',
    compareTitle: 'দুই জেলার তথ্যভিত্তিক তুলনা',
    compareSub: 'দুটি জেলার যাচাইকৃত রিপোর্টের সংখ্যা ও অপরাধের ধরনের তুলনামূলক বিশ্লেষণ।',
    compareD1: 'প্রথম জেলা:',
    compareD2: 'দ্বিতীয় জেলা:',
    btnCompareRun: 'তুলনা দেখুন',
    safetyTitle: 'জরুরি যোগাযোগ ও নিরাপত্তা নির্দেশিকা',
    safetySub: 'বাংলাদেশে তাত্ক্ষণিক বিপদ বা অপরাধের শিকার হলে করণীয় ও অফিসিয়াল হেল্পলাইন।',
    methodTitle: 'তথ্য সংগ্রহের পদ্ধতি ও সীমাবদ্ধতা',
    methodSub: 'WatchDog BD কীভাবে তথ্য সংগ্রহ, যাচাই ও প্রদর্শন করে।',
    navMethodology: 'তথ্যের সীমাবদ্ধতা',
    noIncidentsFound: 'এই ফিল্টারে কোনো প্রকাশিত ঘটনা পাওয়া যায়নি।',
    insightHeaderTitle: 'লাইভ জেলা অপরাধ বিশ্লেষণ',
    insightViewMap: 'ম্যাপে এই জেলা দেখুন',
    insightHighLabel: 'সবচেয়ে বেশি সংঘটিত অপরাধ',
    insightLowLabel: 'তুলনামূলক কম সংঘটিত অপরাধ',
    insightNoOtherCrime: 'অন্য কোনো অপরাধের রেকর্ড নেই',
    insightAllOtherZero: 'বাকি সব ক্যাটাগরিতে ০টি রিপোর্ট',
    composerTitle: 'ঘটনা রিপোর্ট করুন',
    composerNamePlaceholder: 'আপনার নাম (ঐচ্ছিক)',
    composerAnon: 'গোপন রাখুন',
    composerAnonActive: 'গোপন রাখা হয়েছে',
    composerDistrictLabel: 'জেলা নির্বাচন',
    selectDistrict: 'জেলা নির্বাচন করুন',
    composerCategoryLabel: 'অপরাধের ধরন',
    selectType: 'অপরাধের ধরন নির্বাচন',
    composerDescPlaceholder: 'কী ঘটেছে? বিস্তারিত লিখুন...',
    composerAddPhoto: 'ছবি যোগ করুন',
    composerAutoTime: 'Auto Date & Time',
    composerSubmit: 'রিপোর্ট জমা দিন',
    composerSubmitting: 'রিপোর্ট জমা হচ্ছে...',
    composerSuccessMessage: 'আপনার রিপোর্ট জমা হয়েছে। যাচাইয়ের পর প্রকাশ করা হবে।',
    composerTrackingLabel: 'আপনার গোপন ট্র্যাকিং আইডি:',
    composerCopy: 'কপি করুন',
    composerCopied: 'কপি হয়েছে!',
    errDistrict: 'অনুগ্রহ করে জেলা নির্বাচন করুন।',
    errCategory: 'অনুগ্রহ করে অপরাধের ধরন নির্বাচন করুন।',
    errDesc: 'ঘটনার বিবরণ কমপক্ষে ১৫ অক্ষরের হতে হবে (সর্বোচ্চ ২,০০০ অক্ষর)।',
    errImageSize: 'ছবি ফাইলের আকার সর্বোচ্চ ৫ মেগাবাইট হতে পারবে।',
    errImageType: 'শুধুমাত্র JPG, JPEG, PNG অথবা WebP ছবি গ্রহণযোগ্য।',
    navDistrictFeed: 'জেলাভিত্তিক অপরাধ',
    feedTitle: 'জেলাভিত্তিক অপরাধ ডিরেক্টরি',
    feedSub: 'সারাদেশের সাম্প্রতিক অপরাধের লাইভ ফিড, প্রমাণ চিত্র ও জেলাওয়ারি অনুসন্ধান',
    feedCtaHeading: 'আপনার এলাকায় কোনো অপরাধের ঘটনা ঘটেছে?',
    feedCtaSub: 'নিরাপদ বাংলাদেশ গড়তে অপরাধের তথ্য ও ছবি দিয়ে সবার সচেতনতা বৃদ্ধি করুন।',
    feedCtaBtnText: 'অপরাধ রিপোর্ট করুন',
    feedTotal: 'মোট অপরাধ: ',
    feedLike: 'সচেতন',
    feedLiked: 'সচেতনতা প্রকাশ করেছেন',
    feedNoResults: 'এই ফিল্টারে কোনো অপরাধের রেকর্ড পাওয়া যায়নি।'
  },
  en: {
    brandTag: 'Community Public Safety Intelligence',
    navMap: 'Explore Map',
    navHow: 'How It Works',
    navSafety: 'Safety Resources',
    navTrack: 'Track Report',
    navCompare: 'Compare Districts',
    ctaReport: 'Report Incident',
    heroEyebrow: 'COMMUNITY-POWERED CRIME REPORTING & PUBLIC SAFETY INTELLIGENCE',
    heroHeading: 'Understand Crime & Safety In Your District',
    heroSub: 'Nationwide crowd-sourced incident reporting, moderated records, and civic intelligence across all 64 districts of Bangladesh.',
    ctaExplore: 'Explore Safety Map',
    ctaReportSecondary: 'Report an Incident',
    trustNotice: 'Moderated community data • Not official police crime stats',
    statTotalReports: 'Published Reports',
    statTotalNote: 'Nationwide verified records',
    statDistricts: 'Districts Covered',
    statDistrictsNote: 'Authentic 64 GeoJSON boundaries',
    statDrugReports: 'Drug-related Records',
    statDrugNote: 'Published and reviewed',
    statLastUpdate: 'Last Update',
    statUpdateNote: 'Live database sync',
    searchPlaceholder: 'Search district... (e.g. Dhaka, Bogra, Sylhet)',
    allCategories: 'All Categories',
    catExtortion: 'Extortion',
    catTheft: 'Theft',
    catRobbery: 'Robbery',
    catSnatching: 'Snatching',
    catDrug: 'Drug-related',
    catDrug_related: 'Drug-related',
    catHarassment: 'Harassment',
    catAssault: 'Assault',
    catRape: 'Rape',
    catFraud: 'Fraud',
    catOther: 'Other',
    footerBrandDesc: 'WatchDog BD is the first community-based crime reporting platform in Bangladesh. We are committed to building a crime-free Bangladesh.',
    rangeAll: 'All Time',
    range7d: 'Last 7 Days',
    range30d: 'Last 30 Days',
    range6m: 'Last 6 Months',
    btnReset: 'Reset',
    divAll: 'All Divisions',
    legendTitle: 'Approved Incident Reports',
    legendLow: '0-1 (Low)',
    legendMid: '3-5',
    legendHigh: '10+ (High)',
    drawerTotalReports: 'Approved Reports',
    drawerNationalShare: 'National Share',
    btnReportHere: 'Report in this District',
    btnShare: 'Share',
    headingCategories: 'Category Breakdown',
    headingMonthly: '6-Month Trend',
    headingVerifiedIncidents: 'Verified Incident Records',
    methodologyDisclaimer: 'This data reflects citizen submissions and verified media reports. It is not equivalent to official police crime statistics or definitive safety ratings.',
    mapFooterVector: 'Authentic 64 district polygons • Zero external tile trackers',
    mapReady: 'Map Ready',
    modalReportTitle: 'Submit an Incident Report',
    modalReportSubtitle: 'Contribute to public safety intelligence with truthful information.',
    step1Title: 'Step 1: Incident Overview',
    fieldCategory: 'Crime Category',
    fieldDistrict: 'District',
    fieldDate: 'Incident Date',
    fieldTime: 'Approximate Time',
    fieldLocation: 'Approximate Locality / Area (Never provide home addresses)',
    btnNext: 'Next Step',
    step2Title: 'Step 2: Details & Evidence',
    fieldWitness: 'Your Connection to Incident',
    optVictim: 'I am the direct victim',
    optWitness: 'I was a direct eyewitness',
    optInformed: 'I am informed via verified local knowledge or news',
    fieldDesc: 'Objective Description (minimum 15 characters)',
    fieldReference: 'Source Reference or News URL (optional)',
    fieldName: 'Your Name (optional - strictly confidential)',
    fieldContact: 'Contact Info (optional - strictly confidential)',
    btnBack: 'Previous Step',
    step3Title: 'Step 3: Review & Submit',
    confirmDeclaration: 'I declare that this information is truthful to the best of my knowledge and is not intended to harass or defame any individual.',
    btnSubmit: 'Submit Report',
    successTitle: 'Report Successfully Submitted!',
    successSub: 'Our moderation team will review this report before publication. Save your secret tracking reference code below:',
    btnClose: 'Done',
    trackModalTitle: 'Track Report Status',
    trackModalSub: 'Check live moderation and verification status with your tracking reference.',
    trackLabel: 'Secret Tracking Reference (e.g. WD-8F3K9A)',
    btnSearchStatus: 'Search Status',
    compareTitle: 'Compare Two Districts',
    compareSub: 'Comparative breakdown of incident counts and categories between two districts.',
    compareD1: 'First District:',
    compareD2: 'Second District:',
    btnCompareRun: 'Run Comparison',
    safetyTitle: 'Emergency Contacts & Guidelines',
    safetySub: 'Official hotlines and immediate safety guidance in Bangladesh.',
    methodTitle: 'Methodology & Data Limitations',
    methodSub: 'How WatchDog BD collects, verifies, and maps public safety reports.',
    navMethodology: 'Data Limitations',
    noIncidentsFound: 'No published incidents found matching this filter.',
    insightHeaderTitle: 'Live District Crime Intelligence',
    insightViewMap: 'Explore on Map',
    insightHighLabel: 'Highest Reported Crime',
    insightLowLabel: 'Lowest Reported Crime',
    insightNoOtherCrime: 'No other crimes recorded',
    insightAllOtherZero: 'All other categories 0 reports',
    composerTitle: 'Report an Incident',
    composerNamePlaceholder: 'Your Name (Optional)',
    composerAnon: 'Anonymous',
    composerAnonActive: 'Anonymous Active',
    composerDistrictLabel: 'Select District',
    selectDistrict: 'Select District',
    composerCategoryLabel: 'Crime Category',
    selectType: 'Select Category',
    composerDescPlaceholder: 'What happened? Write details...',
    composerAddPhoto: 'Add Photo',
    composerAutoTime: 'Auto Date & Time',
    composerSubmit: 'Submit Report',
    composerSubmitting: 'Submitting Report...',
    composerSuccessMessage: 'Your report has been submitted. It will be published after verification.',
    composerTrackingLabel: 'Your Secret Tracking ID:',
    composerCopy: 'Copy',
    composerCopied: 'Copied!',
    errDistrict: 'Please select a district.',
    errCategory: 'Please select a crime category.',
    errDesc: 'Narrative must be between 15 and 2,000 characters.',
    errImageSize: 'Image file size cannot exceed 5 MB.',
    errImageType: 'Only JPG, JPEG, PNG, or WebP images are allowed.',
    navDistrictFeed: 'District Crime Feed',
    feedTitle: 'District Crime Directory',
    feedSub: 'Live incident feed, photo evidence and district-wise search',
    feedCtaHeading: 'Witnessed a crime in your neighborhood?',
    feedCtaSub: 'Help keep Bangladesh safe by reporting crime incidents with photos.',
    feedCtaBtnText: 'Report Incident',
    feedTotal: 'Total Crimes: ',
    feedLike: 'Aware',
    feedLiked: 'Reacted',
    feedNoResults: 'No crime records found matching this filter.'
  }
};

const BN_DISTRICTS = {
  'Dhaka':'ঢাকা','Gazipur':'গাজীপুর','Narayanganj':'নারায়ণগঞ্জ','Chattogram':'চট্টগ্রাম','Chittagong':'চট্টগ্রাম',
  'Cumilla':'কুমিল্লা','Comilla':'কুমিল্লা','Sylhet':'সিলেট','Rajshahi':'রাজশাহী','Khulna':'খুলনা',
  'Barishal':'বরিশাল','Barisal':'বরিশাল','Rangpur':'রংপুর','Mymensingh':'ময়মনসিংহ','Jhalokati':'ঝালকাঠি',
  'Jhalokathi':'ঝালকাঠি','Coxs Bazar':'কক্সবাজার',"Cox's Bazar":'কক্সবাজার','Noakhali':'নোয়াখালী','Feni':'ফেনী',
  'Bogra':'বগুড়া','Bogura':'বগুড়া','Tangail':'টাঙ্গাইল','Faridpur':'ফরিদপুর','Pabna':'পাবনা',
  'Kushtia':'কুষ্টিয়া','Jessore':'যশোর','Jashore':'যশোর','Satkhira':'সাতক্ষীরা','Bagerhat':'বাগেরহাট',
  'Pirojpur':'পিরোজপুর','Patuakhali':'পটুয়াখালী','Bhola':'ভোলা','Barguna':'বরগুনা','Narsingdi':'নরসিংদী',
  'Manikganj':'মানিকগঞ্জ','Munshiganj':'মুন্সিগঞ্জ','Madaripur':'মাদারীপুর','Shariatpur':'শরীয়তপুর',
  'Gopalganj':'গোপালগঞ্জ','Kishoreganj':'কিশোরগঞ্জ','Jamalpur':'জামালপুর','Sherpur':'শেরপুর',
  'Netrokona':'নেত্রকোনা','Sunamganj':'সুনামগঞ্জ','Habiganj':'হবিগঞ্জ','Moulvibazar':'মৌলভীবাজার',
  'Brahmanbaria':'ব্রাহ্মণবাড়িয়া','Chandpur':'চাঁদপুর','Lakshmipur':'লক্ষ্মীপুর','Laxmipur':'লক্ষ্মীপুর',
  'Bandarban':'বান্দরবান','Rangamati':'রাঙামাটি','Khagrachhari':'খাগড়াছড়ি','Natore':'নাটোর',
  'Naogaon':'নওগাঁ','Chapainawabganj':'চাঁপাইনবাবগঞ্জ','Joypurhat':'জয়পুরহাট','Sirajganj':'সিরাজগঞ্জ',
  'Dinajpur':'দিনাজপুর','Thakurgaon':'ঠাকুরগাঁও','Panchagarh':'পঞ্চগড়','Nilphamari':'নীলফামারী',
  'Lalmonirhat':'লালমনিরহাট','Kurigram':'কুড়িগ্রাম','Gaibandha':'গাইবান্ধা','Chuadanga':'চুয়াডাঙ্গা',
  'Meherpur':'মেহেরপুর','Magura':'মাগুরা','Narail':'নড়াইল','Jhenaidah':'ঝিনাইদহ'
};

const CATEGORIES = ['extortion', 'theft', 'robbery', 'snatching', 'drug_related', 'harassment', 'assault', 'rape', 'fraud', 'other'];

let lang = localStorage.getItem('watchdog_lang') || 'bn';
let selectedDistrictCode = '';
let geoFeatures = [];
let geoLayer = null;
let statsData = null;
let typeChart = null;
let monthChart = null;

// Multi-filters
let activeDivision = '';
let activeCategory = '';
let activeDateRange = 'all';
let searchKeyword = '';

// District Crime Intelligence Carousel (5s Rotation)
let districtInsights = [];
let currentInsightIndex = 0;
let insightProgressTimer = null;
let insightStartTime = 0;
const INSIGHT_DURATION = 5000;
let isInsightPaused = false;

// 2. Leaflet Map Setup (scrollWheelZoom: false prevents mouse scroll trap)
const map = L.map('map', {
  zoomControl: true,
  attributionControl: false,
  preferCanvas: true,
  minZoom: 6,
  maxZoom: 12,
  scrollWheelZoom: false, // Prevents hijacking page scroll!
  touchZoom: true
}).setView([23.75, 90.35], 7);

// 2b. Smart Mobile Touch Handling (1 finger scrolls page, 2 fingers pan map)
const mapEl = $('map');
if (mapEl) {
  const hintToast = document.createElement('div');
  hintToast.className = 'map-gesture-hint';
  hintToast.textContent = lang === 'bn' ? 'ম্যাপ সরাতে দুটি আঙুল ব্যবহার করুন' : 'Use two fingers to move map';
  mapEl.appendChild(hintToast);

  let hintTimer = null;

  mapEl.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
      map.dragging.enable();
      hintToast.classList.remove('show');
    } else {
      // 1 finger: disable map drag so browser naturally scrolls the page down!
      map.dragging.disable();
    }
  }, { passive: true });

  mapEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && !map.dragging.enabled()) {
      if (!hintTimer) {
        hintTimer = setTimeout(() => {
          hintToast.textContent = lang === 'bn' ? 'ম্যাপ সরাতে দুটি আঙুল ব্যবহার করুন' : 'Use two fingers to move map';
          hintToast.classList.add('show');
          setTimeout(() => hintToast.classList.remove('show'), 2000);
          hintTimer = null;
        }, 500);
      }
    } else if (e.touches.length > 1) {
      map.dragging.enable();
      hintToast.classList.remove('show');
    }
  }, { passive: true });

  mapEl.addEventListener('touchend', () => {
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
    // Re-enable dragging for desktop mouse pointers
    map.dragging.enable();
  }, { passive: true });
}

const districtName = f => lang === 'bn' ? (BN_DISTRICTS[f.properties.name] || f.properties.name) : f.properties.name;

// 3. API Client
async function api(url, opts = {}) {
  const headers = {
    ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.headers || {})
  };
  const res = await fetch(url, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}

// 4. Map Choropleth Painting
function paintMap() {
  if (!geoLayer) return;
  const counts = statsData?.district_counts || {};
  const isDark = document.body.classList.contains('dark');
  const outlineColor = isDark ? '#0E1B31' : '#FFFFFF';

  geoLayer.eachLayer(l => {
    const code = l.feature.properties.code;
    const n = counts[code] || 0;
    
    // Explicit 5-step color scale
    let fillColor = '#2aa579';
    if (n >= 10) fillColor = '#df5a65';
    else if (n >= 6) fillColor = '#ed9155';
    else if (n >= 3) fillColor = '#e4bc53';
    else if (n >= 1) fillColor = '#8fc76b';

    const isSelected = (code === selectedDistrictCode);

    l.setStyle({
      fillColor,
      fillOpacity: isSelected ? 0.95 : 0.85,
      color: isSelected ? '#00BFA6' : outlineColor,
      weight: isSelected ? 3 : 1.2
    });
  });
}

// 5. Select District & Slide Out Drawer (Unseen Bangladesh UX)
function selectDistrict(code, fitBounds = true) {
  selectedDistrictCode = code;
  const f = geoFeatures.find(x => x.properties.code === code);

  if (!code || !f) {
    closeDrawer();
    window.location.hash = '';
    paintMap();
    return;
  }

  // Update URL deep link hash e.g. #district=BD3026
  window.location.hash = 'district=' + encodeURIComponent(code);

  $text('drawerDistrictName', districtName(f));
  $text('drawerDistrictDivision', f.properties.division + ' Division');

  const count = statsData?.district_counts?.[code] || 0;
  $text('drawerReportCount', count);
  const total = statsData?.total || 0;
  $text('drawerNationalShare', total ? (100 * count / total).toFixed(1) + '%' : '0%');

  // Filter incidents for this district
  const districtIncidents = (statsData?.incidents || []).filter(inc => inc.district_code === code);
  renderDistrictIncidents(districtIncidents);

  // Zoom to polygon
  if (fitBounds && geoLayer) {
    const layerObj = geoLayer.getLayers().find(x => x.feature.properties.code === code);
    if (layerObj) {
      map.fitBounds(layerObj.getBounds(), { padding: [40, 40], maxZoom: 9 });
    }
  }

  paintMap();
  openDrawer();
}

function openDrawer() {
  $('districtDrawer').classList.add('open');
  if ($('drawerBackdrop') && window.innerWidth <= 900) {
    $('drawerBackdrop').classList.add('open');
  }
}

function closeDrawer() {
  $('districtDrawer').classList.remove('open');
  if ($('drawerBackdrop')) $('drawerBackdrop').classList.remove('open');
  selectedDistrictCode = '';
  paintMap();
}

$('closeDrawerBtn').onclick = closeDrawer;
if ($('drawerBackdrop')) $('drawerBackdrop').onclick = closeDrawer;

// 6. Render Incidents Feed in Drawer
function renderDistrictIncidents(list) {
  const container = $('districtIncidentsList');
  $text('drawerIncidentCountBadge', list.length);
  container.replaceChildren();

  if (!list.length) {
    const empty = document.createElement('div');
    empty.style.padding = '20px';
    empty.style.textAlign = 'center';
    empty.style.color = 'var(--muted)';
    empty.style.fontSize = '12px';
    empty.textContent = I18N[lang].noIncidentsFound;
    container.append(empty);
    return;
  }

  for (const item of list) {
    const card = document.createElement('div');
    card.className = 'incident-card';

    const top = document.createElement('div');
    top.className = 'incident-top-row';

    const catBadge = document.createElement('span');
    catBadge.className = 'badge-tag badge-' + item.type;
    catBadge.textContent = I18N[lang]['cat' + item.type.charAt(0).toUpperCase() + item.type.slice(1)] || item.type;

    const timeSpan = document.createElement('span');
    timeSpan.style.fontSize = '11px';
    timeSpan.style.color = 'var(--muted)';
    const datePrefix = item.date_is_submission_time ? (lang === 'bn' ? 'দাখিলের সময়: ' : 'Submitted: ') : '';
    timeSpan.textContent = `${datePrefix}${item.incident_date} · ${item.incident_time}`;

    top.append(catBadge, timeSpan);

    const loc = document.createElement('div');
    loc.className = 'incident-loc';
    loc.textContent = item.location;

    const narrative = document.createElement('p');
    narrative.className = 'incident-narrative';
    narrative.textContent = item.description;

    card.append(top, loc, narrative);

    // If report has an attached image (ImgBB URL or stored media)
    const imgUrl = item.image_url || item.image?.url || item.image?.display_url || (item.image?.media_id ? `/api/media/${encodeURIComponent(item.image.media_id)}` : null);
    if (imgUrl) {
      const imgBox = document.createElement('div');
      imgBox.className = 'feed-card-photo-wrap';
      const imgEl = document.createElement('img');
      imgEl.src = imgUrl;
      imgEl.alt = 'Incident Photo Evidence';
      imgEl.loading = 'lazy';
      imgEl.title = lang === 'bn' ? 'পূর্ণ আকারে ছবি দেখুন ↗' : 'Click to view full size ↗';
      imgEl.onclick = () => window.open(imgUrl, '_blank');
      imgBox.append(imgEl);
      card.append(imgBox);
    }

    // Verification Badge
    const verif = document.createElement('div');
    verif.className = 'verification-badge verif-' + (item.verification_status || 'moderated');
    let verifLabel = lang === 'bn' ? 'যাচাইকৃত' : 'Moderated';
    if (item.verification_status === 'published_news_report') verifLabel = lang === 'bn' ? 'সংবাদে প্রকাশিত' : 'Published News Report';
    else if (item.verification_status === 'independently_verified') verifLabel = lang === 'bn' ? 'নিরপেক্ষভাবে প্রমাণিত' : 'Independently Verified';
    verif.textContent = verifLabel;
    card.append(verif);

    if (item.news_source && item.news_source.url) {
      let isSafeNewsUrl = false;
      try {
        const parsed = new URL(item.news_source.url);
        isSafeNewsUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {}

      if (isSafeNewsUrl) {
        const newsBox = document.createElement('div');
        newsBox.className = 'news-attribution-box';
        const srcTitle = document.createElement('strong');
        srcTitle.textContent = 'উৎস: ';
        const srcLink = document.createElement('a');
        srcLink.href = item.news_source.url;
        srcLink.target = '_blank';
        srcLink.rel = 'noopener noreferrer';
        srcLink.textContent = (item.news_source.source_name || 'সংবাদ লিংক') + ' ↗';
        newsBox.append(srcTitle, srcLink);
        card.append(newsBox);
      }
    }

    container.append(card);
  }
}

// 6b. Dynamic District Crime Intelligence Carousel (5s Rotation)
function renderDistrictInsight(index) {
  if (!districtInsights || !districtInsights.length) {
    $text('insightDistrictName', lang === 'bn' ? 'সারাদেশ' : 'National');
    $text('insightDistrictSub', lang === 'bn' ? 'যাচাইকৃত অপরাধের কোনো রেকর্ড পাওয়া যায়নি' : 'No verified crime records available');
    $text('insightHighCrime', '—');
    $text('insightHighCount', '—');
    $text('insightHighPercent', '0%');
    $text('insightLowCrime', '—');
    $text('insightLowCount', '—');
    $text('insightLowPercent', '0%');
    $text('insightCounter', '0 / 0');
    return;
  }

  currentInsightIndex = ((index % districtInsights.length) + districtInsights.length) % districtInsights.length;
  const d = districtInsights[currentInsightIndex];

  $text('insightCounter', `${currentInsightIndex + 1} / ${districtInsights.length}`);

  const dName = lang === 'bn' ? (BN_DISTRICTS[d.name] || d.name) : d.name;
  $text('insightDistrictName', dName);

  const divText = lang === 'bn' ? (d.division + ' বিভাগ') : (d.division + ' Division');
  const totalReportsText = lang === 'bn' ? `${d.total} টি অনুমোদিত রিপোর্ট` : `${d.total} verified reports`;
  $text('insightDistrictSub', `${divText} • ${totalReportsText}`);

  // Highest Crime (কি বেশি)
  if (d.highest_crime) {
    const highTypeKey = 'cat' + d.highest_crime.type.charAt(0).toUpperCase() + d.highest_crime.type.slice(1);
    const highTypeName = I18N[lang][highTypeKey] || d.highest_crime.type;
    $text('insightHighCrime', highTypeName);
    const countUnit = lang === 'bn' ? 'টি ঘটনা' : 'incidents';
    $text('insightHighCount', `${d.highest_crime.count} ${countUnit} (${d.highest_crime.percent}%)`);
    $text('insightHighPercent', `${d.highest_crime.percent}%`);
  } else {
    $text('insightHighCrime', '—');
    $text('insightHighCount', '—');
    $text('insightHighPercent', '0%');
  }

  // Lowest Crime (কি কম) - Must be distinct from highest crime
  if (d.lowest_crime && d.lowest_crime.type && d.lowest_crime.type !== d.highest_crime?.type) {
    const lowTypeKey = 'cat' + d.lowest_crime.type.charAt(0).toUpperCase() + d.lowest_crime.type.slice(1);
    const lowTypeName = I18N[lang][lowTypeKey] || d.lowest_crime.type;
    $text('insightLowCrime', lowTypeName);
    const countUnit = lang === 'bn' ? 'টি ঘটনা' : 'incidents';
    $text('insightLowCount', `${d.lowest_crime.count} ${countUnit} (${d.lowest_crime.percent}%)`);
    $text('insightLowPercent', `${d.lowest_crime.percent}%`);
  } else {
    // When only 1 crime category is reported in this district, all other categories have 0 reports!
    $text('insightLowCrime', I18N[lang].insightNoOtherCrime || 'অন্য কোনো অপরাধের রেকর্ড নেই');
    $text('insightLowCount', I18N[lang].insightAllOtherZero || 'বাকি সব ক্যাটাগরিতে ০টি রিপোর্ট');
    $text('insightLowPercent', '০%');
  }

  // Map inspection button
  const viewMapBtn = $('insightViewMapBtn');
  if (viewMapBtn) {
    viewMapBtn.onclick = () => selectDistrict(d.code, true);
  }
}

function resetInsightProgress() {
  if (insightProgressTimer) cancelAnimationFrame(insightProgressTimer);
  insightStartTime = performance.now();
  const progressBar = $('insightProgressBar');
  if (progressBar) progressBar.style.width = '0%';

  function step(now) {
    if (!isInsightPaused) {
      const elapsed = now - insightStartTime;
      const progress = Math.min(100, (elapsed / INSIGHT_DURATION) * 100);
      if (progressBar) progressBar.style.width = progress + '%';
      if (elapsed >= INSIGHT_DURATION) {
        nextInsight();
        return;
      }
    } else {
      const currentPct = parseFloat(progressBar?.style.width || '0');
      insightStartTime = now - ((currentPct / 100) * INSIGHT_DURATION);
    }
    insightProgressTimer = requestAnimationFrame(step);
  }
  insightProgressTimer = requestAnimationFrame(step);
}

function startInsightRotation() {
  if (!districtInsights || !districtInsights.length) return;
  renderDistrictInsight(currentInsightIndex);
  resetInsightProgress();
}

function nextInsight() {
  if (!districtInsights || !districtInsights.length) return;
  const wrap = $('insightContentWrap');
  if (wrap) wrap.classList.add('fade-out');
  setTimeout(() => {
    renderDistrictInsight(currentInsightIndex + 1);
    if (wrap) wrap.classList.remove('fade-out');
    resetInsightProgress();
  }, 180);
}

function prevInsight() {
  if (!districtInsights || !districtInsights.length) return;
  const wrap = $('insightContentWrap');
  if (wrap) wrap.classList.add('fade-out');
  setTimeout(() => {
    renderDistrictInsight(currentInsightIndex - 1);
    if (wrap) wrap.classList.remove('fade-out');
    resetInsightProgress();
  }, 180);
}

function setupInsightListeners() {
  const nextBtn = $('insightNextBtn');
  if (nextBtn) nextBtn.onclick = () => nextInsight();

  const prevBtn = $('insightPrevBtn');
  if (prevBtn) prevBtn.onclick = () => prevInsight();

  const card = $('crimeInsightCard');
  if (card) {
    card.addEventListener('mouseenter', () => { isInsightPaused = true; });
    card.addEventListener('mouseleave', () => { isInsightPaused = false; });
    card.addEventListener('touchstart', () => { isInsightPaused = true; }, { passive: true });
    card.addEventListener('touchend', () => { isInsightPaused = false; }, { passive: true });
  }
}

// 7. Refresh Stats & Visualizations
async function refreshStats() {
  try {
    let url = `/api/stats?date_range=${activeDateRange}`;
    if (activeCategory) url += `&type=${encodeURIComponent(activeCategory)}`;

    const data = await api(url);
    statsData = data;

    $text('totalReports', (data.total || 0).toLocaleString());
    $text('drugReportsCount', (data.drug_related_total || 0).toLocaleString());
    if (data.last_updated) {
      $text('lastDataUpdate', data.last_updated);
    }

    // Initialize/Update District Crime Insights
    districtInsights = data.district_insights || [];
    startInsightRotation();

    paintMap();
    drawCharts(data);

    // Deep link check from URL hash on first load
    handleDeepLinkHash();
  } catch (err) {
    console.error('Stats fetch error:', err);
  }
}

function drawCharts(data) {
  const ink = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#64748B';
  const isDark = document.body.classList.contains('dark');

  // 1. Category Bar Chart
  if (typeChart) typeChart.destroy();
  const catLabels = CATEGORIES.map(c => I18N[lang]['cat' + c.charAt(0).toUpperCase() + c.slice(1)] || c);
  const catCounts = CATEGORIES.map(c => data.types[c] || 0);

  typeChart = new Chart($('typeChart'), {
    type: 'bar',
    data: {
      labels: catLabels,
      datasets: [{
        data: catCounts,
        backgroundColor: '#00BFA6',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: ink, font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, color: ink }, grid: { color: isDark ? '#1E2E4A' : '#E5EAF0' } }
      }
    }
  });

  // 2. Monthly Line Chart
  if (monthChart) monthChart.destroy();
  const mLabels = (data.months || []).map(m => m.month.slice(5));
  const mCounts = (data.months || []).map(m => m.count);

  monthChart = new Chart($('monthChart'), {
    type: 'line',
    data: {
      labels: mLabels,
      datasets: [{
        data: mCounts,
        borderColor: '#00BFA6',
        backgroundColor: 'rgba(0, 191, 166, 0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: ink, font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, color: ink }, grid: { color: isDark ? '#1E2E4A' : '#E5EAF0' } }
      }
    }
  });
}

// 8. Multi-Filter & Search Handling
function applyMapFilters() {
  if (!geoLayer) return;
  const kw = searchKeyword.toLowerCase();

  geoLayer.eachLayer(l => {
    const f = l.feature;
    const nameEn = f.properties.name.toLowerCase();
    const nameBn = (BN_DISTRICTS[f.properties.name] || '').toLowerCase();

    const matchesSearch = (!kw || nameEn.includes(kw) || nameBn.includes(kw));
    const matchesDivision = (!activeDivision || f.properties.division === activeDivision);

    const isVisible = matchesSearch && matchesDivision;
    l.setStyle({ fillOpacity: isVisible ? 0.85 : 0.12 });
  });
}

$('districtSearch').oninput = e => {
  searchKeyword = e.target.value.trim();
  applyMapFilters();
};

$('categoryFilter').onchange = e => {
  activeCategory = e.target.value;
  refreshStats();
};

$('dateRangeFilter').onchange = e => {
  activeDateRange = e.target.value;
  refreshStats();
};

// Division Selector Pills
document.querySelectorAll('#divisionPills button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#divisionPills button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeDivision = btn.dataset.div || '';
    applyMapFilters();
  };
});

$('resetMapBtn').onclick = () => {
  searchKeyword = '';
  $('districtSearch').value = '';
  activeDivision = '';
  document.querySelectorAll('#divisionPills button').forEach(b => b.classList.toggle('active', !b.dataset.div));
  activeCategory = '';
  $('categoryFilter').value = '';
  activeDateRange = 'all';
  $('dateRangeFilter').value = 'all';
  closeDrawer();
  if (geoLayer) map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
  applyMapFilters();
  refreshStats();
};

// 9. Deep Linking (#district=BD3026)
function handleDeepLinkHash() {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('district=')) {
    const code = decodeURIComponent(hash.split('=')[1] || '').toUpperCase();
    if (code && code !== selectedDistrictCode) {
      selectDistrict(code, true);
    }
  }
}
window.addEventListener('hashchange', handleDeepLinkHash);

// Share Drawer Link
$('drawerShareBtn').onclick = () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    alert(lang === 'bn' ? 'জেলা লিংক কপি হয়েছে!' : 'District link copied to clipboard!');
  }).catch(() => {
    prompt(lang === 'bn' ? 'লিংকটি কপি করুন:' : 'Copy this link:', url);
  });
};

// 10. Minimal Facebook-Style Report Composer Logic
let isAnonymous = false;
let selectedImageBase64 = null;
let selectedImageFile = null;

function resetComposer() {
  const form = $('composerReportForm');
  if (form) form.reset();

  isAnonymous = false;
  const anonBtn = $('anonymousToggleBtn');
  if (anonBtn) {
    anonBtn.classList.remove('active');
    anonBtn.setAttribute('aria-checked', 'false');
  }
  const anonLabel = $('anonToggleLabel');
  if (anonLabel) anonLabel.textContent = I18N[lang].composerAnon || 'গোপন রাখুন';

  const nameInput = $('composerReporterName');
  if (nameInput) {
    nameInput.disabled = false;
    nameInput.value = '';
    nameInput.placeholder = I18N[lang].composerNamePlaceholder || 'আপনার নাম (ঐচ্ছিক)';
  }

  const descEl = $('composerDesc');
  if (descEl) {
    descEl.value = '';
    descEl.style.height = '90px';
  }
  updateComposerCharCount();

  selectedImageBase64 = null;
  selectedImageFile = null;
  if ($('composerImageInput')) $('composerImageInput').value = '';
  if ($('composerImagePreview')) {
    $('composerImagePreview').hidden = true;
    $('composerImagePreview').style.display = 'none';
  }
  if ($('composerImgTag')) $('composerImgTag').src = '';

  const errBox = $('composerErrorMessage');
  if (errBox) {
    errBox.textContent = '';
    errBox.hidden = true;
    errBox.style.display = 'none';
  }

  const submitBtn = $('composerSubmitBtn');
  if (submitBtn) submitBtn.disabled = false;
  if ($('composerSpinner')) {
    $('composerSpinner').hidden = true;
    $('composerSpinner').style.display = 'none';
  }
  if ($('composerSubmitText')) $('composerSubmitText').textContent = I18N[lang].composerSubmit || 'রিপোর্ট জমা দিন';

  if ($('composerFormWrap')) $('composerFormWrap').hidden = false;
  if ($('composerSuccessWrap')) $('composerSuccessWrap').hidden = true;
}

function updateComposerCharCount() {
  const descEl = $('composerDesc');
  const countEl = $('composerCharCount');
  if (!descEl || !countEl) return;
  const count = descEl.value.length;
  if (lang === 'bn') {
    const bnNums = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    const bnCount = String(count).split('').map(d => bnNums[d] || d).join('');
    countEl.textContent = `${bnCount} / ২,০০০`;
  } else {
    countEl.textContent = `${count} / 2,000`;
  }
}

// Anonymous Toggle
if ($('anonymousToggleBtn')) {
  $('anonymousToggleBtn').onclick = () => {
    isAnonymous = !isAnonymous;
    const btn = $('anonymousToggleBtn');
    const nameInput = $('composerReporterName');
    const label = $('anonToggleLabel');

    btn.classList.toggle('active', isAnonymous);
    btn.setAttribute('aria-checked', String(isAnonymous));

    if (isAnonymous) {
      nameInput.value = '';
      nameInput.disabled = true;
      nameInput.placeholder = I18N[lang].composerAnonActive || 'বেনামী রিপোর্টার';
      if (label) label.textContent = I18N[lang].composerAnonActive || 'গোপন রাখা হয়েছে';
    } else {
      nameInput.disabled = false;
      nameInput.placeholder = I18N[lang].composerNamePlaceholder || 'আপনার নাম (ঐচ্ছিক)';
      if (label) label.textContent = I18N[lang].composerAnon || 'গোপন রাখুন';
    }
  };
}

// Auto-expanding textarea & character counter
if ($('composerDesc')) {
  $('composerDesc').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.max(90, this.scrollHeight) + 'px';
    updateComposerCharCount();
  });
}

// Single Image Selection, Validation, and Immediate Thumbnail Preview
if ($('composerImageInput')) {
  $('composerImageInput').onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

    if (!allowedTypes.includes(file.type) && !allowedExts.includes(extension)) {
      alert(I18N[lang].errImageType || 'শুধুমাত্র JPG, JPEG, PNG অথবা WebP ছবি গ্রহণযোগ্য।');
      $('composerImageInput').value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(I18N[lang].errImageSize || 'ছবি ফাইলের আকার সর্বোচ্চ ৫ মেগাবাইট হতে পারবে।');
      $('composerImageInput').value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      selectedImageBase64 = loadEvt.target.result;
      selectedImageFile = file;

      if ($('composerImgTag')) $('composerImgTag').src = selectedImageBase64;
      if ($('composerImgName')) $('composerImgName').textContent = file.name;
      if ($('composerImgSize')) {
        const sizeKb = (file.size / 1024).toFixed(1);
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        $('composerImgSize').textContent = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;
      }
      if ($('composerImagePreview')) {
        $('composerImagePreview').hidden = false;
        $('composerImagePreview').style.display = 'block';
      }
    };
    reader.onerror = () => {
      alert('Error reading selected image file.');
      $('composerImageInput').value = '';
    };
    reader.readAsDataURL(file);
  };
}

// Remove Image Preview
if ($('composerRemoveImgBtn')) {
  $('composerRemoveImgBtn').onclick = () => {
    selectedImageBase64 = null;
    selectedImageFile = null;
    if ($('composerImageInput')) $('composerImageInput').value = '';
    if ($('composerImagePreview')) {
      $('composerImagePreview').hidden = true;
      $('composerImagePreview').style.display = 'none';
    }
    if ($('composerImgTag')) $('composerImgTag').src = '';
  };
}

// Form Submission with Loading & Duplicate Click Prevention
if ($('composerReportForm')) {
  $('composerReportForm').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = $('composerSubmitBtn');
    const spinner = $('composerSpinner');
    const submitText = $('composerSubmitText');
    const errBox = $('composerErrorMessage');

    errBox.textContent = '';
    errBox.hidden = true;

    const districtCode = $('composerDistrict') ? $('composerDistrict').value : '';
    const crimeType = $('composerType') ? $('composerType').value : '';
    const description = $('composerDesc') ? $('composerDesc').value.trim() : '';

    if (!districtCode) {
      errBox.textContent = I18N[lang].errDistrict || 'অনুগ্রহ করে জেলা নির্বাচন করুন।';
      errBox.hidden = false;
      errBox.style.display = 'block';
      if ($('composerDistrict')) $('composerDistrict').focus();
      return;
    }

    if (!crimeType) {
      errBox.textContent = I18N[lang].errCategory || 'অনুগ্রহ করে অপরাধের ধরন নির্বাচন করুন।';
      errBox.hidden = false;
      errBox.style.display = 'block';
      if ($('composerType')) $('composerType').focus();
      return;
    }

    if (!description || description.length < 15 || description.length > 2000) {
      errBox.textContent = I18N[lang].errDesc || 'ঘটনার বিবরণ কমপক্ষে ১৫ অক্ষরের হতে হবে (সর্বোচ্চ ২,০০০ অক্ষর)।';
      errBox.hidden = false;
      errBox.style.display = 'block';
      if ($('composerDesc')) $('composerDesc').focus();
      return;
    }

    // Disable button to prevent duplicate submissions & show spinner
    submitBtn.disabled = true;
    if (spinner) {
      spinner.hidden = false;
      spinner.style.display = 'inline-block';
    }
    if (submitText) submitText.textContent = I18N[lang].composerSubmitting || 'রিপোর্ট জমা হচ্ছে...';

    const payload = {
      district_code: districtCode,
      type: crimeType,
      description: description,
      is_anonymous: isAnonymous,
      reporter_name: isAnonymous ? 'Anonymous' : ($('composerReporterName').value.trim() || undefined),
      image_data: selectedImageBase64 || undefined,
      image_name: selectedImageFile ? selectedImageFile.name : undefined
    };

    try {
      const res = await api('/api/reports', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Show minimal success state
      if ($('composerTrackingId')) $('composerTrackingId').textContent = res.tracking_code;
      if ($('composerSuccessTimestamp')) {
        const timeStr = res.submission_time_dhaka || new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
        $('composerSuccessTimestamp').textContent = (lang === 'bn' ? 'দাখিলের সময় (ঢাকা): ' : 'Submission Time (Dhaka): ') + timeStr;
      }

      if ($('composerFormWrap')) $('composerFormWrap').hidden = true;
      if ($('composerSuccessWrap')) $('composerSuccessWrap').hidden = false;
      resetComposer();
    } catch (err) {
      errBox.textContent = err.message || 'Submission error. Please try again.';
      errBox.hidden = false;
      errBox.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      if (spinner) {
        spinner.hidden = true;
        spinner.style.display = 'none';
      }
      if (submitText) submitText.textContent = I18N[lang].composerSubmit || 'রিপোর্ট জমা দিন';
    }
  };
}

// Copy Tracking Code Button
if ($('composerCopyBtn')) {
  $('composerCopyBtn').onclick = () => {
    const codeEl = $('composerTrackingId');
    if (!codeEl) return;
    const code = codeEl.textContent.trim();
    navigator.clipboard.writeText(code).then(() => {
      const copyBtnText = $('composerCopyBtnText');
      if (copyBtnText) copyBtnText.textContent = I18N[lang].composerCopied || 'কপি হয়েছে!';
      setTimeout(() => {
        if (copyBtnText) copyBtnText.textContent = I18N[lang].composerCopy || 'কপি করুন';
      }, 2500);
    }).catch(() => {
      prompt(lang === 'bn' ? 'ট্র্যাকিং কোডটি কপি করুন:' : 'Copy this tracking code:', code);
    });
  };
}

// 11. Report Status Tracking Modal
$('trackForm').onsubmit = async (e) => {
  e.preventDefault();
  const code = $('trackInputCode').value.trim();
  const box = $('trackResultBox');
  box.hidden = false;
  box.innerHTML = `<span style="color:var(--muted)">${lang === 'bn' ? 'অনুসন্ধান চলছে...' : 'Searching...'}</span>`;

  try {
    const res = await api('/api/reports/track/' + encodeURIComponent(code));
    let statusColor = '#ed9155';
    let statusText = lang === 'bn' ? 'পর্যালোচনাধীন (Pending Moderation)' : 'Pending Moderation';
    if (res.status === 'approved') {
      statusColor = '#2aa579';
      statusText = lang === 'bn' ? 'অনুমোদিত ও প্রকাশিত (Approved & Published)' : 'Approved & Published';
    } else if (res.status === 'rejected') {
      statusColor = '#df5a65';
      statusText = lang === 'bn' ? 'বাতিলকৃত / অপ্রমাণিত (Rejected)' : 'Rejected / Unverified';
    }

    const dObj = geoFeatures.find(f => f.properties.code === res.district_code);
    const dNameStr = dObj ? districtName(dObj) : res.district_code;
    const catTypeKey = 'cat' + res.type.charAt(0).toUpperCase() + res.type.slice(1);
    const catTypeLabel = I18N[lang][catTypeKey] || res.type;

    box.innerHTML = `
      <div style="background:var(--sub);border:1px solid var(--line);border-radius:12px;padding:14px;font-size:13px;line-height:1.7">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong>${lang === 'bn' ? 'রেফারেন্স কোড:' : 'Reference:'} ${res.tracking_code}</strong>
          <span style="font-size:11px;padding:3px 8px;border-radius:6px;background:${statusColor}22;color:${statusColor};font-weight:700">${statusText}</span>
        </div>
        <div><strong>${lang === 'bn' ? 'জেলা:' : 'District:'}</strong> ${dNameStr}</div>
        <div><strong>${lang === 'bn' ? 'অপরাধের ধরন:' : 'Crime Type:'}</strong> ${catTypeLabel}</div>
        <div><strong>${lang === 'bn' ? 'জমা দেওয়ার তারিখ:' : 'Submission Date:'}</strong> ${new Date(res.submitted_at).toLocaleDateString()}</div>
        ${res.reviewed_at ? `<div><strong>${lang === 'bn' ? 'পর্যালোচনার তারিখ:' : 'Review Date:'}</strong> ${new Date(res.reviewed_at).toLocaleDateString()}</div>` : ''}
      </div>
    `;
  } catch (err) {
    const errBox = document.createElement('div');
    errBox.style.cssText = 'color:var(--red);font-size:13px;padding:10px;background:var(--red-subtle);border-radius:8px';
    errBox.textContent = err.message;
    box.replaceChildren(errBox);
  }
};

// 12. District Comparison Modal Logic
async function populateCompareSelects() {
  const sorted = [...geoFeatures].sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  const optionsHtml = sorted.map(f => `<option value="${f.properties.code}">${districtName(f)} (${f.properties.division})</option>`).join('');
  $('compareSelect1').innerHTML = optionsHtml;
  $('compareSelect2').innerHTML = optionsHtml;
  if (sorted.length > 1) {
    $('compareSelect2').selectedIndex = 1;
  }
}

$('runCompareBtn').onclick = async () => {
  const d1 = $('compareSelect1').value;
  const d2 = $('compareSelect2').value;
  const container = $('compareResultContainer');
  container.innerHTML = `<span style="color:var(--muted)">${lang === 'bn' ? 'তুলনা লোড হচ্ছে...' : 'Loading comparison...'}</span>`;

  try {
    const res = await api(`/api/districts/compare?d1=${encodeURIComponent(d1)}&d2=${encodeURIComponent(d2)}`);
    const d1Name = lang === 'bn' ? (BN_DISTRICTS[res.district1.name] || res.district1.name) : res.district1.name;
    const d2Name = lang === 'bn' ? (BN_DISTRICTS[res.district2.name] || res.district2.name) : res.district2.name;
    const d1Div = lang === 'bn' ? (res.district1.division + ' বিভাগ') : (res.district1.division + ' Division');
    const d2Div = lang === 'bn' ? (res.district2.division + ' বিভাগ') : (res.district2.division + ' Division');
    const reportsUnit = lang === 'bn' ? 'মোট রিপোর্ট' : 'total reports';

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div style="background:var(--sub);border:1px solid var(--line);border-radius:10px;padding:12px">
          <h4 style="margin:0 0 6px;font-size:16px">${d1Name} (${d1Div})</h4>
          <div style="font-size:22px;font-weight:800;color:var(--teal)">${res.district1.total_reports} <small style="font-size:11px;font-weight:500;color:var(--muted)">${reportsUnit}</small></div>
        </div>
        <div style="background:var(--sub);border:1px solid var(--line);border-radius:10px;padding:12px">
          <h4 style="margin:0 0 6px;font-size:16px">${d2Name} (${d2Div})</h4>
          <div style="font-size:22px;font-weight:800;color:var(--teal)">${res.district2.total_reports} <small style="font-size:11px;font-weight:500;color:var(--muted)">${reportsUnit}</small></div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);background:var(--panel);border:1px solid var(--line);padding:8px 12px;border-radius:8px">
        ${res.caveat}
      </div>
    `;
  } catch (err) {
    const errBox = document.createElement('div');
    errBox.style.color = 'var(--red)';
    errBox.textContent = err.message;
    container.replaceChildren(errBox);
  }
};

// 13. Modal Open/Close Controls
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

document.querySelectorAll('[data-close]').forEach(b => {
  b.onclick = () => closeModal(b.dataset.close);
});
document.querySelectorAll('.modal-backdrop').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop').forEach(m => closeModal(m.id));
});

// Triggers
$('openReportBtn').onclick = () => { resetComposer(); openModal('reportModal'); };
$('mOpenReportBtn').onclick = () => { $('mobileNavDrawer').classList.remove('open'); resetComposer(); openModal('reportModal'); };
if ($('heroReportBtn')) $('heroReportBtn').onclick = () => { resetComposer(); openModal('reportModal'); };
$('drawerSubmitBtn').onclick = () => {
  resetComposer();
  if (selectedDistrictCode && $('composerDistrict')) $('composerDistrict').value = selectedDistrictCode;
  openModal('reportModal');
};

$('navTrackBtn').onclick = e => { e.preventDefault(); openModal('trackModal'); };
$('mNavTrack').onclick = e => { e.preventDefault(); $('mobileNavDrawer').classList.remove('open'); openModal('trackModal'); };

$('navCompareBtn').onclick = e => { e.preventDefault(); populateCompareSelects(); openModal('compareModal'); };
$('mNavCompare').onclick = e => { e.preventDefault(); $('mobileNavDrawer').classList.remove('open'); populateCompareSelects(); openModal('compareModal'); };

$('navSafetyBtn').onclick = e => { e.preventDefault(); openModal('safetyModal'); };
$('mNavSafety').onclick = e => { e.preventDefault(); $('mobileNavDrawer').classList.remove('open'); openModal('safetyModal'); };
$('fSafetyBtn').onclick = e => { e.preventDefault(); openModal('safetyModal'); };

$('navHowBtn').onclick = e => { e.preventDefault(); openModal('methodologyModal'); };
$('mNavHow').onclick = e => { e.preventDefault(); $('mobileNavDrawer').classList.remove('open'); openModal('methodologyModal'); };
$('fHowBtn').onclick = e => { e.preventDefault(); openModal('methodologyModal'); };
$('fMethodBtn').onclick = e => { e.preventDefault(); openModal('methodologyModal'); };
if ($('devProfileBtn')) $('devProfileBtn').onclick = () => openModal('devProfileModal');

$('mobileMenuBtn').onclick = () => {
  $('mobileNavDrawer').classList.toggle('open');
};

document.querySelectorAll('#mobileNavDrawer a').forEach(link => {
  link.addEventListener('click', () => {
    $('mobileNavDrawer').classList.remove('open');
  });
});

if ($('mapResetBtn')) {
  $('mapResetBtn').onclick = () => {
    selectedDistrictCode = '';
    closeDrawer();
    if (geoLayer) map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
    paintMap();
  };
}

// 14. Theme & Language Toggles
function updateThemeIcon() {
  const isDark = document.body.classList.contains('dark');
  const btn = $('themeBtn');
  if (!btn) return;
  if (isDark) {
    btn.innerHTML = `<svg class="ui-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  } else {
    btn.innerHTML = `<svg class="ui-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
}

$('themeBtn').onclick = () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  updateThemeIcon();
  localStorage.setItem('watchdog_theme', isDark ? 'dark' : 'light');
  paintMap();
  if (statsData) drawCharts(statsData);
};

if (localStorage.getItem('watchdog_theme') === 'dark') {
  document.body.classList.add('dark');
}
updateThemeIcon();

$('langBtn').onclick = () => {
  lang = lang === 'bn' ? 'en' : 'bn';
  localStorage.setItem('watchdog_lang', lang);
  renderLanguage();
};

function renderLanguage() {
  document.documentElement.lang = lang;
  if ($('langText')) $('langText').textContent = lang === 'bn' ? 'EN' : 'বাং';
  else $text('langBtn', lang === 'bn' ? 'EN' : 'বাং');

  document.querySelectorAll('[data-i]').forEach(el => {
    const key = el.dataset.i;
    if (I18N[lang][key]) el.textContent = I18N[lang][key];
  });
  document.querySelectorAll('[data-placeholder]').forEach(el => {
    const key = el.dataset.placeholder;
    if (I18N[lang][key]) el.placeholder = I18N[lang][key];
  });

  // Populate form selects in active language
  if (geoFeatures.length) {
    const sorted = [...geoFeatures].sort((a, b) => a.properties.name.localeCompare(b.properties.name));
    if ($('formDistrict')) $('formDistrict').innerHTML = sorted.map(f => `<option value="${f.properties.code}">${districtName(f)}</option>`).join('');
    if ($('composerDistrict')) {
      const currentVal = $('composerDistrict').value;
      const placeholder = I18N[lang].selectDistrict || (lang === 'bn' ? 'জেলা নির্বাচন করুন' : 'Select District');
      $('composerDistrict').innerHTML = `<option value="" disabled selected>${placeholder}</option>` + sorted.map(f => `<option value="${f.properties.code}">${districtName(f)}</option>`).join('');
      if (currentVal) $('composerDistrict').value = currentVal;
    }
  }

  if ($('formType')) $('formType').innerHTML = CATEGORIES.map(c => `<option value="${c}">${I18N[lang]['cat' + c.charAt(0).toUpperCase() + c.slice(1)] || c}</option>`).join('');
  if ($('composerType')) {
    const currentVal = $('composerType').value;
    const placeholder = I18N[lang].selectType || (lang === 'bn' ? 'অপরাধের ধরন নির্বাচন' : 'Select Category');
    $('composerType').innerHTML = `<option value="" disabled selected>${placeholder}</option>` + CATEGORIES.map(c => `<option value="${c}">${I18N[lang]['cat' + c.charAt(0).toUpperCase() + c.slice(1)] || c}</option>`).join('');
    if (currentVal) $('composerType').value = currentVal;
  }

  if (geoLayer) {
    geoLayer.eachLayer(l => l.setTooltipContent(districtName(l.feature)));
  }

  if (selectedDistrictCode) {
    selectDistrict(selectedDistrictCode, false);
  }

  // Update Crime Insight Card translations
  $text('insightHeaderTitle', I18N[lang].insightHeaderTitle || 'লাইভ জেলা অপরাধ বিশ্লেষণ');
  $text('insightViewMapText', I18N[lang].insightViewMap || 'ম্যাপে এই জেলা দেখুন');
  $text('insightHighLabel', I18N[lang].insightHighLabel || 'সবচেয়ে বেশি সংঘটিত অপরাধ');
  $text('insightLowLabel', I18N[lang].insightLowLabel || 'তুলনামূলক কম সংঘটিত অপরাধ');
  renderDistrictInsight(currentInsightIndex);
}

// 15. Privacy-Preserving Visit Recording
async function recordPageHit() {
  try {
    if (!sessionStorage.getItem('watchdog_visited')) {
      sessionStorage.setItem('watchdog_visited', '1');
      await api('/api/analytics/visit', { method: 'POST' });
    }
  } catch {}
}

// 16. App Bootstrap
async function init() {
  try {
    if ($('formDate')) {
      $('formDate').max = new Date().toISOString().slice(0, 10);
      $('formDate').value = new Date().toISOString().slice(0, 10);
    }

    setupInsightListeners();

    const geoData = await api('/districts.geojson');
    geoFeatures = geoData.features;
    if (geoFeatures.length !== 64) {
      throw new Error(`Expected 64 districts in GeoJSON, found ${geoFeatures.length}`);
    }

    // Build vector layer
    geoLayer = L.geoJSON(geoData, {
      style: {
        color: '#FFFFFF',
        weight: 1.2,
        fillOpacity: 0.85
      },
      onEachFeature: (f, l) => {
        l.bindTooltip(() => districtName(f), { sticky: true });
        l.on('click', () => selectDistrict(f.properties.code));
        l.on('mouseover', () => {
          if (f.properties.code !== selectedDistrictCode) {
            l.setStyle({ weight: 2.2, color: '#00BFA6' });
          }
        });
        l.on('mouseout', paintMap);
      }
    }).addTo(map);

    map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
    $text('districtTotal', geoFeatures.length);
    if ($('mapStatusText')) $('mapStatusText').textContent = I18N[lang].mapReady;
    else $text('mapStatusIndicator', I18N[lang].mapReady);

    renderLanguage();
    resetComposer();
    await recordPageHit();
    await refreshStats();
  } catch (err) {
    console.error('App init error:', err);
    if ($('mapStatusText')) $('mapStatusText').textContent = 'Error: ' + err.message;
    else $text('mapStatusIndicator', 'Error: ' + err.message);
  }
}

init();
