import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Language } from '../types';

type GuideKind = 'company' | 'users' | 'buildings' | 'apartments' | 'payments' | 'reports';
export type GuideContext = 'dashboard' | 'map' | 'block' | 'floor' | 'apartment' | 'search' | 'installments' | 'analytics' | 'users' | 'settings' | 'control';
interface GuideSlide {
  kind: GuideKind;
  title: string;
  description: string;
  steps: string[];
  tip: string;
  imageAlt: string;
}

const guideCopy: Record<Language, { title: string; subtitle: string; close: string; previous: string; next: string; finish: string; step: string; slides: GuideSlide[] }> = {
  uz: {
    title: 'Kompaniyadan foydalanish qo‘llanmasi',
    subtitle: 'Yangi kompaniya uchun qisqa, amaliy yo‘riqnoma',
    close: 'Qo‘llanmani yopish',
    previous: 'Oldingi qadam',
    next: 'Keyingi qadam',
    finish: 'Ishni boshlash',
    step: 'qadam',
    slides: [
      {
        kind: 'company',
        title: 'Kompaniyangizga kiring',
        description: 'Kompaniya yaratilgach, super administrator uning hyper-admini uchun login va parol beradi. Shu ma’lumotlar bilan tizimga kiring.',
        steps: ['Login va parolni kiriting.', 'Har bir kompaniyaning binolari va ma’lumotlari alohida saqlanadi.', 'Parolingizni boshqalarga bermang; kerak bo‘lsa hyper-admindan yangilashni so‘rang.'],
        tip: 'Hyper-admin kompaniya hisoblarini boshqaradi. Administrator ma’lumotlarni yuritadi, kuzatuvchi esa faqat ko‘radi.',
        imageAlt: 'Kompaniya, hyper-admin va jamoa hisoblari ko‘rsatilgan chizma',
      },
      {
        kind: 'users',
        title: 'Jamoaga hisob oching',
        description: 'Hyper-admin boshqaruv panelidagi foydalanuvchilar qalqoni tugmasi orqali faqat o‘z kompaniyasiga xodim qo‘shadi.',
        steps: ['“Hisob yaratish” bo‘limiga o‘ting.', 'Login, kamida 5 belgili parol va rolni kiriting.', 'Administratorni ma’lumot kiritish uchun, kuzatuvchini esa faqat ko‘rish uchun tanlang.'],
        tip: 'Hyper-admin mavjud hisoblarning rolini o‘zgartirishi, parolini yangilashi, hisobni vaqtincha o‘chirishi yoki olib tashlashi mumkin.',
        imageAlt: 'Administrator va kuzatuvchi hisoblari ro‘yxati',
      },
      {
        kind: 'buildings',
        title: 'Binolarni xaritaga qo‘shing',
        description: 'Bosh sahifadagi “Edit Plan” orqali xarita muharririni oching va “Blok yaratish” tugmasini bosing.',
        steps: ['Bino nomini kiriting.', 'Qavatlar soni va har qavatdagi xonadonlar sonini belgilang.', 'Yaratgandan so‘ng 2D xaritada binoni suring yoki o‘lchamini o‘zgartiring; 3D ko‘rinishda binoni aylantirib ko‘ring.'],
        tip: 'Binoni tanlab qavatlarga o‘ting. Tuzilmani keyinroq ham tahrirlash mumkin.',
        imageAlt: 'Xaritadagi turli balandlikdagi binolar chizmasi',
      },
      {
        kind: 'apartments',
        title: 'Xonadon va mijoz ma’lumotlari',
        description: 'Bosh sahifadagi bino kartasini oching, qavatni va kerakli xonadonni tanlang.',
        steps: ['Xonadon holatini belgilang: bo‘sh, to‘langan, to‘lov qilmoqda yoki muddati o‘tgan.', 'Bo‘sh bo‘lmagan xonadon uchun mijozning ism-familiyasini kiriting.', 'O‘zgarishlarni saqlang; ma’lumotlar shu kompaniya hisobida qoladi.'],
        tip: 'Xonadon holatini to‘g‘ri tanlang — bu bandlik va qarzdorlik ko‘rsatkichlariga ta’sir qiladi.',
        imageAlt: 'Xonadonlar qavatlar bo‘yicha holat ranglari bilan ko‘rsatilgan',
      },
      {
        kind: 'payments',
        title: 'To‘lovlarni qayd eting',
        description: 'Xonadon oynasida tushgan to‘lovni kiriting yoki yuqori paneldagi to‘lovlar tugmasi orqali bo‘lib to‘lash rejasini boshqaring.',
        steps: ['To‘lov summasi va sanasini tekshiring.', 'Bo‘lib to‘lash bo‘limida boshlang‘ich to‘lov va muddatni kiriting.', 'Kutilayotgan to‘lovlar va muddati o‘tgan qarzlarni muntazam tekshiring.'],
        tip: 'Faqat haqiqatda qabul qilingan to‘lovni tushum sifatida kiriting; rejalashtirilgan to‘lovlar alohida ko‘rsatiladi.',
        imageAlt: 'To‘lovlar jadvali va tushumlar diagrammasi',
      },
      {
        kind: 'reports',
        title: 'Qidiruv va hisobotlardan foydalaning',
        description: 'Yuqori paneldagi qidiruv, bo‘lib to‘lash va diagramma tugmalari kerakli ma’lumotga tez olib boradi.',
        steps: ['Qidiruvdan xonadon yoki mijozni topish uchun foydalaning.', 'Tahlil bo‘limida bandlik, tushum va qarzdorlik ko‘rsatkichlarini ko‘ring.', 'Sozlamalar orqali ma’lumotlarni eksport qiling yoki internet uzilganidan keyin “Sync now” bilan sinxronlang.'],
        tip: 'Hyper-admin foydalanuvchilar bo‘limida o‘z kompaniyasining amallar jurnalini ko‘radi va boshqa kompaniyalar jurnaliga kira olmaydi.',
        imageAlt: 'Boshqaruv panelidagi ko‘rsatkichlar va tahlil diagrammasi',
      },
    ],
  },
  ru: {
    title: 'Руководство по работе с компанией',
    subtitle: 'Короткая практическая инструкция для новой компании',
    close: 'Закрыть руководство',
    previous: 'Предыдущий шаг',
    next: 'Следующий шаг',
    finish: 'Начать работу',
    step: 'шаг',
    slides: [
      {
        kind: 'company',
        title: 'Войдите в свою компанию',
        description: 'После создания компании суперадминистратор выдаёт её гиперадминистратору логин и пароль. Войдите в систему с этими данными.',
        steps: ['Введите логин и пароль.', 'Данные и здания каждой компании хранятся отдельно.', 'Не передавайте пароль другим; при необходимости попросите гиперадминистратора его сменить.'],
        tip: 'Гиперадминистратор управляет учетными записями компании. Администратор ведёт данные, наблюдатель может только просматривать их.',
        imageAlt: 'Схема компании, гиперадминистратора и учетных записей команды',
      },
      {
        kind: 'users',
        title: 'Добавьте сотрудников',
        description: 'Гиперадминистратор нажимает кнопку пользователей со значком щита и добавляет сотрудников только в свою компанию.',
        steps: ['Откройте раздел создания учетной записи.', 'Укажите логин, пароль не короче 5 символов и роль.', 'Выберите администратора для работы с данными или наблюдателя только для просмотра.'],
        tip: 'Гиперадминистратор может менять роли, сбрасывать пароли, отключать и удалять учетные записи.',
        imageAlt: 'Список учетных записей администратора и наблюдателя',
      },
      {
        kind: 'buildings',
        title: 'Добавьте здания на карту',
        description: 'На главной странице нажмите «Edit Plan», чтобы открыть редактор карты, затем выберите «Создать блок».',
        steps: ['Введите название здания.', 'Укажите число этажей и квартир на этаже.', 'После создания перемещайте и изменяйте размер здания на 2D-карте или вращайте модель в 3D.'],
        tip: 'Выберите здание, чтобы перейти к его этажам. Структуру можно изменить позже.',
        imageAlt: 'Схема зданий разной высоты на карте',
      },
      {
        kind: 'apartments',
        title: 'Заполните данные квартир',
        description: 'Откройте карточку здания на главной странице, выберите этаж, затем нужную квартиру.',
        steps: ['Укажите статус: свободна, оплачена, оплачивается или просрочена.', 'Для занятой квартиры внесите имя и фамилию жильца.', 'Сохраните изменения — данные останутся в вашей компании.'],
        tip: 'Правильный статус влияет на показатели занятости и задолженности.',
        imageAlt: 'Этажи с квартирами, выделенными цветами статусов',
      },
      {
        kind: 'payments',
        title: 'Учитывайте платежи',
        description: 'Добавьте полученный платеж в карточке квартиры или управляйте графиком рассрочки через кнопку платежей в верхней панели.',
        steps: ['Проверьте сумму и дату платежа.', 'В разделе рассрочки укажите первоначальный взнос и срок.', 'Регулярно проверяйте предстоящие платежи и просроченную задолженность.'],
        tip: 'Вносите как полученный только фактически принятый платеж; плановые платежи отображаются отдельно.',
        imageAlt: 'Таблица платежей и диаграмма поступлений',
      },
      {
        kind: 'reports',
        title: 'Используйте поиск и отчёты',
        description: 'Кнопки поиска, рассрочки и аналитики в верхней панели помогают быстро найти нужные данные.',
        steps: ['Найдите квартиру или жильца через поиск.', 'В аналитике просматривайте занятость, поступления и задолженность.', 'В настройках экспортируйте данные или нажмите «Sync now» для синхронизации после работы без интернета.'],
        tip: 'Гиперадминистратор видит журнал действий своей компании в разделе пользователей и не имеет доступа к журналам других компаний.',
        imageAlt: 'Показатели и аналитическая диаграмма панели управления',
      },
    ],
  },
  en: {
    title: 'Company user guide',
    subtitle: 'A short, practical walkthrough for a new company',
    close: 'Close guide',
    previous: 'Previous step',
    next: 'Next step',
    finish: 'Get started',
    step: 'step',
    slides: [
      {
        kind: 'company',
        title: 'Sign in to your company',
        description: 'After a company is created, the super admin provides its hyper-admin with a username and password. Sign in with those credentials.',
        steps: ['Enter your username and password.', 'Each company’s buildings and data are stored separately.', 'Keep your password private; ask your hyper-admin to reset it if needed.'],
        tip: 'The hyper-admin manages company accounts. Admins manage business data; viewers can only read it.',
        imageAlt: 'Diagram of a company, its hyper-admin, and team accounts',
      },
      {
        kind: 'users',
        title: 'Add your team',
        description: 'The hyper-admin opens the users button with the shield icon and adds accounts only to their own company.',
        steps: ['Open the create-account section.', 'Enter a username, a password of at least 5 characters, and a role.', 'Choose Admin for managing data or Viewer for read-only access.'],
        tip: 'The hyper-admin can change roles, reset passwords, disable accounts, or remove them.',
        imageAlt: 'List of Admin and Viewer accounts',
      },
      {
        kind: 'buildings',
        title: 'Add buildings to the map',
        description: 'On the dashboard, choose “Edit Plan” to open the map editor, then select “Create block.”',
        steps: ['Enter the building name.', 'Set the number of floors and apartments per floor.', 'After creating it, move or resize the building in 2D, or rotate its model in 3D.'],
        tip: 'Select a building to open its floors. You can update its structure later.',
        imageAlt: 'Map diagram showing buildings with different heights',
      },
      {
        kind: 'apartments',
        title: 'Fill in apartment details',
        description: 'Open a building card on the dashboard, select a floor, and then choose an apartment.',
        steps: ['Set its status: empty, paid, paying, or late.', 'For an occupied apartment, enter the tenant’s first and last name.', 'Save your changes; the data stays within your company.'],
        tip: 'Accurate statuses feed the occupancy and debt indicators.',
        imageAlt: 'Floors with apartments highlighted by status',
      },
      {
        kind: 'payments',
        title: 'Record and track payments',
        description: 'Add a received payment from an apartment, or manage an installment schedule using the payments button in the top bar.',
        steps: ['Check the payment amount and date.', 'In the installment manager, enter the down payment and term.', 'Review upcoming installments and overdue balances regularly.'],
        tip: 'Record only money actually received as a payment; planned installments are shown separately.',
        imageAlt: 'Payment schedule and income chart',
      },
      {
        kind: 'reports',
        title: 'Use search and reports',
        description: 'The search, installments, and analytics buttons in the top bar help you find information quickly.',
        steps: ['Search for an apartment or tenant.', 'Use Analytics to review occupancy, income, and overdue balances.', 'Open Settings to export data or choose “Sync now” after working offline.'],
        tip: 'Hyper-admins can see their company’s activity log in the users section, but cannot access other companies’ logs.',
        imageAlt: 'Dashboard indicators and an analytics chart',
      },
    ],
  },
};

