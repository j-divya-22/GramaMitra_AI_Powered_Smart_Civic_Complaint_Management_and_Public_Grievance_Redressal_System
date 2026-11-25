export const SPEECH_LOCALES = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  ur: 'ur-IN',
  or: 'or-IN',
};

const LANGUAGE_ALIASES = {
  en: ['english', 'इंग्लिश', 'ஆங்கிலம்', 'ఆంగ్లం', 'ಇಂಗ್ಲಿಷ್', 'ইংরেজি', 'મને અંગ્રેજી', 'ഇംഗ്ലീഷ്', 'इंग्रजी', 'ਅੰਗਰੇਜ਼ੀ', 'انگریزی', 'ଇଂରାଜୀ'],
  hi: ['hindi', 'हिंदी', 'हिन्दी'],
  kn: ['kannada', 'ಕನ್ನಡ'],
  ta: ['tamil', 'தமிழ்', 'தமிழ் மொழி'],
  te: ['telugu', 'తెలుగు'],
  ml: ['malayalam', 'മലയാളം'],
  mr: ['marathi', 'मराठी'],
  bn: ['bengali', 'bangla', 'বাংলা', 'বাঙালি'],
  gu: ['gujarati', 'ગુજરાતી'],
  pa: ['punjabi', 'ਪੰਜਾਬੀ'],
  ur: ['urdu', 'اردو'],
  or: ['odia', 'oriya', 'ଓଡ଼ିଆ'],
};

