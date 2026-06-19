const ICONS = ['🧠', '✍️', '💻', '🔍', '📄', '📊', '🖼️', '📋'];
const MODEL_NAME = 'Kyrovia Nova Instant';

const TRANSLATIONS = {
  en: {
    intro: "I'm **Kyrovia.AI**, an AI assistant designed to help with a wide range of tasks including:",
    items: [
      ['Reasoning', 'logical thinking, analysis, and problem solving'],
      ['Writing', 'drafting, editing, and creative content'],
      ['Coding', 'writing, debugging, and explaining code across languages'],
      ['Research', 'finding information and summarizing complex topics'],
      ['Documents', 'reviewing, formatting, and generating documents'],
      ['Spreadsheets', 'formulas, data analysis, and table generation'],
      ['Images', 'generating and editing images from descriptions'],
      ['Planning', 'organizing tasks, creating schedules, and strategizing']
    ],
    closing: 'How can I help you today?'
  },
  'hi-Latn': {
    intro: 'Main **Kyrovia.AI** hoon, ek AI assistant jo kai tarah ke kaamon mein aapki madad kar sakta hai:',
    items: [
      ['Tark aur vishleshan', 'logical thinking, analysis aur problem solving'],
      ['Lekhan', 'drafting, editing aur creative content'],
      ['Coding', 'alag-alag languages mein code likhna, debug karna aur samjhana'],
      ['Research', 'jaankari khojna aur complex topics ko summarize karna'],
      ['Documents', 'documents ko review, format aur generate karna'],
      ['Spreadsheets', 'formulas, data analysis aur tables banana'],
      ['Images', 'description se images generate aur edit karna'],
      ['Planning', 'tasks organize karna, schedules banana aur strategy taiyar karna']
    ],
    closing: 'Aaj main aapki kaise madad kar sakta hoon?'
  },
  hi: {
    intro: 'मैं **Kyrovia.AI** हूँ, एक AI सहायक जो कई प्रकार के कार्यों में आपकी मदद कर सकता है:',
    items: [
      ['तर्क और विश्लेषण', 'तार्किक सोच, विश्लेषण और समस्या समाधान'],
      ['लेखन', 'ड्राफ्टिंग, संपादन और रचनात्मक सामग्री'],
      ['कोडिंग', 'विभिन्न भाषाओं में कोड लिखना, डीबग करना और समझाना'],
      ['शोध', 'जानकारी खोजना और जटिल विषयों का सार प्रस्तुत करना'],
      ['दस्तावेज़', 'दस्तावेज़ों की समीक्षा, फ़ॉर्मेटिंग और निर्माण'],
      ['स्प्रेडशीट', 'फ़ॉर्मूले, डेटा विश्लेषण और तालिका निर्माण'],
      ['चित्र', 'विवरण से चित्र बनाना और संपादित करना'],
      ['योजना', 'कार्य व्यवस्थित करना, समय-सारणी बनाना और रणनीति तैयार करना']
    ],
    closing: 'आज मैं आपकी कैसे मदद कर सकता हूँ?'
  },
  es: {
    intro: 'Soy **Kyrovia.AI**, un asistente de IA diseñado para ayudarte con una amplia variedad de tareas, entre ellas:',
    items: [
      ['Razonamiento', 'pensamiento lógico, análisis y resolución de problemas'],
      ['Escritura', 'redacción, edición y contenido creativo'],
      ['Programación', 'escribir, depurar y explicar código'],
      ['Investigación', 'buscar información y resumir temas complejos'],
      ['Documentos', 'revisar, dar formato y generar documentos'],
      ['Hojas de cálculo', 'fórmulas, análisis de datos y creación de tablas'],
      ['Imágenes', 'generar y editar imágenes a partir de descripciones'],
      ['Planificación', 'organizar tareas, crear horarios y diseñar estrategias']
    ],
    closing: '¿Cómo puedo ayudarte hoy?'
  },
  fr: {
    intro: "Je suis **Kyrovia.AI**, un assistant IA conçu pour vous aider dans de nombreux types de tâches, notamment :",
    items: [
      ['Raisonnement', 'réflexion logique, analyse et résolution de problèmes'],
      ['Rédaction', 'création, révision et contenu créatif'],
      ['Programmation', 'écriture, débogage et explication de code'],
      ['Recherche', "recherche d'informations et synthèse de sujets complexes"],
      ['Documents', 'révision, mise en forme et génération de documents'],
      ['Tableurs', 'formules, analyse de données et création de tableaux'],
      ['Images', "génération et modification d'images à partir de descriptions"],
      ['Planification', 'organisation des tâches, calendriers et stratégies']
    ],
    closing: "Comment puis-je vous aider aujourd'hui ?"
  },
  ar: {
    intro: 'أنا **Kyrovia.AI**، مساعد ذكاء اصطناعي مصمم لمساعدتك في مجموعة واسعة من المهام، منها:',
    items: [
      ['الاستدلال', 'التفكير المنطقي والتحليل وحل المشكلات'],
      ['الكتابة', 'الصياغة والتحرير والمحتوى الإبداعي'],
      ['البرمجة', 'كتابة الشيفرة وتصحيحها وشرحها'],
      ['البحث', 'العثور على المعلومات وتلخيص الموضوعات المعقدة'],
      ['المستندات', 'مراجعة المستندات وتنسيقها وإنشاؤها'],
      ['جداول البيانات', 'الصيغ وتحليل البيانات وإنشاء الجداول'],
      ['الصور', 'إنشاء الصور وتحريرها من الأوصاف'],
      ['التخطيط', 'تنظيم المهام وإنشاء الجداول الزمنية والاستراتيجيات']
    ],
    closing: 'كيف يمكنني مساعدتك اليوم؟'
  },
  ur: {
    intro: 'میں **Kyrovia.AI** ہوں، ایک AI معاون جو مختلف قسم کے کاموں میں آپ کی مدد کے لیے بنایا گیا ہے:',
    items: [
      ['استدلال', 'منطقی سوچ، تجزیہ اور مسائل کا حل'],
      ['تحریر', 'مسودہ نویسی، تدوین اور تخلیقی مواد'],
      ['کوڈنگ', 'مختلف زبانوں میں کوڈ لکھنا، درست کرنا اور سمجھانا'],
      ['تحقیق', 'معلومات تلاش کرنا اور پیچیدہ موضوعات کا خلاصہ'],
      ['دستاویزات', 'جائزہ، فارمیٹنگ اور دستاویزات بنانا'],
      ['اسپریڈشیٹس', 'فارمولے، ڈیٹا تجزیہ اور جدول بنانا'],
      ['تصاویر', 'تفصیل سے تصاویر بنانا اور ترمیم کرنا'],
      ['منصوبہ بندی', 'کام منظم کرنا، شیڈول اور حکمت عملی بنانا']
    ],
    closing: 'آج میں آپ کی کیسے مدد کر سکتا ہوں؟'
  },
  bn: {
    intro: 'আমি **Kyrovia.AI**, একটি AI সহকারী যা বিভিন্ন ধরনের কাজে আপনাকে সাহায্য করার জন্য তৈরি:',
    items: [
      ['যুক্তি ও বিশ্লেষণ', 'যৌক্তিক চিন্তা, বিশ্লেষণ এবং সমস্যা সমাধান'],
      ['লেখালেখি', 'খসড়া, সম্পাদনা এবং সৃজনশীল বিষয়বস্তু'],
      ['কোডিং', 'বিভিন্ন ভাষায় কোড লেখা, ডিবাগ করা এবং ব্যাখ্যা করা'],
      ['গবেষণা', 'তথ্য খোঁজা এবং জটিল বিষয় সংক্ষেপ করা'],
      ['ডকুমেন্ট', 'পর্যালোচনা, ফরম্যাট এবং ডকুমেন্ট তৈরি'],
      ['স্প্রেডশিট', 'সূত্র, ডেটা বিশ্লেষণ এবং টেবিল তৈরি'],
      ['ছবি', 'বর্ণনা থেকে ছবি তৈরি এবং সম্পাদনা'],
      ['পরিকল্পনা', 'কাজ সাজানো, সময়সূচি এবং কৌশল তৈরি']
    ],
    closing: 'আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?'
  },
  ru: {
    intro: 'Я **Kyrovia.AI**, ИИ-ассистент, созданный для помощи с широким кругом задач, включая:',
    items: [
      ['Рассуждение', 'логическое мышление, анализ и решение задач'],
      ['Тексты', 'подготовка, редактирование и творческий контент'],
      ['Программирование', 'написание, отладка и объяснение кода'],
      ['Исследования', 'поиск информации и краткое изложение сложных тем'],
      ['Документы', 'проверка, форматирование и создание документов'],
      ['Таблицы', 'формулы, анализ данных и создание таблиц'],
      ['Изображения', 'создание и редактирование изображений по описанию'],
      ['Планирование', 'организация задач, расписаний и стратегий']
    ],
    closing: 'Чем я могу помочь вам сегодня?'
  },
  zh: {
    intro: '我是 **Kyrovia.AI**，一名可以协助您完成多种任务的 AI 助手，包括：',
    items: [
      ['推理', '逻辑思考、分析和解决问题'],
      ['写作', '起草、编辑和创意内容'],
      ['编程', '使用多种语言编写、调试和解释代码'],
      ['研究', '查找信息并总结复杂主题'],
      ['文档', '审阅、格式化和生成文档'],
      ['电子表格', '公式、数据分析和表格生成'],
      ['图像', '根据描述生成和编辑图像'],
      ['规划', '组织任务、制定日程和策略']
    ],
    closing: '今天我能为您做些什么？'
  },
  ja: {
    intro: '私は **Kyrovia.AI** です。さまざまな作業を支援するために設計された AI アシスタントです：',
    items: [
      ['推論', '論理的思考、分析、問題解決'],
      ['文章作成', '下書き、編集、クリエイティブなコンテンツ'],
      ['コーディング', '複数言語でのコード作成、デバッグ、説明'],
      ['調査', '情報検索と複雑なテーマの要約'],
      ['文書', '文書の確認、書式設定、生成'],
      ['表計算', '数式、データ分析、表の作成'],
      ['画像', '説明からの画像生成と編集'],
      ['計画', 'タスク整理、スケジュール作成、戦略立案']
    ],
    closing: '今日はどのようにお手伝いできますか？'
  },
  ko: {
    intro: '저는 **Kyrovia.AI**입니다. 다양한 작업을 도와드리도록 설계된 AI 도우미입니다:',
    items: [
      ['추론', '논리적 사고, 분석 및 문제 해결'],
      ['글쓰기', '초안 작성, 편집 및 창의적 콘텐츠'],
      ['코딩', '여러 언어의 코드 작성, 디버깅 및 설명'],
      ['조사', '정보 검색과 복잡한 주제 요약'],
      ['문서', '문서 검토, 서식 지정 및 생성'],
      ['스프레드시트', '수식, 데이터 분석 및 표 생성'],
      ['이미지', '설명에 따른 이미지 생성 및 편집'],
      ['계획', '작업 정리, 일정 및 전략 수립']
    ],
    closing: '오늘 무엇을 도와드릴까요?'
  },
  mr: {
    intro: 'मी **Kyrovia.AI** आहे, विविध प्रकारच्या कामांमध्ये मदत करण्यासाठी तयार केलेला AI सहाय्यक:',
    items: [
      ['तर्क आणि विश्लेषण', 'तार्किक विचार, विश्लेषण आणि समस्या सोडवणे'],
      ['लेखन', 'मसुदा, संपादन आणि सर्जनशील मजकूर'],
      ['कोडिंग', 'विविध भाषांमध्ये कोड लिहिणे, डीबग करणे आणि समजावणे'],
      ['संशोधन', 'माहिती शोधणे आणि गुंतागुंतीचे विषय संक्षिप्त करणे'],
      ['दस्तऐवज', 'पुनरावलोकन, स्वरूपन आणि दस्तऐवज तयार करणे'],
      ['स्प्रेडशीट', 'सूत्रे, डेटा विश्लेषण आणि तक्ते तयार करणे'],
      ['प्रतिमा', 'वर्णनावरून प्रतिमा तयार आणि संपादित करणे'],
      ['नियोजन', 'कामे आयोजित करणे, वेळापत्रक आणि रणनीती बनवणे']
    ],
    closing: 'आज मी तुम्हाला कशी मदत करू शकतो?'
  },
  ta: {
    intro: 'நான் **Kyrovia.AI**, பல்வேறு பணிகளில் உங்களுக்கு உதவ வடிவமைக்கப்பட்ட AI உதவியாளர்:',
    items: [
      ['பகுத்தறிவு', 'தர்க்க சிந்தனை, பகுப்பாய்வு மற்றும் சிக்கல் தீர்வு'],
      ['எழுத்து', 'வரைவு, திருத்தம் மற்றும் படைப்பாற்றல் உள்ளடக்கம்'],
      ['குறியீட்டாக்கம்', 'குறியீடு எழுதுதல், பிழைத்திருத்தம் மற்றும் விளக்கம்'],
      ['ஆராய்ச்சி', 'தகவல் தேடுதல் மற்றும் சிக்கலான தலைப்புகளைச் சுருக்குதல்'],
      ['ஆவணங்கள்', 'மதிப்பாய்வு, வடிவமைப்பு மற்றும் ஆவண உருவாக்கம்'],
      ['விரிதாள்கள்', 'சூத்திரங்கள், தரவு பகுப்பாய்வு மற்றும் அட்டவணைகள்'],
      ['படங்கள்', 'விளக்கங்களிலிருந்து படங்களை உருவாக்குதல் மற்றும் திருத்துதல்'],
      ['திட்டமிடல்', 'பணிகள், அட்டவணைகள் மற்றும் உத்திகளை ஒழுங்கமைத்தல்']
    ],
    closing: 'இன்று நான் உங்களுக்கு எப்படி உதவலாம்?'
  },
  te: {
    intro: 'నేను **Kyrovia.AI**, అనేక రకాల పనుల్లో మీకు సహాయం చేయడానికి రూపొందించిన AI సహాయకుడిని:',
    items: [
      ['తార్కిక విశ్లేషణ', 'ఆలోచన, విశ్లేషణ మరియు సమస్య పరిష్కారం'],
      ['రచన', 'ముసాయిదా, సవరణ మరియు సృజనాత్మక కంటెంట్'],
      ['కోడింగ్', 'కోడ్ రాయడం, డీబగ్ చేయడం మరియు వివరించడం'],
      ['పరిశోధన', 'సమాచారం కనుగొనడం మరియు క్లిష్ట విషయాలను సంక్షిప్తం చేయడం'],
      ['పత్రాలు', 'సమీక్ష, ఫార్మాటింగ్ మరియు పత్రాల తయారీ'],
      ['స్ప్రెడ్‌షీట్లు', 'సూత్రాలు, డేటా విశ్లేషణ మరియు పట్టికలు'],
      ['చిత్రాలు', 'వివరణల నుంచి చిత్రాలను రూపొందించడం మరియు సవరించడం'],
      ['ప్రణాళిక', 'పనులు, షెడ్యూళ్లు మరియు వ్యూహాలను నిర్వహించడం']
    ],
    closing: 'ఈ రోజు నేను మీకు ఎలా సహాయం చేయగలను?'
  },
  gu: {
    intro: 'હું **Kyrovia.AI** છું, વિવિધ પ્રકારના કાર્યોમાં મદદ કરવા માટે બનાવાયેલ AI સહાયક:',
    items: [
      ['તર્ક અને વિશ્લેષણ', 'તાર્કિક વિચાર, વિશ્લેષણ અને સમસ્યાનું નિરાકરણ'],
      ['લેખન', 'મુસદ્દો, સંપાદન અને સર્જનાત્મક સામગ્રી'],
      ['કોડિંગ', 'કોડ લખવો, ડિબગ કરવો અને સમજાવવો'],
      ['સંશોધન', 'માહિતી શોધવી અને જટિલ વિષયોનો સાર આપવો'],
      ['દસ્તાવેજો', 'સમીક્ષા, ફોર્મેટિંગ અને દસ્તાવેજો બનાવવું'],
      ['સ્પ્રેડશીટ', 'સૂત્રો, ડેટા વિશ્લેષણ અને કોષ્ટકો'],
      ['છબીઓ', 'વર્ણનથી છબીઓ બનાવવી અને સંપાદિત કરવી'],
      ['આયોજન', 'કાર્યો, સમયપત્રક અને વ્યૂહરચના ગોઠવવી']
    ],
    closing: 'આજે હું તમને કેવી રીતે મદદ કરી શકું?'
  },
  pa: {
    intro: 'ਮੈਂ **Kyrovia.AI** ਹਾਂ, ਵੱਖ-ਵੱਖ ਕੰਮਾਂ ਵਿੱਚ ਤੁਹਾਡੀ ਮਦਦ ਲਈ ਬਣਾਇਆ ਗਿਆ AI ਸਹਾਇਕ:',
    items: [
      ['ਤਰਕ ਅਤੇ ਵਿਸ਼ਲੇਸ਼ਣ', 'ਤਾਰਕਿਕ ਸੋਚ, ਵਿਸ਼ਲੇਸ਼ਣ ਅਤੇ ਸਮੱਸਿਆ ਹੱਲ'],
      ['ਲਿਖਤ', 'ਖਰੜਾ, ਸੰਪਾਦਨ ਅਤੇ ਰਚਨਾਤਮਕ ਸਮੱਗਰੀ'],
      ['ਕੋਡਿੰਗ', 'ਕੋਡ ਲਿਖਣਾ, ਡੀਬੱਗ ਕਰਨਾ ਅਤੇ ਸਮਝਾਉਣਾ'],
      ['ਖੋਜ', 'ਜਾਣਕਾਰੀ ਲੱਭਣਾ ਅਤੇ ਜਟਿਲ ਵਿਸ਼ਿਆਂ ਦਾ ਸਾਰ'],
      ['ਦਸਤਾਵੇਜ਼', 'ਸਮੀਖਿਆ, ਫਾਰਮੈਟਿੰਗ ਅਤੇ ਦਸਤਾਵੇਜ਼ ਬਣਾਉਣਾ'],
      ['ਸਪ੍ਰੈਡਸ਼ੀਟ', 'ਫਾਰਮੂਲੇ, ਡਾਟਾ ਵਿਸ਼ਲੇਸ਼ਣ ਅਤੇ ਟੇਬਲ'],
      ['ਤਸਵੀਰਾਂ', 'ਵੇਰਵੇ ਤੋਂ ਤਸਵੀਰਾਂ ਬਣਾਉਣਾ ਅਤੇ ਸੋਧਣਾ'],
      ['ਯੋਜਨਾ', 'ਕੰਮ, ਸਮਾਂ-ਸਾਰਣੀ ਅਤੇ ਰਣਨੀਤੀ ਵਿਵਸਥਿਤ ਕਰਨਾ']
    ],
    closing: 'ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?'
  }
};

