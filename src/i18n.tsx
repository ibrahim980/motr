import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Lang = 'ar' | 'en';
const LANG_KEY = 'motr-lang';

type Dict = Record<string, string>;

const ar: Dict = {
  // common
  'common.save': 'حفظ',
  'common.cancel': 'إلغاء',
  'common.close': 'إغلاق',
  'common.settings': 'الإعدادات',
  'common.months': 'شهر',
  'common.km_unit': 'كم',
  'common.km_left': 'كم متبقي',
  'common.show_all': 'عرض الكل',
  'common.confidence': 'الثقة',
  'common.mileage': 'المسافة',
  'common.last_update': 'آخر تحديث',
  'common.never': 'لم يُحدّث',
  'common.health_score': 'مؤشر الحالة',
  'common.oil_life': 'عمر الزيت',
  'common.ocr_active': 'مسح OCR نشط',

  // nav
  'nav.vehicles': 'مركباتي',
  'nav.alerts': 'التنبيهات',
  'nav.camera': 'تصوير',
  'nav.timeline': 'السجل',
  'nav.profile': 'حسابي',
  'alerts.title': 'سجل التنبيهات',
  'alerts.all_good_title': 'كل شيء على ما يرام',
  'alerts.all_good_desc': 'لا توجد تنبيهات حالية على مركباتك.',
  'alerts.open_vehicle': 'فتح',

  // dashboard
  'dashboard.empty_hint': 'ابدأ بتصوير عدادك وسنتولى الباقي',
  'dashboard.first_scan': 'ابدأ أول مسح',
  'dashboard.name_your_car': 'سمّ مركبتك',
  'dashboard.name_hint': 'لقد قمت بـ {count} عمليات، ما هو الاسم المفضل لسيارتك؟',
  'dashboard.name_placeholder': 'مثل: فورد رابتور',
  'dashboard.name_updated': 'تم تحديث الاسم',
  'dashboard.smart_alert': 'تنبيه ذكي',
  'dashboard.battery_due_soon': 'البطارية تقترب من نهاية عمرها الافتراضي (متبقي {months} شهر).',
  'dashboard.battery_overdue': 'انتهى عمر البطارية المتوقع منذ {months} شهر — قد تحتاج لاستبدالها.',
  'dashboard.battery_due_now': 'حان وقت الكشف على البطارية.',
  'dashboard.recent_activity': 'آخر النشاطات',
  'dashboard.update_odometer': 'تحديث العداد',
  'dashboard.activity_log': 'سجل النشاط',

  // camera
  'camera.title': 'تحديث ذكي بالصور',
  'camera.subtitle': 'وجّه الكاميرا نحو عداد السيارة، وسنتولى استخراج البيانات تلقائياً',
  'camera.scanning': 'جاري المسح...',
  'camera.open': 'فتح الكاميرا',
  'camera.detected': 'تم اكتشاف {value}',
  'camera.failed': 'لم نتمكن من قراءة العداد، حاول مرة أخرى',
  'camera.quota_daily': 'تجاوزت حصتك اليومية للمسح. حاول غداً.',
  'camera.quota_hourly': 'تروّى قليلاً — وصلت لحد الساعة. جرّب بعد قليل.',
  'camera.unavailable': 'خدمة المسح غير متوفرة حالياً. جرّب لاحقاً.',

  // timeline
  'timeline.title': 'سجل المركبة',
  'timeline.empty': 'لا يوجد سجلات حتى الآن',
  'timeline.delete': 'حذف',
  'timeline.delete_confirm': 'حذف هذا السجل نهائياً؟',
  'timeline.deleted': 'تم حذف السجل',
  'timeline.delete_failed': 'فشل حذف السجل',

  // profile
  'profile.guest': 'ضيف',
  'profile.sign_in_hint': 'سجّل الدخول لمزامنة بياناتك',
  'profile.sign_in_google': 'تسجيل الدخول باستخدام Google',
  'profile.sign_out': 'تسجيل الخروج',
  'profile.seed_demo': 'إنشاء بيانات تجريبية',
  'profile.seed_demo_done': 'تم إنشاء البيانات التجريبية',
  'profile.seed_demo_failed': 'فشل إنشاء البيانات',
  'profile.your_vehicles': 'مركباتك',
  'profile.add_vehicle': 'إضافة مركبة جديدة',
  'profile.no_vehicles': 'لا توجد مركبات بعد. اضغط الزر أعلاه لإضافة أول مركبة.',
  'reports.title': 'تقرير صيانة المركبة',
  'reports.vehicle_info': 'معلومات المركبة',
  'reports.name': 'الاسم',
  'reports.make': 'الصانع',
  'reports.model': 'الموديل',
  'reports.year': 'السنة',
  'reports.color': 'اللون',
  'reports.history': 'سجل الصيانة',
  'reports.date': 'التاريخ',
  'reports.service_type': 'نوع الخدمة',
  'reports.notes': 'ملاحظات',
  'reports.no_events': 'لا توجد سجلات صيانة بعد.',
  'reports.generating': 'جاري إنشاء التقرير...',
  'reports.failed': 'فشل إنشاء التقرير',
  'reports.no_vehicle': 'اختر مركبة أولاً',
  'profile.welcome': 'مرحباً بك!',
  'profile.sign_in_failed': 'فشل تسجيل الدخول',
  'profile.sign_in_first': 'يرجى تسجيل الدخول أولاً',

  // service select
  'service.title': 'ماذا فعلت؟',
  'service.saw_odometer': 'اطلعت على العداد {value}',
  'service.skip': 'تخطي الآن',
  'service.saved': 'تم الحفظ بنجاح',
  'service.save_failed': 'خطأ في الحفظ',
  'service.fuel': 'وقود',
  'service.oil_change': 'تغيير زيت',
  'service.maintenance': 'الصيانة الدورية',
  'service.tires': 'إطارات',
  'service.battery': 'بطارية',
  'service.parts': 'تغيير قطع',
  'service.other': 'أخرى',
  'service.notes': 'ملاحظات (اختياري)',
  'service.notes_placeholder': 'أضف أي ملاحظة عن الصيانة...',
  'service.add': 'إضافة العملية',
  'service.pick_type': 'اختر نوع العملية',

  // settings (vehicle)
  'settings.title': 'إعدادات المركبة',
  'settings.section.oil': 'الزيت',
  'settings.section.battery': 'البطارية',
  'settings.section.tires': 'الإطارات',
  'settings.section.maintenance': 'الصيانة الدورية',
  'settings.section.parts': 'تغيير القطع',
  'settings.oil_interval': 'الفترة بين تغيير الزيت (كم)',
  'settings.last_oil': 'آخر تغيير زيت (عداد)',
  'settings.battery_date': 'تاريخ آخر تغيير للبطارية',
  'settings.battery_interval': 'عمر البطارية بالأشهر',
  'settings.tire_interval': 'الفترة بين تغيير الإطارات (كم)',
  'settings.last_tire': 'آخر تغيير إطارات (عداد)',
  'settings.maintenance_interval': 'فترة الصيانة الدورية بالأشهر',
  'settings.maintenance_date': 'تاريخ آخر صيانة',
  'settings.parts_interval': 'فترة تغيير القطع بالأشهر',
  'settings.parts_date': 'تاريخ آخر تغيير قطع',
  'settings.saved': 'تم حفظ الإعدادات',
  'settings.save_failed': 'فشل حفظ الإعدادات',
  'settings.danger_zone': 'منطقة الحذف',
  'settings.delete_vehicle': 'حذف المركبة',
  'settings.delete_warning': 'هل أنت متأكد؟',
  'settings.delete_explain': 'سيتم حذف المركبة وجميع سجلاتها نهائياً.',
  'settings.delete_confirm_button': 'حذف نهائي',
  'settings.deleted': 'تم حذف المركبة',
  'settings.delete_failed': 'فشل الحذف',
  // maintenance status section
  'dashboard.maintenance_status': 'حالة الصيانة',
  'status.battery': 'البطارية',
  'status.tires': 'الإطارات',
  'status.maintenance': 'الصيانة الدورية',
  'status.parts': 'القطع',
  'status.months_left': 'متبقي {value} شهر',
  'status.km_left': 'متبقي {value} كم',
  'status.months_overdue': 'متأخر {value} شهر',
  'status.km_overdue': 'متأخر {value} كم',
  'status.due_now': 'حان الوقت',
  'status.empty_hint': 'اضبط فترات الصيانة من ⚙️ الإعدادات لرؤية حالة سيارتك.',
  // alert messages
  'alert.battery_soon': 'البطارية تقترب من نهاية عمرها (متبقي {value} شهر).',
  'alert.battery_overdue': 'انتهى عمر البطارية المتوقع منذ {value} شهر — قد تحتاج لاستبدالها.',
  'alert.battery_now': 'حان وقت الكشف على البطارية.',
  'alert.tires_soon': 'الإطارات تقترب من موعد الاستبدال (متبقي {value} كم).',
  'alert.tires_overdue': 'الإطارات تجاوزت الموعد بـ {value} كم — استبدلها قريباً.',
  'alert.tires_now': 'حان وقت تغيير الإطارات.',
  'alert.maintenance_soon': 'الصيانة الدورية تقترب (متبقي {value} شهر).',
  'alert.maintenance_overdue': 'تأخرت الصيانة الدورية بـ {value} شهر.',
  'alert.maintenance_now': 'حان وقت الصيانة الدورية.',
  'alert.parts_soon': 'تغيير القطع يقترب (متبقي {value} شهر).',
  'alert.parts_overdue': 'فحص القطع متأخر بـ {value} شهر.',
  'alert.parts_now': 'حان وقت فحص القطع.',

  // install prompt
  'install.title_prefix': 'أضف',
  'install.title_suffix': 'إلى شاشتك الرئيسية',
  'install.now': 'ثبّت الآن',
  'install.ios_hint_a': 'اضغط زر المشاركة',
  'install.ios_hint_b': 'ثم اختر "Add to Home Screen"',
  'install.dismiss': 'إغلاق',

  // landing
  'landing.open_app': 'فتح التطبيق',
  'landing.hero_t1': 'صوّر العداد',
  'landing.hero_t2': 'واترك الباقي علينا',
  'landing.hero_desc': 'تطبيق ذكي يراقب حالة سيارتك ويتتبّع الصيانة ويذكّرك بكل ما تحتاجه في الوقت المناسب.',
  'landing.start': 'ابدأ الآن',
  'landing.learn': 'تعرف على التطبيق',
  'landing.free': '100% مجاني • بدون إعلانات • بياناتك آمنة',
  'landing.social_proof': '+10,000 مستخدم يعتمدون علينا',
  'landing.menu_label': 'القائمة',
  'landing.features_h': 'ماذا يفعل التطبيق؟',
  'landing.why_prefix': 'ليش تستخدم',
  'landing.why_short': 'ليش موتر؟',
  'landing.why_1': 'صور العداد، حدد العملية، وخل الباقي علينا.',
  'landing.why_2': 'كل ما عبيت بنزين أو سويت صيانة، صور العداد وحدد العملية.',
  'landing.why_3': 'سيارتك لها جدول، وموتر يرتبه لك.',
  'landing.why_4': 'صيانة السيارة مو اختبار ذاكرة. موتر يحفظها عنك.',
  'landing.why_5': 'البطارية ساكته، بس موتر منتبه.',
  'landing.why_6': 'سيارتك تشم ريحة الراتب؟ موتر يساعدك تسبق الخرابات.',
  'landing.f1_t': 'تصوير العداد',
  'landing.f1_d': 'صوّر عداد سيارتك والتطبيق يقرأه تلقائياً بدقة عالية.',
  'landing.f2_t': 'ذكاء اصطناعي',
  'landing.f2_d': 'يحلل بيانات سيارتك ويتنبأ باحتياجات الصيانة قبل حدوثها.',
  'landing.f3_t': 'تنبيهات ذكية',
  'landing.f3_d': 'يذكّرك بالمواعيد المهمة مثل تغيير الزيت والفحص الدوري.',
  'landing.f4_t': 'تقارير مفهومة',
  'landing.f4_d': 'اعرف حالة سيارتك بتقارير بسيطة وواضحة في أي وقت.',
  'landing.how_h': 'كيف يعمل؟',
  'landing.s1_t': 'صوّر العداد',
  'landing.s1_d': 'افتح التطبيق وصوّر عداد السيارة.',
  'landing.s2_t': 'تقرأ البيانات',
  'landing.s2_d': 'التطبيق يقرأ المسافة بذكاء اصطناعي.',
  'landing.s3_t': 'نحلل الحالة',
  'landing.s3_d': 'نحلل حالة السيارة ونقدر احتياجات الصيانة.',
  'landing.s4_t': 'ننبهك في الوقت المناسب',
  'landing.s4_d': 'تصلك تنبيهات',
  'landing.overview_h': 'نظرة على التطبيق',
  'landing.ov_splash': 'البداية',
  'landing.ov_dashboard': 'لوحة المعلومات',
  'landing.ov_timeline': 'سجل المركبة',
  'landing.ov_profile': 'حسابي',
  'landing.download_h': 'جرب التطبيق الآن',
  'landing.download_d': 'امسح الباركود لفتح التطبيق وابدأ رحلة العناية الذكية بسيارتك.',
  'landing.scan_label': 'امسح للتحميل',
  'landing.coming_soon': 'قريباً',
  'landing.gplay': 'Google Play',
  'landing.appstore': 'App Store',
  'landing.rights': '© 2025',
  'landing.rights_after': '. جميع الحقوق محفوظة.',
  'landing.support_label': 'للدعم',
};