const GUIDE_COPY = {
  en: {
    choose: 'Namaste! I am Gramamitra. Which language would you like me to use? Say a language name, or choose it on screen.',
    selected: 'Great. I will guide you in this language. Let us start your community report.',
    steps: [
      'Tell me what kind of civic issue you want to report. You can choose a damaged footpath, a damaged or missing road sign, loose or open electric wires, damaged public infrastructure, no civic issue, an open manhole or borewell, road damage, roadside garbage, a faulty streetlight, overgrown vegetation, waterlogging, or Other.',
      'Describe what happened and where you noticed it. You can add photos on screen. When you are ready, say continue or tap Continue.',
      'Choose the issue location on the map, or say use my GPS. You can also say an address, then say confirm location. I will only request GPS after you ask for it.',
      'Please review your report on screen. Say confirm and submit only when you are ready to send it.',
    ],
    categories: {
      damaged_footpath: ['damaged footpath', 'broken footpath', 'damaged sidewalk'],
      damaged_road_sign: ['damaged road sign', 'missing road sign', 'broken road sign'],
      electrical_hazard: ['electrical hazard', 'open electric wires', 'loose electric wires'],
      infrastructure: ['damaged public infrastructure', 'infrastructure', 'public infrastructure'],
      normal: ['no civic issue', 'normal', 'no issue', 'no problem'],
      open_manhole_borewell: ['open manhole', 'open borewell', 'deep hole'],
      road_damage: ['road damage', 'damaged road', 'pothole', 'holes on road'],
      roadside_garbage: ['roadside garbage', 'garbage on roadside', 'public place garbage'],
      streetlight_faults: ['streetlight not working', 'streetlight faults', 'street light fault', 'streetlight', 'street light'],
      vegetation: ['overgrown trees', 'overgrown plants', 'overgrown vegetation', 'bushes'],
      waterlogging: ['waterlogging', 'water logging', 'flooding', 'flooded road', 'standing water'],
      other: ['other', 'अन्य', 'ಇತರೆ', 'மற்றவை', 'ఇతర', 'മറ്റുള്ളവ', 'इतर', 'অন্যান্য', 'અન્ય', 'ਹੋਰ', 'دیگر', 'ଅନ୍ୟ'],
    },
    gps: ['use my gps', 'use gps', 'use my location'],
    confirmLocation: ['confirm location', 'confirm address', 'location is correct', 'yes confirm'],
    continue: ['continue', 'next', 'go ahead'],
    confirmSubmit: ['confirm and submit', 'confirm submit', 'submit report', 'send my report', 'submit complaint'],
  },
  hi: {
    choose: 'नमस्ते! मैं ग्राममित्र हूँ। आप किस भाषा में बात करना चाहेंगे? भाषा का नाम बोलें या स्क्रीन पर चुनें।',
    selected: 'बहुत अच्छा। अब मैं इसी भाषा में आपकी मदद करूँगा। आइए, आपकी समस्या की रिपोर्ट शुरू करें।',
    steps: [
      'आप किस नागरिक समस्या की रिपोर्ट करना चाहते हैं? समस्या बताइए या स्क्रीन पर श्रेणी चुनें।',
      'क्या हुआ और कहाँ हुआ, अपने शब्दों में बताइए। आप स्क्रीन पर फोटो भी जोड़ सकते हैं। आगे बढ़ने के लिए आगे बोलें या बटन दबाएँ।',
      'मानचित्र पर स्थान चुनें या मेरा GPS उपयोग करें बोलें। पता बोलने के बाद स्थान की पुष्टि बोलें। GPS आपकी अनुमति के बाद ही लिया जाएगा।',
      'अपनी रिपोर्ट स्क्रीन पर जाँचें। भेजने के लिए तैयार हों तभी पुष्टि करके जमा करें बोलें।',
    ],
    categories: {},
    gps: ['जीपीएस उपयोग करें', 'मेरा जीपीएस इस्तेमाल करें', 'जीपीएस इस्तेमाल करें'],
    confirmLocation: ['स्थान की पुष्टि', 'पता सही है', 'हाँ पुष्टि'],
    continue: ['आगे', 'आगे बढ़ें', 'जारी रखें'],
    confirmSubmit: ['पुष्टि करके जमा करें', 'जमा करें', 'रिपोर्ट भेजें', 'शिकायत जमा करें'],
  },
  kn: {
    choose: 'ನಮಸ್ಕಾರ! ನಾನು ಗ್ರಾಮಮಿತ್ರ. ನೀವು ಯಾವ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಲು ಬಯಸುತ್ತೀರಿ? ಭಾಷೆಯ ಹೆಸರನ್ನು ಹೇಳಿ ಅಥವಾ ಪರದೆಯಲ್ಲಿ ಆಯ್ಕೆಮಾಡಿ.',
    selected: 'ಸರಿ. ಈಗ ನಾನು ಈ ಭಾಷೆಯಲ್ಲಿ ನಿಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತೇನೆ. ನಿಮ್ಮ ವರದಿಯನ್ನು ಪ್ರಾರಂಭಿಸೋಣ.',
    steps: [
      'ಯಾವ ನಾಗರಿಕ ಸಮಸ್ಯೆಯನ್ನು ವರದಿ ಮಾಡಬೇಕು? ಸಮಸ್ಯೆಯನ್ನು ವಿವರಿಸಿ ಅಥವಾ ಪರದೆಯಲ್ಲಿ ವರ್ಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
      'ಏನಾಯಿತು ಮತ್ತು ಎಲ್ಲಿ ಕಂಡಿತು ಎಂದು ನಿಮ್ಮ ಮಾತಿನಲ್ಲಿ ವಿವರಿಸಿ. ಪರದೆಯಲ್ಲಿ ಫೋಟೋಗಳನ್ನು ಸೇರಿಸಬಹುದು. ಮುಂದುವರಿಸಲು ಮುಂದುವರಿಸಿ ಎಂದು ಹೇಳಿ ಅಥವಾ ಬಟನ್ ಒತ್ತಿ.',
      'ನಕ್ಷೆಯಲ್ಲಿ ಸ್ಥಳವನ್ನು ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ನನ್ನ GPS ಬಳಸಿ ಎಂದು ಹೇಳಿ. ವಿಳಾಸವನ್ನು ಹೇಳಿದ ನಂತರ ಸ್ಥಳ ದೃಢೀಕರಿಸಿ ಎಂದು ಹೇಳಿ. ನಿಮ್ಮ ಅನುಮತಿಯ ನಂತರ ಮಾತ್ರ GPS ಸ್ಥಳ ಪಡೆಯಲಾಗುತ್ತದೆ.',
      'ನಿಮ್ಮ ವರದಿಯನ್ನು ಪರದೆಯಲ್ಲಿ ಪರಿಶೀಲಿಸಿ. ಸಿದ್ಧವಾದಾಗ ಮಾತ್ರ ದೃಢೀಕರಿಸಿ ಸಲ್ಲಿಸಿ ಎಂದು ಹೇಳಿ.',
    ],
    categories: {},
    gps: ['ಜಿಪಿಎಸ್ ಬಳಸಿ', 'ನನ್ನ ಜಿಪಿಎಸ್ ಬಳಸಿ'],
    confirmLocation: ['ಸ್ಥಳ ದೃಢೀಕರಿಸಿ', 'ವಿಳಾಸ ಸರಿಯಾಗಿದೆ', 'ಹೌದು ದೃಢೀಕರಿಸಿ'],
    continue: ['ಮುಂದುವರಿಸಿ', 'ಮುಂದೆ', 'ಮುಂದುವರಿಯಿರಿ'],
    confirmSubmit: ['ದೃಢೀಕರಿಸಿ ಸಲ್ಲಿಸಿ', 'ವರದಿ ಸಲ್ಲಿಸಿ', 'ದೂರು ಸಲ್ಲಿಸಿ', 'ವರದಿ ಕಳುಹಿಸಿ'],
  },
  ta: {
    choose: 'வணக்கம்! நான் கிராமமித்ரா. எந்த மொழியில் பேச விரும்புகிறீர்கள்? மொழியின் பெயரைச் சொல்லுங்கள் அல்லது திரையில் தேர்ந்தெடுக்கவும்.',
    selected: 'சரி. இனி இந்த மொழியில் உங்களுக்கு வழிகாட்டுகிறேன். உங்கள் புகாரைத் தொடங்குவோம்.',
    steps: [
      'எந்த குடிமைப் பிரச்சினையைப் புகாரளிக்க விரும்புகிறீர்கள்? பிரச்சினையைச் சொல்லுங்கள் அல்லது திரையில் வகையைத் தேர்ந்தெடுக்கவும்.',
      'என்ன நடந்தது, எங்கு பார்த்தீர்கள் என்பதைச் சொல்லுங்கள். திரையில் புகைப்படங்களையும் சேர்க்கலாம். தொடரத் தயாரானதும் தொடரவும் என்று சொல்லுங்கள் அல்லது பொத்தானைத் தட்டுங்கள்.',
      'வரைபடத்தில் இடத்தைத் தேர்ந்தெடுக்கவும் அல்லது எனது GPS-ஐப் பயன்படுத்து என்று சொல்லவும். முகவரியைச் சொன்ன பிறகு இடத்தை உறுதிசெய் என்று சொல்லவும். உங்கள் அனுமதிக்குப் பிறகே GPS இடம் பெறப்படும்.',
      'உங்கள் புகாரைத் திரையில் சரிபார்க்கவும். தயாரான பிறகு உறுதிசெய்து சமர்ப்பி என்று சொல்லுங்கள்.',
    ],
    categories: {},
    gps: ['ஜிபிஎஸ் பயன்படுத்து', 'எனது ஜிபிஎஸ் பயன்படுத்து'],
    confirmLocation: ['இடத்தை உறுதிசெய்', 'முகவரி சரி', 'ஆம் உறுதிசெய்'],
    continue: ['தொடரவும்', 'அடுத்து', 'முன்னே செல்லவும்'],
    confirmSubmit: ['உறுதிசெய்து சமர்ப்பி', 'புகாரைச் சமர்ப்பி', 'அறிக்கையை அனுப்பு'],
  },
  te: {
    choose: 'నమస్కారం! నేను గ్రామమిత్ర. మీరు ఏ భాషలో మాట్లాడాలనుకుంటున్నారు? భాష పేరు చెప్పండి లేదా తెరపై ఎంచుకోండి.',
    selected: 'సరే. ఇకపై ఈ భాషలో మీకు సహాయం చేస్తాను. మీ ఫిర్యాదును ప్రారంభిద్దాం.',
    steps: [
      'మీరు ఏ పౌర సమస్యను నివేదించాలనుకుంటున్నారు? సమస్యను వివరించండి లేదా తెరపై వర్గాన్ని ఎంచుకోండి.',
      'ఏమి జరిగింది, ఎక్కడ గమనించారో చెప్పండి. తెరపై ఫోటోలను కూడా జోడించవచ్చు. కొనసాగించడానికి కొనసాగించు అని చెప్పండి లేదా బటన్ నొక్కండి.',
      'మ్యాప్‌లో స్థలాన్ని ఎంచుకోండి లేదా నా GPS వాడు అని చెప్పండి. చిరునామా చెప్పిన తర్వాత స్థానాన్ని నిర్ధారించు అని చెప్పండి. మీ అనుమతి తర్వాతే GPS స్థానం తీసుకుంటాను.',
      'మీ నివేదికను తెరపై పరిశీలించండి. సిద్ధంగా ఉన్నప్పుడు మాత్రమే నిర్ధారించి సమర్పించండి అని చెప్పండి.',
    ],
    categories: {},
    gps: ['జిపిఎస్ వాడు', 'నా జిపిఎస్ వాడు'],
    confirmLocation: ['స్థానం నిర్ధారించు', 'చిరునామా సరైనది', 'అవును నిర్ధారించు'],
    continue: ['కొనసాగించు', 'తర్వాత', 'ముందుకు వెళ్లు'],
    confirmSubmit: ['నిర్ధారించి సమర్పించు', 'ఫిర్యాదు సమర్పించు', 'నివేదిక పంపు'],
  },
  ml: {
    choose: 'നമസ്കാരം! ഞാൻ ഗ്രാമമിത്രയാണ്. ഏത് ഭാഷയിലാണ് സംസാരിക്കേണ്ടത്? ഭാഷയുടെ പേര് പറയുകയോ സ്ക്രീനിൽ തിരഞ്ഞെടുക്കുകയോ ചെയ്യൂ.',
    selected: 'ശരി. ഇനി ഈ ഭാഷയിൽ ഞാൻ നിങ്ങളെ സഹായിക്കും. നിങ്ങളുടെ പരാതി തുടങ്ങാം.',
    steps: [
      'ഏത് പൗരപ്രശ്നമാണ് റിപ്പോർട്ട് ചെയ്യേണ്ടത്? പ്രശ്നം പറയൂ അല്ലെങ്കിൽ സ്ക്രീനിൽ വിഭാഗം തിരഞ്ഞെടുക്കൂ.',
      'എന്താണ് സംഭവിച്ചത്, എവിടെയാണ് കണ്ടത് എന്ന് പറയൂ. സ്ക്രീനിൽ ഫോട്ടോകളും ചേർക്കാം. തുടരാൻ തയ്യാറാകുമ്പോൾ തുടരുക എന്ന് പറയൂ അല്ലെങ്കിൽ ബട്ടൺ അമർത്തൂ.',
      'മാപ്പിൽ സ്ഥലം തിരഞ്ഞെടുക്കുക അല്ലെങ്കിൽ എന്റെ GPS ഉപയോഗിക്കൂ എന്ന് പറയുക. വിലാസം പറഞ്ഞ ശേഷം സ്ഥലം സ്ഥിരീകരിക്കുക എന്ന് പറയുക. നിങ്ങളുടെ അനുമതിക്ക് ശേഷമേ GPS സ്ഥലം എടുക്കൂ.',
      'നിങ്ങളുടെ റിപ്പോർട്ട് സ്ക്രീനിൽ പരിശോധിക്കുക. തയ്യാറായാൽ മാത്രം സ്ഥിരീകരിച്ച് സമർപ്പിക്കൂ എന്ന് പറയുക.',
    ],
    categories: {},
    gps: ['ജിപിഎസ് ഉപയോഗിക്കൂ', 'എന്റെ ജിപിഎസ് ഉപയോഗിക്കൂ'],
    confirmLocation: ['സ്ഥലം സ്ഥിരീകരിക്കുക', 'വിലാസം ശരിയാണ്', 'അതെ സ്ഥിരീകരിക്കുക'],
    continue: ['തുടരുക', 'അടുത്തത്', 'മുന്നോട്ട് പോകുക'],
    confirmSubmit: ['സ്ഥിരീകരിച്ച് സമർപ്പിക്കുക', 'പരാതി സമർപ്പിക്കുക', 'റിപ്പോർട്ട് അയയ്ക്കുക'],
  },
  mr: {
    choose: 'नमस्कार! मी ग्राममित्र आहे. तुम्हाला कोणत्या भाषेत बोलायचे आहे? भाषेचे नाव सांगा किंवा स्क्रीनवर निवडा.',
    selected: 'छान. आता मी तुम्हाला या भाषेत मदत करेन. चला, तुमची तक्रार सुरू करूया.',
    steps: [
      'कोणती नागरी समस्या नोंदवायची आहे? समस्येचे वर्णन करा किंवा स्क्रीनवर श्रेणी निवडा.',
      'काय झाले आणि कुठे दिसले ते सांगा. स्क्रीनवर फोटो देखील जोडू शकता. पुढे जाण्यासाठी पुढे चला असे सांगा किंवा बटण दाबा.',
      'नकाशावर ठिकाण निवडा किंवा माझे GPS वापरा असे सांगा. पत्ता सांगितल्यानंतर ठिकाणाची पुष्टी करा असे सांगा. तुमच्या परवानगीनंतरच GPS स्थान घेतले जाईल.',
      'तुमची तक्रार स्क्रीनवर तपासा. तयार असाल तेव्हाच पुष्टी करून सबमिट करा असे सांगा.',
    ],
    categories: {},
    gps: ['जीपीएस वापरा', 'माझे जीपीएस वापरा'],
    confirmLocation: ['ठिकाणाची पुष्टी', 'पत्ता बरोबर आहे', 'हो पुष्टी'],
    continue: ['पुढे चला', 'पुढे', 'सुरू ठेवा'],
    confirmSubmit: ['पुष्टी करून सबमिट करा', 'तक्रार सबमिट करा', 'रिपोर्ट पाठवा'],
  },
  bn: {
    choose: 'নমস্কার! আমি গ্রামমিত্র। আপনি কোন ভাষায় কথা বলতে চান? ভাষার নাম বলুন অথবা পর্দায় বেছে নিন।',
    selected: 'ঠিক আছে। এখন থেকে এই ভাষায় আপনাকে সাহায্য করব। আপনার অভিযোগ শুরু করি।',
    steps: [
      'কোন নাগরিক সমস্যাটি জানাতে চান? সমস্যাটি বলুন অথবা স্ক্রিনে একটি বিভাগ বেছে নিন।',
      'কী হয়েছে এবং কোথায় দেখেছেন তা বলুন। পর্দায় ছবিও যোগ করতে পারেন। এগোতে প্রস্তুত হলে এগিয়ে যান বলুন অথবা বোতাম চাপুন।',
      'মানচিত্রে স্থান বেছে নিন অথবা আমার GPS ব্যবহার করুন বলুন। ঠিকানা বলার পরে অবস্থান নিশ্চিত করুন বলুন। আপনার অনুমতির পরেই GPS অবস্থান নেওয়া হবে।',
      'পর্দায় আপনার রিপোর্টটি দেখুন। প্রস্তুত হলে নিশ্চিত করে জমা দিন বলুন।',
    ],
    categories: {},
    gps: ['জিপিএস ব্যবহার করুন', 'আমার জিপিএস ব্যবহার করুন'],
    confirmLocation: ['অবস্থান নিশ্চিত করুন', 'ঠিকানা ঠিক আছে', 'হ্যাঁ নিশ্চিত'],
    continue: ['এগিয়ে যান', 'পরবর্তী', 'চালিয়ে যান'],
    confirmSubmit: ['নিশ্চিত করে জমা দিন', 'অভিযোগ জমা দিন', 'রিপোর্ট পাঠান'],
  },
  gu: {
    choose: 'નમસ્તે! હું ગ્રામમિત્ર છું. તમે કઈ ભાષામાં વાત કરવા માંગો છો? ભાષાનું નામ બોલો અથવા સ્ક્રીન પર પસંદ કરો.',
    selected: 'સારું. હવે હું આ ભાષામાં તમને મદદ કરીશ. ચાલો, તમારી ફરિયાદ શરૂ કરીએ.',
    steps: [
      'કઈ નાગરિક સમસ્યાની જાણ કરવી છે? સમસ્યા જણાવો અથવા સ્ક્રીન પર શ્રેણી પસંદ કરો.',
      'શું થયું અને ક્યાં જોયું તે જણાવો. સ્ક્રીન પર ફોટા પણ ઉમેરી શકો છો. આગળ વધવા માટે આગળ વધો કહો અથવા બટન દબાવો.',
      'નકશા પર સ્થળ પસંદ કરો અથવા મારું GPS વાપરો કહો. સરનામું કહ્યા પછી સ્થાનની ખાતરી કરો કહો. તમારી મંજૂરી પછી જ GPS સ્થાન લેવામાં આવશે.',
      'તમારો અહેવાલ સ્ક્રીન પર તપાસો. તૈયાર હો ત્યારે જ ખાતરી કરીને સબમિટ કરો કહો.',
    ],
    categories: {},
    gps: ['જીપીએસ વાપરો', 'મારું જીપીએસ વાપરો'],
    confirmLocation: ['સ્થાનની ખાતરી કરો', 'સરનામું સાચું છે', 'હા ખાતરી'],
    continue: ['આગળ વધો', 'આગળ', 'ચાલુ રાખો'],
    confirmSubmit: ['ખાતરી કરીને સબમિટ કરો', 'ફરિયાદ સબમિટ કરો', 'અહેવાલ મોકલો'],
  },
  pa: {
    choose: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਗ੍ਰਾਮਮਿੱਤਰ ਹਾਂ। ਤੁਸੀਂ ਕਿਹੜੀ ਭਾਸ਼ਾ ਵਿੱਚ ਗੱਲ ਕਰਨੀ ਚਾਹੁੰਦੇ ਹੋ? ਭਾਸ਼ਾ ਦਾ ਨਾਮ ਬੋਲੋ ਜਾਂ ਸਕ੍ਰੀਨ ਤੋਂ ਚੁਣੋ।',
    selected: 'ਵਧੀਆ। ਹੁਣ ਮੈਂ ਇਸ ਭਾਸ਼ਾ ਵਿੱਚ ਤੁਹਾਡੀ ਮਦਦ ਕਰਾਂਗਾ। ਆਓ, ਤੁਹਾਡੀ ਸ਼ਿਕਾਇਤ ਸ਼ੁਰੂ ਕਰੀਏ।',
    steps: [
      'ਕਿਹੜੀ ਨਾਗਰਿਕ ਸਮੱਸਿਆ ਦੀ ਰਿਪੋਰਟ ਕਰਨੀ ਹੈ? ਸਮੱਸਿਆ ਦੱਸੋ ਜਾਂ ਸਕ੍ਰੀਨ ਉੱਤੇ ਸ਼੍ਰੇਣੀ ਚੁਣੋ।',
      'ਕੀ ਹੋਇਆ ਅਤੇ ਕਿੱਥੇ ਵੇਖਿਆ, ਦੱਸੋ। ਤੁਸੀਂ ਸਕ੍ਰੀਨ ਉੱਤੇ ਫੋਟੋ ਵੀ ਜੋੜ ਸਕਦੇ ਹੋ। ਅੱਗੇ ਵਧਣ ਲਈ ਅੱਗੇ ਵਧੋ ਕਹੋ ਜਾਂ ਬਟਨ ਦਬਾਓ।',
      'ਨਕਸ਼ੇ ਉੱਤੇ ਥਾਂ ਚੁਣੋ ਜਾਂ ਮੇਰਾ GPS ਵਰਤੋ ਕਹੋ। ਪਤਾ ਦੱਸਣ ਤੋਂ ਬਾਅਦ ਥਾਂ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ ਕਹੋ। ਤੁਹਾਡੀ ਇਜਾਜ਼ਤ ਤੋਂ ਬਾਅਦ ਹੀ GPS ਥਾਂ ਲਈ ਜਾਵੇਗੀ।',
      'ਆਪਣੀ ਰਿਪੋਰਟ ਸਕ੍ਰੀਨ ਉੱਤੇ ਵੇਖੋ। ਤਿਆਰ ਹੋਵੋ ਤਾਂ ਹੀ ਪੁਸ਼ਟੀ ਕਰਕੇ ਜਮ੍ਹਾਂ ਕਰੋ ਕਹੋ।',
    ],
    categories: {},
    gps: ['ਜੀਪੀਐਸ ਵਰਤੋ', 'ਮੇਰਾ ਜੀਪੀਐਸ ਵਰਤੋ'],
    confirmLocation: ['ਥਾਂ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ', 'ਪਤਾ ਠੀਕ ਹੈ', 'ਹਾਂ ਪੁਸ਼ਟੀ'],
    continue: ['ਅੱਗੇ ਵਧੋ', 'ਅੱਗੇ', 'ਜਾਰੀ ਰੱਖੋ'],
    confirmSubmit: ['ਪੁਸ਼ਟੀ ਕਰਕੇ ਜਮ੍ਹਾਂ ਕਰੋ', 'ਸ਼ਿਕਾਇਤ ਜਮ੍ਹਾਂ ਕਰੋ', 'ਰਿਪੋਰਟ ਭੇਜੋ'],
  },
  ur: {
    choose: 'السلام علیکم! میں گرامامتر ہوں۔ آپ کس زبان میں بات کرنا چاہیں گے؟ زبان کا نام بولیں یا اسکرین پر منتخب کریں۔',
    selected: 'بہت اچھا۔ اب میں اسی زبان میں آپ کی مدد کروں گا۔ آئیے آپ کی شکایت شروع کریں۔',
    steps: [
      'آپ کس شہری مسئلے کی اطلاع دینا چاہتے ہیں؟ مسئلہ بتائیں یا اسکرین پر زمرہ منتخب کریں۔',
      'بتائیں کیا ہوا اور کہاں دیکھا۔ آپ اسکرین پر تصاویر بھی شامل کر سکتے ہیں۔ آگے بڑھنے کے لیے آگے بڑھیں کہیں یا بٹن دبائیں۔',
      'نقشے پر جگہ منتخب کریں یا میرا GPS استعمال کریں کہیں۔ پتہ بتانے کے بعد مقام کی تصدیق کہیں۔ آپ کی اجازت کے بعد ہی GPS مقام لیا جائے گا۔',
      'اپنی رپورٹ اسکرین پر دیکھیں۔ تیار ہونے پر ہی تصدیق کرکے جمع کریں کہیں۔',
    ],
    categories: {},
    gps: ['جی پی ایس استعمال کریں', 'میرا جی پی ایس استعمال کریں'],
    confirmLocation: ['مقام کی تصدیق', 'پتہ درست ہے', 'ہاں تصدیق'],
    continue: ['آگے بڑھیں', 'اگلا', 'جاری رکھیں'],
    confirmSubmit: ['تصدیق کرکے جمع کریں', 'شکایت جمع کریں', 'رپورٹ بھیجیں'],
  },
  or: {
    choose: 'ନମସ୍କାର! ମୁଁ ଗ୍ରାମମିତ୍ର। ଆପଣ କେଉଁ ଭାଷାରେ କଥା ହେବାକୁ ଚାହାନ୍ତି? ଭାଷାର ନାମ କୁହନ୍ତୁ କିମ୍ବା ପରଦାରେ ବାଛନ୍ତୁ।',
    selected: 'ଭଲ। ଏବେ ମୁଁ ଏହି ଭାଷାରେ ଆପଣଙ୍କୁ ସାହାଯ୍ୟ କରିବି। ଆସନ୍ତୁ, ଆପଣଙ୍କ ରିପୋର୍ଟ ଆରମ୍ଭ କରିବା।',
    steps: [
      'କେଉଁ ନାଗରିକ ସମସ୍ୟା ଜଣାଇବାକୁ ଚାହାନ୍ତି? ସମସ୍ୟାଟି କୁହନ୍ତୁ କିମ୍ବା ସ୍କ୍ରିନରେ ଏକ ଶ୍ରେଣୀ ବାଛନ୍ତୁ।',
      'କ’ଣ ଘଟିଲା ଏବଂ କେଉଁଠି ଦେଖିଲେ କୁହନ୍ତୁ। ପରଦାରେ ଫଟୋ ମଧ୍ୟ ଯୋଡ଼ିପାରିବେ। ଆଗକୁ ବଢ଼ିବାକୁ ଆଗକୁ ବଢ଼ନ୍ତୁ କୁହନ୍ତୁ କିମ୍ବା ବଟନ୍ ଦବାନ୍ତୁ।',
      'ମାନଚିତ୍ରରେ ସ୍ଥାନ ବାଛନ୍ତୁ କିମ୍ବା ମୋ GPS ବ୍ୟବହାର କର କୁହନ୍ତୁ। ଠିକଣା କହିବା ପରେ ସ୍ଥାନ ନିଶ୍ଚିତ କର କୁହନ୍ତୁ। ଆପଣଙ୍କ ଅନୁମତି ପରେ ହିଁ GPS ସ୍ଥାନ ନିଆଯିବ।',
      'ପରଦାରେ ଆପଣଙ୍କ ରିପୋର୍ଟ ଯାଞ୍ଚ କରନ୍ତୁ। ପ୍ରସ୍ତୁତ ହେଲେ ନିଶ୍ଚିତ କରି ଦାଖଲ କର କୁହନ୍ତୁ।',
    ],
    categories: {},
    gps: ['ଜିପିଏସ ବ୍ୟବହାର କର', 'ମୋ ଜିପିଏସ ବ୍ୟବହାର କର'],
    confirmLocation: ['ସ୍ଥାନ ନିଶ୍ଚିତ କର', 'ଠିକଣା ଠିକ', 'ହଁ ନିଶ୍ଚିତ'],
    continue: ['ଆଗକୁ ବଢ଼ନ୍ତୁ', 'ପରବର୍ତ୍ତୀ', 'ଚାଲୁ ରଖନ୍ତୁ'],
    confirmSubmit: ['ନିଶ୍ଚିତ କରି ଦାଖଲ କର', 'ଅଭିଯୋଗ ଦାଖଲ କର', 'ରିପୋର୍ଟ ପଠାଅ'],
  },
};