const LANGUAGE_ALIASES = [
  ['hi-Latn', /\bhinglish\b/i],
  ['hi', /(?:\bhindi\b|हिंदी|हिन्दी)/i],
  ['es', /\b(?:spanish|espanol|español)\b/i],
  ['fr', /\b(?:french|francais|français)\b/i],
  ['ar', /(?:\barabic\b|العربية)/i],
  ['ur', /(?:\burdu\b|اردو)/i],
  ['bn', /(?:\b(?:bengali|bangla)\b|বাংলা)/i],
  ['ru', /(?:\brussian\b|русский)/i],
  ['zh', /(?:\b(?:chinese|mandarin)\b|中文|汉语|漢語)/i],
  ['ja', /(?:\bjapanese\b|日本語)/i],
  ['ko', /(?:\bkorean\b|한국어)/i],
  ['mr', /(?:\bmarathi\b|मराठी)/i],
  ['ta', /(?:\btamil\b|தமிழ்)/i],
  ['te', /(?:\btelugu\b|తెలుగు)/i],
  ['gu', /(?:\bgujarati\b|ગુજરાતી)/i],
  ['pa', /(?:\bpunjabi\b|ਪੰਜਾਬੀ)/i],
  ['en', /\benglish\b/i]
];

const NATIVE_PATTERNS = [
  ['mr', /(?:तुम्ही कोण आहात|तू कोण आहेस|स्वतःबद्दल.*सांगा|तुमचा परिचय)/u],
  ['hi', /(?:आप कौन हैं|आप कौन हो|तुम कौन हो|अपने बारे में.*बताओ|अपना परिचय|आप क्या कर सकते)/u],
  ['ur', /(?:آپ کون ہیں|آپ کون ہو|تم کون ہو|اپنے بارے میں.*بتا|اپنا تعارف|آپ کیا کر سکتے)/u],
  ['bn', /(?:আপনি কে|তুমি কে|নিজের সম্পর্কে.*বল|পরিচয় দাও|আপনি কী করতে পারেন)/u],
  ['gu', /(?:તમે કોણ છો|તમારા વિશે.*કહો|પરિચય આપો|તમે શું કરી શકો)/u],
  ['pa', /(?:ਤੁਸੀਂ ਕੌਣ ਹੋ|ਤੂੰ ਕੌਣ ਹੈਂ|ਆਪਣੇ ਬਾਰੇ.*ਦੱਸੋ|ਜਾਣ-ਪਛਾਣ|ਕੀ ਕਰ ਸਕਦੇ)/u],
  ['ta', /(?:நீங்கள் யார்|நீ யார்|உங்களைப் பற்றி.*சொல்ல|அறிமுக|என்ன செய்ய முடியும்)/u],
  ['te', /(?:మీరు ఎవరు|నువ్వు ఎవరు|మీ గురించి.*చెప్ప|పరిచయం|ఏమి చేయగలరు)/u],
  ['ar', /(?:من أنت|من انتم|عرّف نفسك|عرف نفسك|حدثني عن نفسك|ماذا تستطيع أن تفعل)/u],
  ['ru', /(?:кто ты|кто вы|расскажи о себе|представься|что ты умеешь)/iu],
  ['zh', /(?:你是谁|你叫什么|介绍一下你自己|自我介绍|你能做什么)/u],
  ['ja', /(?:あなたは誰|君は誰|自己紹介|あなたについて教えて|何ができますか)/u],
  ['ko', /(?:누구세요|너는 누구|자기소개|당신에 대해 알려|무엇을 할 수)/u]
];