const contextGuides: Record<Language, Record<GuideContext, GuideSlide>> = {
  uz: {
    dashboard: { kind: 'company', title: 'Bosh sahifa: ko‘rsatkichlar va asosiy tugmalar', description: 'Bosh sahifada jami xonadonlar, bandlik, tushum va qarzdorlik bir joyda ko‘rinadi.', steps: ['Qidiruv satrini bosib mijoz yoki xonadonni toping.', 'Kattalashtirish tugmasi xaritani butun oynaga ochadi; X/ESC bilan yopiladi.', 'Edit Plan faqat ma’lumot o‘zgartirish huquqi bor foydalanuvchi uchun ko‘rinadi.', 'Xarita yoki blok kartasini bosib qavatlarga o‘ting.', 'Yuqoridagi kuzatuvchi, rassroka, tahlil, sozlamalar va chiqish tugmalarini kerakli bo‘limlarga o‘tish uchun ishlating.'], tip: 'Kuzatuvchi roli faqat ko‘radi: ma’lumot, to‘lov yoki sozlama tugmalari ishlamaydi.', imageAlt: 'Bosh sahifa ko‘rsatkichlari' },
    map: { kind: 'buildings', title: 'Xarita muharriri: barcha boshqaruv tugmalari', description: '2D va 3D rejada bloklarni yaratish, surish, o‘lchash va o‘zgartirish mumkin.', steps: ['+ Blok yaratish: bino nomi, qavatlar soni va har qavatdagi xonadonlar sonini kiriting.', 'Blokni bosib tanlang; ochiladigan strukturasi tugmasi bilan qavat/xonadon tuzilmasini tahrirlang.', '2D rejada blokni tortib joylang; pastki o‘lcham tutqichini tortib kenglik va balandlikni o‘zgartiring.', '“3D”ni tanlang. 3D sozlamalari orqali eni, chuqurligi, balandligi, soyalar va qavat ajratgichlarini sozlang.', 'Masshtab +/- bilan zoomin, ruchka bilan xarita bo‘ylab, blok rangini rang tanlagichi bilan o‘zgartiring.', 'Binoga rasm yuklash tugmasi bilan blok rasmini biriktiring; “Qavatga o‘tish” esa ichkariga kiradi.', 'O‘chirish oldidan tasdiqlash oynasi chiqadi; faqat keraksiz blokni o‘chiring.'], tip: 'O‘zgartirishlar zaxira servisiga saqlanadi. Rasm yoki o‘lchamdan oldin binoni tanlagan bo‘ling.', imageAlt: 'Xarita muharriri boshqaruvi' },
    block: { kind: 'buildings', title: 'Bino: qavatlarni tanlash', description: 'Tanlangan binoning barcha qavatlari bu oynada kartalar sifatida ko‘rinadi.', steps: ['Eng yuqori yoki kerakli qavat raqamini bosing.', 'Chap tepada orqaga tugmasi bosh sahifaga qaytaradi.', 'Yuqori panelda qidiruv, rassrochka, tahlil va sozlamalar mavjud.'], tip: 'Har bir karta shu qavatdagi xonadonlar rejasini ochadi.', imageAlt: 'Bino qavatlari' },
    floor: { kind: 'apartments', title: 'Qavat reja: xonadonlarni tahrirlash', description: 'Xonadonni bosib status, mijoz va to‘lov ma’lumotlarini o‘zgartirish oynasi ochiladi.', steps: ['Bo‘sh, To‘langan, To‘lov qilmoqda yoki Muddati o‘tgan statusdan birini tanlang.', 'Bo‘sh statusida ism/familiyani o‘chirish; Band statusida mijoz ismini kiriting.', 'Xonadon raqamini to‘g‘rilang, so‘ng “Saqlash” tugmasini bosing.', 'Band xonadonga summani kiriting va “Qo‘shish” bilan haqiqiy tushumni qo‘shing.', 'Xoch yoki modal tashqarisini bosib o‘zgarishlarsiz oynani yoping; avtomatik saqlash yo‘q.'], tip: 'To‘lovni qo‘shishdan oldin mijoz statusini band holatga o‘tkazing; kuzatuvchi saqlay olmaydi.', imageAlt: 'Qavat va xonadonlar' },
    apartment: { kind: 'apartments', title: 'Xonadon oynasi: maydonlar va tugmalar', description: 'Bu oynada status, mijoz, xonadon raqami va haqiqiy to‘lovlar saqlanadi.', steps: ['Boshidagi raqam maydonida xonadon nomerini o‘zgartiring.', 'Status kartalarini bosing; Bo‘sh tanlansa mijoz maydonlari yashiriladi.', 'Band status uchun ism va familiyani alohida maydonga kiriting.', 'To‘lovlar bo‘limida “0.00” maydoniga summani kiriting, sana avtomatik bugun bo‘ladi, “Qo‘shish”ni bosing.', 'Jami tushum o‘ngdagi yashil kartada darhol qayta hisoblanadi.', 'Saqlash oldin barcha maydonlarni tekshiring; X tugmasi saqlanmagan o‘zgarishni bekor qiladi.'], tip: 'Qo‘shilgan to‘lov reja bo‘yicha emas, haqiqiy olingan tushum hisoblanadi.', imageAlt: 'Xonadon oynasi' },
    search: { kind: 'reports', title: 'Qidiruv oynasi', description: 'Faqat band xonadonlar ichidan ism, familiya yoki xonadon raqami bo‘yicha izlanadi.', steps: ['Izlash maydoniga kamida bitta harf yoki raqam kiriting.', 'Natijalar ko‘rinishi: mijoz, xonadon, qavat va holat.', 'Kerakli natijani bosib xonadon oynasini oching.', 'Natija yo‘q bo‘lsa yozuvni tekshirib, yangi nom yoki raqam bilan qayta qidiring.'], tip: 'Bo‘sh xonadonlar qidiruv natijasiga kirmaydi.', imageAlt: 'Mijoz va xonadon qidiruvi' },
    installments: { kind: 'payments', title: 'Rassrochka boshqaruvi: to‘liq qadamlar', description: 'Qarzni, boshlang‘ich to‘lovni, muddatni, reja to‘lovlarini va qarzdorlikni boshqarish oynasi.', steps: ['Izlash maydonidan mijozni tanlang; tanlangandan keyin barcha maydonlar avtomatik to‘ladi.', 'Shartnoma narxi maydoniga to‘liq narxni, boshlang‘ich to‘lovni va oylar sonini kiriting.', 'Birchi to‘lov sanasi va kechikish imtiyoz kunini belgilang; reja avvalgi to‘lovlarni bekor qilib yangi reja yaratadi.', '“Rejani yaratish” tugmasi shartnoma narxi, boshlang‘ich to‘lov, to‘langan summa va muddatni tekshiradi.', 'Hamma, kechikkan, to‘liq to‘langan va qisman to‘langan filtrlarini ishlating.', 'Bitta qismdan pul olganda “Belgilash” yoki yetkazib berish tugmasidan o‘tib to‘lovni qayd qiling.', 'Qo‘l bilan tushum: summa, sana va izoh kiriting; summa 0 dan katta va shartnoma qoldig‘idan oshmasligi kerak.', 'Tushumni qalam tugmasi bilan tahrirlang yoki o‘chirish ikonkasi bilan o‘chiring; o‘chirish tasdiqlanadi.'], tip: 'Reja yaratishdan oldin haqiqiy to‘lovlar to‘g‘ri qayd etilganini tekshiring. Qoldiq reja tuzilgandan keyin qayta hisoblanadi.', imageAlt: 'Rassrochka rejasini boshqarish' },
    analytics: { kind: 'reports', title: 'Tahlil oynasi', description: 'Tushum, bandlik, mijozlar va vaqt oralig‘idagi ko‘rsatkichlar diagrammada ko‘rinadi.', steps: ['Kun, hafta, oy yoki yil oralig‘ini tanlang.', 'Sana maydonidan kerakli davrni bosing; strelkalar davrni oldinga yoki orqaga siljitadi.', 'Ayrim mijozni topish uchun mijozlar qidiruvini ishlating.', 'Top mijoz yoki diagramma elementini bosib mijozning xonadonini oching.', 'Prognoz tugmasini yoqib kelasi oylar sonini belgilang.'], tip: 'Prognoz real tushumlar asosida taxminiydir va yozilmagan kelajak to‘lovini kafolatlamaydi.', imageAlt: 'Tahlil va prognozlar' },
    users: { kind: 'users', title: 'Foydalanuvchilar: hisoblarga boshqaruv', description: 'Faqat giper-admin o‘z kompaniyasiga xodim qo‘sha oladi.', steps: ['Hisob yaratish maydonlariga login, kamida 5 belgili parol va rolni kiriting.', 'Administrator ma’lumotni tahrirlaydi, Kuzatuvchi faqat ko‘radi.', 'Roldagi ochiladigan ro‘yxatdan huquqni tanlang.', 'Parolni yangilash tugmasi eski parolni ko‘rsatmasdan yangi parol o‘rnatadi.', 'Faolsizlantirish yoki o‘chirish tugmasidan foydalaning; o‘chirish tasdiq talab qiladi.', 'Amallar jurnalini ochib kompaniyadagi harakatlarni tekshiring.'], tip: 'Boshqa kompaniya foydalanuvchilarini ko‘rish yoki o‘zgartirish mumkin emas.', imageAlt: 'Foydalanuvchilar va amallar jurnali' },
    settings: { kind: 'reports', title: 'Ma’lumotlarni boshqarish sozlamalari', description: 'Server holati, eksport, import, sinxronlash va mahalliy ma’lumotlarni bu oynadan boshqarish mumkin.', steps: ['Database Link server yoki offline holatini ko‘rsatadi.', 'Excel eksportini bosing: bino, xonadon, mijoz, shartnoma va tushumlar jadvali yuklanadi.', 'JSON eksporti to‘liq zaxira faylini yuklaydi.', 'Import tugmasi faqat super-admin uchun mavjud; .json faylini tanlab to‘liq ma’lumotni qayta yuklaysiz.', 'Pending ops sonini tekshirib “Sync now” bilan navbatdagi offline amallarni serverga jo‘nating.', 'Mahalliy ma’lumot mavjud bo‘lsa “Mahalliyni serverga ko‘chirish” yoki “Mahalliy ma’lumotni tozalash” tugmalaridan foydalaning.'], tip: 'Import va tozalash eski ma’lumotlarni o‘zgartirishi mumkin. Avval JSON yoki Excel zaxirasini yuklab oling.', imageAlt: 'Ma’lumot sozlamalari' },
    control: { kind: 'users', title: 'Super-admin boshqaruv paneli', description: 'Barcha kompaniyalar, ularning loginlari va platforma jurnali boshqariladi.', steps: ['Kompaniya nomi, giper-admin logini va kamida 5 belgili parolni kirib “Kompaniya yaratish”ni bosing.', 'Har bir kompaniya yonidagi ochiladigan login ro‘yxatini oching.', 'Login qo‘shishda rolni tanlang: giper-admin, administrator yoki kuzatuvchi.', 'Status tugmasi kompaniyani vaqtincha faollashtiradi yoki to‘xtatadi.', 'Parolni yangilash oldin yangi parol maydonini to‘ldiring; eski parol ko‘rinmaydi.', 'Jurnalni ochib amallarni tekshiring; “Jurnalni tozalash”ni tasdiqlanganda tozalash amali o‘zini ham qayd qiladi.', 'Kompaniyani o‘chirish oldidan barcha ma’lumotlar butunlay yo‘qolishini tasdiqlang.'], tip: 'Super-admin faqat /control sahifasidan kiradi. Xavfli o‘chirish amallarini tasdiqlashdan oldin qayta tekshiring.', imageAlt: 'Super-admin paneli' },
  },
  ru: {
    dashboard: { kind: 'company', title: 'Главная: показатели и основные кнопки', description: 'На главной видны общее число квартир, занятость, поступления и задолженность.', steps: ['Нажмите строку поиска, чтобы найти клиента или квартиру.', 'Кнопка разворачивания показывает карту на весь экран; закрыть можно X или ESC.', '“Edit Plan” доступна пользователям с правом изменения данных.', 'Нажмите карту или карточку блока для перехода к этажам.', 'В верхней панели доступны поиск, рассрочка, аналитика, настройки и выход.'], tip: 'Наблюдатель может просматривать данные, но не может изменять их или выполнять платежные действия.', imageAlt: 'Показатели главной страницы' },
    map: { kind: 'buildings', title: 'Редактор карты: все элементы управления', description: 'В 2D или 3D можно создавать, перемещать, масштабировать и менять здания.', steps: ['Кнопка “Создать блок”: введите название, этажи и квартиры на этаже.', 'Выберите блок и откройте структуру для изменения этажей или квартир.', 'В 2D перетащите блок для перемещения и потяните нижний угол для изменения размера.', 'Перейдите в 3D и через настройки измените ширину, глубину, высоту этажей, разделители, тени и подписи.', 'Кнопки +/- меняют масштаб, фон карты можно двигать; цвет блока меняется выбором цвета.', 'Загрузите изображение блока или нажмите переход к этажам.', 'Удаление выполняется только после подтверждения.'], tip: 'Изменения сохраняются после действий редактирования. Сначала выберите нужный блок.', imageAlt: 'Управление редактором карты' },
    block: { kind: 'buildings', title: 'Здание: выбор этажа', description: 'Все этажи выбранного здания отображаются отдельными карточками.', steps: ['Нажмите номер нужного этажа.', 'Кнопка стрелки слева возвращает на главную.', 'Верхняя панель содержит поиск, рассрочку, аналитику, настройки и выход.'], tip: 'Карточка этажа открывает план квартир конкретного этажа.', imageAlt: 'Этажи здания' },
    floor: { kind: 'apartments', title: 'План этажа: редактирование квартир', description: 'Нажатие на квартиру открывает данные о статусе, жильце и платежах.', steps: ['Выберите статус: Свободна, Оплачена, Оплачивается или Просрочена.', 'При статусе Свободна поля жильца скрываются; для занятых квартир заполните имя и фамилию.', 'Измените номер квартиры и нажмите Сохранить.', 'Для полученного платежа введите сумму и нажмите Добавить: дата автоматически будет сегодняшней.', 'Закройте окно крестиком или фоном без сохранения: несохранённые данные не применяются.'], tip: 'Сначала установите подходящий статус квартиры, затем добавьте реальный платеж; наблюдатель сохранение не выполняет.', imageAlt: 'План этажа' },
    apartment: { kind: 'apartments', title: 'Окно квартиры: поля и кнопки', description: 'Здесь изменяются номер, статус, клиент и фактически полученные платежи.', steps: ['В верхнем поле измените номер квартиры.', 'Нажмите карточку нужного статуса; при Свободна поля клиента скрываются.', 'Для занятых статусов заполните имя и фамилию отдельно.', 'Введите сумму в поле 0.00 и нажмите Добавить; дата устанавливается автоматически.', 'Итог поступлений пересчитывается в зеленой карточке.', 'Нажмите Сохранить для записи. Крестик отменяет несохранённые изменения.'], tip: 'Добавленный платеж считается фактическим поступлением, а не плановым взносом.', imageAlt: 'Окно квартиры' },
    search: { kind: 'reports', title: 'Поиск', description: 'Поиск выполняется по занятым квартирам: имя, фамилия или номер.', steps: ['Введите хотя бы одну букву или цифру.', 'Проверьте имя, номер квартиры, этаж и статус в каждом результате.', 'Нажмите нужный результат для открытия квартиры.', 'Если результатов нет, проверьте написание и повторите поиск.'], tip: 'Свободные квартиры не участвуют в этом поиске.', imageAlt: 'Поиск жильца' },
    installments: { kind: 'payments', title: 'Управление рассрочкой', description: 'Полный расчет договора, графика, реальных поступлений и просрочки.', steps: ['Найдите и выберите клиента из списка.', 'Введите цену договора, первоначальный взнос, срок в месяцах, дату первого взноса и льготные дни.', 'Нажмите Создать график: система проверит цену, взнос, срок и остаток и пересчитает график.', 'Фильтры Все, Просрочено, Оплачено и Частично скроют или покажут нужные строки.', 'Нажмите Оплатить у строки графика для фиксации оставшейся суммы по этой строке.', 'В ручном платеже введите положительную сумму и дату, которая не превышает остаток договора, затем добавьте ее.', 'Редактирование ручного платежа доступно карандашом, удаление — корзиной с подтверждением.'], tip: 'До создания графика проверьте реальные платежи. Остаток и просрочка пересчитываются после каждого поступления.', imageAlt: 'Управление рассрочкой' },
    analytics: { kind: 'reports', title: 'Аналитика', description: 'Поступления, занятость и рейтинг клиентов отображаются по выбранному периоду.', steps: ['Выберите день, неделю, месяц или год.', 'Выберите дату в поле периода; стрелки перемещают окно на прошлое или будущее.', 'Используйте поиск клиентов для отбора рейтинга.', 'Нажмите клиента или элемент графика для открытия квартиры.', 'Включите Прогноз и укажите число месяцев.'], tip: 'Прогноз является оценкой по имеющимся данным и не является гарантированным графиком.', imageAlt: 'Аналитика и прогноз' },
    users: { kind: 'users', title: 'Пользователи компании', description: 'Гиперадминистратор создает и управляет учетными записями своей компании.', steps: ['Введите логин, пароль не менее 5 символов и роль.', 'Администратор может изменять данные, Наблюдатель — только просматривать.', 'Нажмите Сохранить или Создать.', 'Кнопкой сброса задайте новый пароль без просмотра старого.', 'Отключите или удалите аккаунт; удаление требует подтверждения.', 'Откройте журнал действий для просмотра истории компании.'], tip: 'Учетные записи и журналы других компаний недоступны.', imageAlt: 'Управление пользователями' },
    settings: { kind: 'reports', title: 'Настройки данных', description: 'Статус базы, резервные копии, импорт, экспорт и синхронизация.', steps: ['Проверьте Database Link: сервер доступен или система работает офлайн.', 'Excel экспортирует квартиры, договоры, жильцов и поступления в таблицу.', 'JSON экспорт сохраняет полный резервный файл.', 'Импорт доступен только супер-администратору и заменяет данные из выбранного .json файла.', 'Sync now отправляет накопившиеся офлайн-действия на сервер.', 'Миграция и очистка локального хранилища доступны только при наличии локальных данных.'], tip: 'Перед импортом или очисткой сделайте резервный экспорт.', imageAlt: 'Настройки данных' },
    control: { kind: 'users', title: 'Панель суперадминистратора', description: 'Создание и управление всеми компаниями, логинами и журналами платформы.', steps: ['Введите название компании, логин гиперадминистратора и пароль не менее 5 символов.', 'Нажмите Создать компанию.', 'Разверните компанию и добавьте пользователей нужной роли.', 'Кнопка статуса временно отключает или активирует компанию.', 'Сброс задает новый пароль старый не показывается.', 'Журнал можно открыть или очистить; очистка сама записывается в журнал.', 'Удаление компании требует подтверждения и удаляет данные без возможности восстановления.'], tip: 'Проверяйте название компании перед удалением или отключением.', imageAlt: 'Панель суперадминистратора' },
  },
  en: {
    dashboard: { kind: 'company', title: 'Dashboard: metrics and main controls', description: 'The dashboard summarizes apartment count, occupancy, revenue, and overdue debt.', steps: ['Use the search bar to find a tenant or apartment.', 'Expand the map for a full-screen view; close it with X or Escape.', 'The Edit Plan button is available only to users who can write data.', 'Click a map block or block card to open its floors.', 'The top bar provides search, installments, analytics, settings, and logout.'], tip: 'A Viewer account can inspect data but cannot change records or complete write actions.', imageAlt: 'Dashboard summary cards' },
    map: { kind: 'buildings', title: 'Map editor: controls', description: 'Create, move, resize, recolor, rotate, and open buildings in 2D or 3D.', steps: ['Create Block asks for the building name, floor count, and apartments per floor.', 'Select a block, then open structure controls to adjust its layout.', 'In 2D, drag to move and use the resize handle to change size.', 'In 3D, adjust width, depth, floor height, separators, shadows, and labels.', 'Use +/- for zoom and drag empty map space to pan; choose a color to recolor a block.', 'Upload a block image or open the block floors from the selected block controls.', 'Deletion requires confirmation.'], tip: 'Select a block before structure, color, image, or delete actions.', imageAlt: 'Map editor controls' },
    block: { kind: 'buildings', title: 'Building: floor selection', description: 'A card is shown for every floor in the selected building.', steps: ['Click a floor number to open its apartment plan.', 'Use the left arrow to return to the dashboard.', 'Top-bar controls provide search, installments, analytics, settings, and logout.'], tip: 'Floor cards only change the view; apartment details open inside each apartment.', imageAlt: 'Building floors' },
    floor: { kind: 'apartments', title: 'Floor plan: apartment editing', description: 'Choose an apartment to edit status, tenant details, and payments.', steps: ['Set status to Empty, Paid, Paying, or Late.', 'Empty hides tenant fields; occupied statuses require a tenant name and surname.', 'Change the apartment number if needed, then choose Save.', 'Enter an amount and choose Add to record an actual payment received today.', 'Close with X or the backdrop to discard unsaved changes.'], tip: 'Set the correct occupied status before adding the tenant and received payment.', imageAlt: 'Apartment floor plan' },
    apartment: { kind: 'apartments', title: 'Apartment window', description: 'This window manages the number, status, tenant, and actual received payments.', steps: ['Change the apartment number in the top field.', 'Choose a status card; Empty hides tenant fields.', 'Enter tenant first and last names for occupied apartments.', 'Enter an amount in 0.00 and choose Add; the date is today.', 'Review the recalculated Total Paid badge.', 'Choose Save to apply changes or X to discard unsaved changes.'], tip: 'A manually added payment is a real receipt, not a planned installment.', imageAlt: 'Apartment details window' },
    search: { kind: 'reports', title: 'Search window', description: 'Search occupied apartments by tenant name, surname, or apartment number.', steps: ['Enter at least one letter or number.', 'Review tenant, apartment number, floor, and status in each result.', 'Click a result to open the apartment details.', 'If no results appear, check the spelling or try the apartment number.'], tip: 'Empty apartments are excluded from search results.', imageAlt: 'Tenant search' },
    installments: { kind: 'payments', title: 'Installment manager', description: 'Configure contracts and schedules, record receipts, and review overdue balances.', steps: ['Search and select a tenant.', 'Enter contract price, down payment, term in months, first due date, and grace days.', 'Choose Generate Schedule to validate the contract and rebuild all planned installments.', 'Filter All, Overdue, Paid, or Partial rows.', 'Use the payment action on an installment row to record the remaining amount.', 'Use manual payment for an amount, date, and note; the amount must be positive and no more than the contract balance.', 'Edit a receipt with the pencil or delete it with the trash button and confirmation.'], tip: 'Verify actual receipts before generating a schedule; balance and overdue status recalculate after each payment.', imageAlt: 'Installment schedule controls' },
    analytics: { kind: 'reports', title: 'Analytics window', description: 'Revenue, occupancy, tenant totals, and selected-period charts.', steps: ['Choose Day, Week, Month, or Year.', 'Choose a date to position the period; arrows move backward or forward.', 'Use tenant search to filter the ranked tenant list.', 'Select a tenant or chart item to open the apartment.', 'Enable Prediction and choose the forecast window.'], tip: 'Prediction is an estimate based on existing data, not a guarantee of future receipts.', imageAlt: 'Analytics charts' },
    users: { kind: 'users', title: 'Company users', description: 'A Hyper-admin creates and manages accounts only for their company.', steps: ['Enter a username, password of at least 5 characters, and role.', 'Choose Admin for editing or Viewer for read-only access.', 'Create or save the account.', 'Use Reset Password to set a new password; the old one remains hidden.', 'Disable or delete an account; deletion requires confirmation.', 'Open the activity log to review company actions.'], tip: 'Users and logs from other companies are inaccessible.', imageAlt: 'User management' },
    settings: { kind: 'reports', title: 'Data management settings', description: 'Server status, backup export, JSON import, Excel export, and offline sync.', steps: ['Check Database Link for server or offline status.', 'Export Excel downloads apartments, contracts, tenants, and receipts.', 'Export JSON downloads a full backup.', 'JSON import is super-admin only and replaces database content from the chosen file.', 'Use Sync now to send pending offline operations to the server.', 'Migrate or clear local data only when local data is present.'], tip: 'Create a backup before import or local-data clearing.', imageAlt: 'Data settings' },
    control: { kind: 'users', title: 'Super-admin control panel', description: 'Create and manage companies, company logins, and platform activity logs.', steps: ['Enter company name, hyper-admin username, and password of at least 5 characters.', 'Choose Create Company.', 'Expand a company to add Hyper-admin, Admin, or Viewer logins.', 'Use Status to enable or disable the company.', 'Reset Password sets a new password; the old password is never visible.', 'Open or clear the platform/company activity log; clearing itself is logged.', 'Deleting a company requires confirmation and permanently removes its data.'], tip: 'Verify the company name before disabling or deleting it.', imageAlt: 'Super-admin control panel' },
  },
};