const en: Dict = {
  // common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.settings': 'Settings',
  'common.months': 'months',
  'common.km_unit': 'km',
  'common.km_left': 'KM LEFT',
  'common.show_all': 'Show all',
  'common.confidence': 'Confidence',
  'common.mileage': 'Mileage',
  'common.last_update': 'Last update',
  'common.never': 'Never updated',
  'common.health_score': 'Health Score',
  'common.oil_life': 'Oil Life',
  'common.ocr_active': 'OCR Detection Active',

  // nav
  'nav.vehicles': 'Vehicles',
  'nav.alerts': 'Alerts',
  'nav.camera': 'Capture',
  'nav.timeline': 'History',
  'nav.profile': 'Profile',
  'alerts.title': 'Alerts log',
  'alerts.all_good_title': 'All clear',
  'alerts.all_good_desc': 'No active alerts on your vehicles right now.',
  'alerts.open_vehicle': 'Open',

  // dashboard
  'dashboard.empty_hint': 'Capture your odometer and we’ll handle the rest',
  'dashboard.first_scan': 'Start first scan',
  'dashboard.name_your_car': 'Name your car',
  'dashboard.name_hint': 'You’ve logged {count} entries — what would you like to call your car?',
  'dashboard.name_placeholder': 'e.g. Ford Raptor',
  'dashboard.name_updated': 'Name updated',
  'dashboard.smart_alert': 'Smart alert',
  'dashboard.battery_due_soon': 'Battery is nearing the end of its expected life ({months} months left).',
  'dashboard.battery_overdue': 'Battery is {months} months past its expected life — it likely needs replacement.',
  'dashboard.battery_due_now': 'Time to check the battery.',
  'dashboard.recent_activity': 'Recent activity',
  'dashboard.update_odometer': 'Update odometer',
  'dashboard.activity_log': 'Activity log',

  // camera
  'camera.title': 'Smart photo update',
  'camera.subtitle': 'Point the camera at your dashboard and we’ll extract the reading automatically.',
  'camera.scanning': 'Scanning…',
  'camera.open': 'Open camera',
  'camera.detected': 'Detected {value}',
  'camera.failed': 'Couldn’t read the odometer, please try again',
  'camera.quota_daily': 'Daily scan limit reached. Try again tomorrow.',
  'camera.quota_hourly': 'Easy there — hourly limit reached. Try again in a bit.',
  'camera.unavailable': 'Scanning service is unavailable right now. Try later.',

  // timeline
  'timeline.title': 'Vehicle history',
  'timeline.empty': 'No entries yet',
  'timeline.delete': 'Delete',
  'timeline.delete_confirm': 'Delete this entry permanently?',
  'timeline.deleted': 'Entry deleted',
  'timeline.delete_failed': 'Failed to delete entry',

  // profile
  'profile.guest': 'Guest',
  'profile.sign_in_hint': 'Sign in to sync your data',
  'profile.sign_in_google': 'Sign in with Google',
  'profile.sign_out': 'Sign out',
  'profile.seed_demo': 'Load demo data',
  'profile.seed_demo_done': 'Demo data created',
  'profile.seed_demo_failed': 'Failed to create demo data',
  'profile.your_vehicles': 'Your vehicles',
  'profile.add_vehicle': 'Add a new vehicle',
  'profile.no_vehicles': 'No vehicles yet. Use the button above to add your first one.',
  'reports.title': 'Vehicle service report',
  'reports.vehicle_info': 'Vehicle info',
  'reports.name': 'Name',
  'reports.make': 'Make',
  'reports.model': 'Model',
  'reports.year': 'Year',
  'reports.color': 'Color',
  'reports.history': 'Service history',
  'reports.date': 'Date',
  'reports.service_type': 'Service type',
  'reports.notes': 'Notes',
  'reports.no_events': 'No service entries yet.',
  'reports.generating': 'Generating report…',
  'reports.failed': 'Failed to generate the report',
  'reports.no_vehicle': 'Select a vehicle first',
  'profile.welcome': 'Welcome!',
  'profile.sign_in_failed': 'Sign-in failed',
  'profile.sign_in_first': 'Please sign in first',

  // service select
  'service.title': 'What did you do?',
  'service.saw_odometer': 'You saw the odometer at {value}',
  'service.skip': 'Skip for now',
  'service.saved': 'Saved',
  'service.save_failed': 'Save failed',
  'service.fuel': 'Fuel',
  'service.oil_change': 'Oil change',
  'service.maintenance': 'Periodic maintenance',
  'service.tires': 'Tire change',
  'service.battery': 'Battery',
  'service.parts': 'Parts replacement',
  'service.other': 'Other',
  'service.notes': 'Notes (optional)',
  'service.notes_placeholder': 'Add any note about this service…',
  'service.add': 'Add entry',
  'service.pick_type': 'Pick the service type',

  // settings (vehicle)
  'settings.title': 'Vehicle settings',
  'settings.section.oil': 'Oil',
  'settings.section.battery': 'Battery',
  'settings.section.tires': 'Tires',
  'settings.section.maintenance': 'Periodic maintenance',
  'settings.section.parts': 'Parts',
  'settings.oil_interval': 'Oil change interval (km)',
  'settings.last_oil': 'Last oil change (odometer)',
  'settings.battery_date': 'Last battery replacement date',
  'settings.battery_interval': 'Battery life (months)',
  'settings.tire_interval': 'Tire change interval (km)',
  'settings.last_tire': 'Last tire change (odometer)',
  'settings.maintenance_interval': 'Maintenance interval (months)',
  'settings.maintenance_date': 'Last maintenance date',
  'settings.parts_interval': 'Parts change interval (months)',
  'settings.parts_date': 'Last parts change date',
  'settings.saved': 'Settings saved',
  'settings.save_failed': 'Failed to save settings',
  'settings.danger_zone': 'Danger zone',
  'settings.delete_vehicle': 'Delete vehicle',
  'settings.delete_warning': 'Are you sure?',
  'settings.delete_explain': 'The vehicle and all its history will be permanently deleted.',
  'settings.delete_confirm_button': 'Delete forever',
  'settings.deleted': 'Vehicle deleted',
  'settings.delete_failed': 'Delete failed',
  // maintenance status section
  'dashboard.maintenance_status': 'Service status',
  'status.battery': 'Battery',
  'status.tires': 'Tires',
  'status.maintenance': 'Maintenance',
  'status.parts': 'Parts',
  'status.months_left': '{value} months left',
  'status.km_left': '{value} km left',
  'status.months_overdue': '{value} months overdue',
  'status.km_overdue': '{value} km overdue',
  'status.due_now': 'Due now',
  'status.empty_hint': 'Set service intervals in ⚙️ Settings to see your vehicle\'s status.',
  // alert messages
  'alert.battery_soon': 'Battery is nearing the end of its life ({value} months left).',
  'alert.battery_overdue': 'Battery is {value} months past its expected life — replace soon.',
  'alert.battery_now': 'Time to check the battery.',
  'alert.tires_soon': 'Tires are nearing replacement ({value} km left).',
  'alert.tires_overdue': 'Tires are {value} km past their replacement point — replace soon.',
  'alert.tires_now': 'Time to replace the tires.',
  'alert.maintenance_soon': 'Periodic maintenance due soon ({value} months left).',
  'alert.maintenance_overdue': 'Periodic maintenance overdue by {value} months.',
  'alert.maintenance_now': 'Periodic maintenance is due.',
  'alert.parts_soon': 'Parts check due soon ({value} months left).',
  'alert.parts_overdue': 'Parts check overdue by {value} months.',
  'alert.parts_now': 'Time to inspect parts.',

  // install prompt
  'install.title_prefix': 'Add',
  'install.title_suffix': 'to your home screen',
  'install.now': 'Install now',
  'install.ios_hint_a': 'Tap the share button',
  'install.ios_hint_b': 'then choose "Add to Home Screen"',
  'install.dismiss': 'Dismiss',

  // landing
  'landing.open_app': 'Open app',
  'landing.hero_t1': 'Snap the odometer',
  'landing.hero_t2': 'and leave the rest to us',
  'landing.hero_desc': 'A smart app that watches your car, tracks maintenance, and reminds you of everything you need right on time.',
  'landing.start': 'Start now',
  'landing.learn': 'Learn about the app',
  'landing.free': '100% free • No ads • Your data stays yours',
  'landing.social_proof': '10,000+ users trust us',
  'landing.menu_label': 'Menu',
  'landing.features_h': 'What does the app do?',
  'landing.why_prefix': 'Why use',
  'landing.why_short': 'Why MOTR?',
  'landing.why_1': 'Snap the odometer, pick the action, leave the rest to us.',
  'landing.why_2': 'Every fuel-up or service — just snap the odometer and pick the action.',
  'landing.why_3': 'Your car has a schedule. MOTR keeps it for you.',
  'landing.why_4': "Car maintenance isn't a memory test — MOTR remembers it.",
  'landing.why_5': 'The battery stays quiet. MOTR doesn\'t.',
  'landing.why_6': 'Does your car always break the week you got paid? MOTR helps you stay ahead.',
  'landing.f1_t': 'Odometer capture',
  'landing.f1_d': 'Snap your odometer and the app reads it automatically with high accuracy.',
  'landing.f2_t': 'AI insights',
  'landing.f2_d': 'Analyzes your car’s data and predicts maintenance needs before they happen.',
  'landing.f3_t': 'Smart alerts',
  'landing.f3_d': 'Reminds you of important dates like oil changes and periodic inspections.',
  'landing.f4_t': 'Clear reports',
  'landing.f4_d': 'Know your car’s status with simple, clear reports anytime.',
  'landing.how_h': 'How does it work?',
  'landing.s1_t': 'Snap the odometer',
  'landing.s1_d': 'Open the app and snap your car’s odometer.',
  'landing.s2_t': 'Reads the data',
  'landing.s2_d': 'The app reads the distance with AI.',
  'landing.s3_t': 'Analyzes the state',
  'landing.s3_d': 'We analyze your car and estimate maintenance needs.',
  'landing.s4_t': 'Alerts you on time',
  'landing.s4_d': 'You get smart alerts before any problem.',
  'landing.overview_h': 'A look at the app',
  'landing.ov_splash': 'Welcome',
  'landing.ov_dashboard': 'Dashboard',
  'landing.ov_timeline': 'Vehicle history',
  'landing.ov_profile': 'Profile',
  'landing.download_h': 'Try the app now',
  'landing.download_d': 'Scan the QR code to open the app and start your smart car-care journey.',
  'landing.scan_label': 'Scan to open',
  'landing.coming_soon': 'Coming soon',
  'landing.gplay': 'Google Play',
  'landing.appstore': 'App Store',
  'landing.rights': '© 2025',
  'landing.rights_after': '. All rights reserved.',
  'landing.support_label': 'Support',
};

const dictionaries: Record<Lang, Dict> = { ar, en };

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return 'ar';
  const stored = window.localStorage.getItem(LANG_KEY);
  if (stored === 'ar' || stored === 'en') return stored;
  const browser = (window.navigator.language || 'ar').toLowerCase();
  return browser.startsWith('en') ? 'en' : 'ar';
}

interface I18nContext {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Context = createContext<I18nContext | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectInitialLang());

  useEffect(() => {
    window.localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let value = dictionaries[lang][key];
      if (value == null) {
        value = dictionaries.ar[key] ?? dictionaries.en[key] ?? key;
      }
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return value;
    },
    [lang]
  );

  const value = useMemo<I18nContext>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): I18nContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useI18n must be used within <LanguageProvider>');
  return ctx;
}

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className={
        'inline-flex items-center justify-center min-w-[44px] h-10 px-3 rounded-full bg-white border border-black/10 text-xs font-bold tracking-wider hover:bg-black/5 transition ' +
        className
      }
      aria-label="Toggle language"
    >
      {lang === 'ar' ? 'EN' : 'ع'}
    </button>
  );
}