const normalize = (value) => String(value || '')
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[.,!?;:。，！？।]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const containsPhrase = (transcript, phrases = []) => {
  const normalizedTranscript = ` ${normalize(transcript)} `;
  return phrases.some((phrase) => {
    const normalizedPhrase = normalize(phrase);
    return normalizedPhrase && normalizedTranscript.includes(` ${normalizedPhrase} `);
  });
};

export const getVoiceGuide = (language) => GUIDE_COPY[language] || GUIDE_COPY.en;

export const getSpeechLocale = (language) => SPEECH_LOCALES[language] || 'en-IN';

export const findLanguageFromSpeech = (transcript) => {
  const normalizedTranscript = ` ${normalize(transcript)} `;
  for (const [code, aliases] of Object.entries(LANGUAGE_ALIASES)) {
    if (aliases.some((alias) => normalizedTranscript.includes(` ${normalize(alias)} `))) return code;
  }
  return null;
};

export const findCategoryFromSpeech = (transcript, language) => {
  const localCategories = getVoiceGuide(language).categories;
  for (const [categoryId, aliases] of Object.entries(GUIDE_COPY.en.categories)) {
    if (containsPhrase(transcript, [...aliases, ...(localCategories[categoryId] || [])])) return categoryId;
  }
  return null;
};

export const isGpsRequest = (transcript, language) => containsPhrase(transcript, [
  ...GUIDE_COPY.en.gps,
  ...getVoiceGuide(language).gps,
]);

export const isLocationConfirmation = (transcript, language) => containsPhrase(transcript, [
  ...GUIDE_COPY.en.confirmLocation,
  ...getVoiceGuide(language).confirmLocation,
]);

export const isContinueRequest = (transcript, language) => containsPhrase(transcript, [
  ...GUIDE_COPY.en.continue,
  ...getVoiceGuide(language).continue,
]);

export const isReportSubmissionConfirmation = (transcript, language) => containsPhrase(transcript, [
  ...GUIDE_COPY.en.confirmSubmit,
  ...getVoiceGuide(language).confirmSubmit,
]);