const GuideIllustration: React.FC<{ kind: GuideKind; alt: string }> = ({ kind, alt }) => (
  <svg viewBox="0 0 640 280" role="img" aria-label={alt} className="h-full w-full">
    <defs>
      <linearGradient id="guide-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#eff6ff" />
        <stop offset="100%" stopColor="#dbeafe" />
      </linearGradient>
      <linearGradient id="guide-building" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
    </defs>
    <rect width="640" height="280" rx="24" fill="url(#guide-bg)" />
    <circle cx="548" cy="48" r="36" fill="#bfdbfe" opacity="0.7" />
    <circle cx="82" cy="225" r="46" fill="#bfdbfe" opacity="0.55" />
    {kind === 'company' && <>
      <rect x="174" y="46" width="292" height="188" rx="22" fill="#fff" />
      <rect x="194" y="66" width="252" height="38" rx="12" fill="#2563eb" />
      <rect x="211" y="78" width="118" height="13" rx="6" fill="#fff" opacity="0.9" />
      <rect x="194" y="120" width="116" height="88" rx="14" fill="#eff6ff" />
      <rect x="330" y="120" width="116" height="88" rx="14" fill="#f1f5f9" />
      <circle cx="252" cy="148" r="14" fill="#2563eb" />
      <circle cx="388" cy="148" r="14" fill="#64748b" />
      <rect x="218" y="171" width="68" height="9" rx="4" fill="#93c5fd" />
      <rect x="354" y="171" width="68" height="9" rx="4" fill="#cbd5e1" />
      <rect x="228" y="188" width="48" height="7" rx="3" fill="#bfdbfe" />
      <rect x="364" y="188" width="48" height="7" rx="3" fill="#e2e8f0" />
    </>}
    {kind === 'users' && <>
      <rect x="150" y="38" width="340" height="204" rx="20" fill="#fff" />
      <rect x="174" y="58" width="292" height="30" rx="10" fill="#eff6ff" />
      <circle cx="192" cy="73" r="7" fill="#2563eb" />
      <rect x="210" y="68" width="98" height="9" rx="4" fill="#94a3b8" />
      {[0, 1, 2].map((row) => <g key={row}>
        <circle cx="198" cy={119 + row * 42} r="12" fill={row === 0 ? '#bfdbfe' : '#e2e8f0'} />
        <rect x="222" y={113 + row * 42} width="108" height="9" rx="4" fill="#94a3b8" />
        <rect x="222" y={128 + row * 42} width="72" height="7" rx="3" fill="#cbd5e1" />
        <rect x="366" y={109 + row * 42} width="74" height="24" rx="12" fill={row === 1 ? '#dcfce7' : '#dbeafe'} />
        <circle cx="382" cy={121 + row * 42} r="4" fill={row === 1 ? '#22c55e' : '#3b82f6'} />
      </g>)}
      <circle cx="454" cy="72" r="16" fill="#2563eb" />
      <path d="M454 64v16M446 72h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </>}
    {kind === 'buildings' && <>
      <path d="M125 222h390" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
      <rect x="171" y="111" width="94" height="111" rx="8" fill="#60a5fa" />
      <rect x="281" y="73" width="112" height="149" rx="8" fill="url(#guide-building)" />
      <rect x="410" y="130" width="78" height="92" rx="8" fill="#3b82f6" />
      {[0, 1, 2].map(row => [0, 1].map(col => <rect key={`a-${row}-${col}`} x={188 + col * 37} y={128 + row * 28} width="17" height="14" rx="3" fill="#dbeafe" />))}
      {[0, 1, 2, 3].map(row => [0, 1, 2].map(col => <rect key={`b-${row}-${col}`} x={298 + col * 28} y={91 + row * 28} width="15" height="14" rx="3" fill="#dbeafe" />))}
      {[0, 1, 2].map(row => [0, 1].map(col => <rect key={`c-${row}-${col}`} x={425 + col * 31} y={146 + row * 23} width="13" height="12" rx="3" fill="#dbeafe" />))}
      <path d="M311 222v-30h52v30" fill="#1e40af" opacity="0.75" />
    </>}
    {kind === 'apartments' && <>
      <rect x="186" y="37" width="268" height="206" rx="20" fill="#fff" />
      <rect x="205" y="56" width="230" height="30" rx="10" fill="#eff6ff" />
      <rect x="219" y="66" width="94" height="10" rx="5" fill="#60a5fa" />
      {[0, 1, 2].map(row => [0, 1, 2, 3].map(col => {
        const fills = ['#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2'];
        const fill = fills[(row * 4 + col) % fills.length];
        return <g key={`${row}-${col}`}>
          <rect x={207 + col * 56} y={101 + row * 42} width="47" height="34" rx="8" fill={fill} />
          <rect x={217 + col * 56} y={111 + row * 42} width="26" height="6" rx="3" fill="#94a3b8" />
          <rect x={217 + col * 56} y={122 + row * 42} width="16" height="5" rx="2" fill="#cbd5e1" />
        </g>;
      }))}
    </>}
    {kind === 'payments' && <>
      <rect x="154" y="42" width="332" height="196" rx="20" fill="#fff" />
      <rect x="178" y="64" width="126" height="72" rx="14" fill="#eff6ff" />
      <circle cx="211" cy="99" r="17" fill="#2563eb" />
      <path d="M211 90v18m-6-13h9a4 4 0 0 1 0 8h-7" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="239" y="91" width="47" height="8" rx="4" fill="#93c5fd" />
      <rect x="239" y="106" width="34" height="7" rx="3" fill="#bfdbfe" />
      <path d="M337 137l28-28 25 15 38-42" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="428" cy="82" r="7" fill="#10b981" />
      {[0, 1, 2, 3].map(bar => <rect key={bar} x={184 + bar * 65} y={207 - [24, 48, 34, 68][bar]} width="34" height={[24, 48, 34, 68][bar]} rx="6" fill={bar === 3 ? '#2563eb' : '#93c5fd'} />)}
      <path d="M174 208h276" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
    </>}
    {kind === 'reports' && <>
      <rect x="140" y="42" width="360" height="198" rx="20" fill="#fff" />
      {[0, 1, 2].map(card => <g key={card}>
        <rect x={162 + card * 105} y="61" width="90" height="50" rx="12" fill={card === 1 ? '#eff6ff' : '#f8fafc'} />
        <rect x={174 + card * 105} y="73" width="38" height="7" rx="3" fill="#94a3b8" />
        <rect x={174 + card * 105} y="87" width="52" height="13" rx="5" fill={card === 1 ? '#2563eb' : '#64748b'} />
      </g>)}
      <path d="M170 207v-34l38-20 38 14 42-41 38 22 42-30 52 16" fill="none" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M170 213h296" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
      {[0, 1, 2, 3, 4, 5].map(dot => <circle key={dot} cx={208 + dot * 32} cy={[173, 153, 167, 126, 148, 118][dot]} r="5" fill="#10b981" />)}
    </>}
  </svg>
);

export const UsageGuideModal: React.FC<{ lang: Language; onClose: () => void; context?: GuideContext }> = ({ lang, onClose, context }) => {
  const [index, setIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const copy = guideCopy[lang];
  const slides = context ? [contextGuides[lang][context]] : copy.slides;
  const slide = slides[index] || slides[0];

  useEffect(() => {
    setIndex(0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setIndex(current => Math.max(0, current - 1));
      if (event.key === 'ArrowRight') setIndex(current => Math.min(copy.slides.length - 1, current + 1));
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [slides.length, onClose, context]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="usage-guide-title"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-7">
          <div>
            <h2 id="usage-guide-title" className="text-sm font-black text-slate-900 dark:text-white sm:text-base">{context ? slide.title : copy.title}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.subtitle}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            title={copy.close}
            aria-label={copy.close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4 sm:px-7 sm:py-5">
          <div className="mb-5 h-36 overflow-hidden rounded-xl border border-blue-100 dark:border-slate-700 sm:h-44">
            <GuideIllustration kind={slide.kind} alt={slide.imageAlt} />
          </div>
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {index + 1} / {slides.length} {copy.step}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
            </div>
          </div>
          <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">{slide.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{slide.description}</p>
          <ol className="mt-4 space-y-2.5">
            {slide.steps.map((step, stepIndex) => (
              <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">{stepIndex + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">{slide.tip}</p>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 dark:border-slate-800 sm:px-7">
          <div className="flex gap-1.5" aria-label={copy.title}>
            {slides.map((item, dotIndex) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`${copy.step} ${dotIndex + 1}: ${item.title}`}
                aria-current={dotIndex === index ? 'step' : undefined}
                className={`h-2 rounded-full transition-all ${dotIndex === index ? 'w-6 bg-blue-600' : 'w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(current => current - 1)}
                className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={15} />
                <span className="hidden sm:inline">{copy.previous}</span>
              </button>
            )}
            {index < slides.length - 1 ? (
              <button
                type="button"
                onClick={() => setIndex(current => current + 1)}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white transition hover:bg-blue-700"
              >
                {copy.next}
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700"
              >
                {copy.finish}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
};