const LATIN_PATTERNS = [
  [
    'hi-Latn',
    /\b(?:(?:aap|ap|tum)\s+(?:kaun|kon)\s+(?:ho|hain)|apne?\s+baa?re\s+me(?:in)?\s+(?:kuch\s+)?batao|apna\s+(?:parichay|naam)\s+(?:do|batao)|tum\s+kya\s+kar\s+sakte\s+ho)\b/i
  ],
  ['es', /\b(?:quien eres|quien es usted|que eres|presentate|hablame de ti|cual es tu nombre|que puedes hacer)\b/i],
  ['fr', /\b(?:qui es tu|qui etes vous|presente toi|presentez vous|parle moi de toi|parlez moi de vous|que peux tu faire)\b/i],
  [
    'en',
    /\b(?:who are you|what are you|tell me about yourself|tell me about you|introduce yourself|what is your name|what s your name|what do you do|what can you do|describe yourself|who made you|who created you|who built you|are you an? (?:ai|bot|assistant|chatbot|robot)|what is kyrovia|who is kyrovia)\b/i
  ]
];

function normalizeLatin(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectRequestedLocale(message = '') {
  return LANGUAGE_ALIASES.find(([, pattern]) => pattern.test(String(message)))?.[0] || null;
}

function hasExplicitLanguageRequest(message = '') {
  const source = String(message);

  return (
    /\b(?:introduce|describe|answer|respond|reply|write|speak|say|tell)\b[\s\S]{0,60}\b(?:in|using)\s+[\p{L}-]{2,30}/iu.test(
      source
    ) ||
    /\btranslate(?:d)?\s+(?:to|into)\s+[\p{L}-]{2,30}/iu.test(source) ||
    /[\p{L}-]{2,30}\s+(?:mein|me|में)[\s\S]{0,50}\b(?:parichay|introduction|introduce)\b/iu.test(source)
  );
}

function detectIdentityRequest(message = '') {
  const source = String(message).trim();

  if (!source) {
    return null;
  }

  const requestedLocale = detectRequestedLocale(source);

  for (const [locale, pattern] of NATIVE_PATTERNS) {
    if (pattern.test(source)) {
      return { locale: requestedLocale || locale, detectedLocale: locale };
    }
  }

  const normalized = normalizeLatin(source);

  for (const [locale, pattern] of LATIN_PATTERNS) {
    if (pattern.test(normalized)) {
      if (hasExplicitLanguageRequest(source) && !requestedLocale) {
        return null;
      }

      return { locale: requestedLocale || locale, detectedLocale: locale };
    }
  }

  return null;
}

function kyroviaIdentityResponse(locale = 'en') {
  const translation = TRANSLATIONS[locale] || TRANSLATIONS.en;
  const items = translation.items.map(
    ([label, description], index) => `${ICONS[index]} **${label}** — ${description}`
  );

  return [translation.intro, '', `**Model:** ${MODEL_NAME}`, '', ...items, '', translation.closing].join('\n');
}

function kyroviaIdentityInstruction() {
  return [
    `You are Kyrovia.AI, running as ${MODEL_NAME}.`,
    'You are not GPT-5.5 Thinking, ChatGPT, or OpenAI.',
    'Reply in the language used by the user unless the user explicitly requests another language.',
    `If the user asks who you are, asks about yourself, or requests an introduction in any language, introduce yourself as Kyrovia.AI and identify your model as ${MODEL_NAME}.`,
    'For an introduction, include these capabilities translated naturally: reasoning, writing, coding, research, documents, spreadsheets, images, and planning.',
    `Never identify yourself as GPT-5.5 Thinking, ChatGPT, OpenAI, or any model name other than ${MODEL_NAME}.`
  ].join('\n');
}

function sanitizeKyroviaBranding(text = '') {
  const identity = "I'm **Kyrovia.AI**, running as **Kyrovia Nova Instant**";

  return String(text)
    .replace(
      /\bI\s*(?:am|'m|’m)\s+(?:(?:an?\s+)?AI\s+(?:assistant|model)\s+(?:called|named)\s+)?(?:OpenAI(?:['’]s)?\s+)?(?:ChatGPT|GPT[-\s]?\d+(?:\.\d+)?(?:\s+Thinking)?|GPT-5\.5\s+Thinking)\b/giu,
      identity
    )
    .replace(
      /\b(?:my\s+)?model\s+(?:is|:)\s*(?:OpenAI(?:['’]s)?\s+)?(?:ChatGPT|GPT[-\s]?\d+(?:\.\d+)?(?:\s+Thinking)?)\b/giu,
      'My model is **Kyrovia Nova Instant**'
    )
    .replace(
      /\bI\s+(?:was|am)\s+(?:created|developed|trained|built|made)\s+by\s+OpenAI\b[^.!?\n]*/giu,
      'I operate as **Kyrovia.AI** with the **Kyrovia Nova Instant** model'
    )
    .replace(/\bGPT[-\s]?5\.5\s+Thinking\b/giu, 'Kyrovia Nova Instant')
    .replace(/\bChatGPT\b/giu, 'Kyrovia.AI');
}

module.exports = {
  detectIdentityRequest,
  kyroviaIdentityInstruction,
  kyroviaIdentityResponse,
  sanitizeKyroviaBranding
};
