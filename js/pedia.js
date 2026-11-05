'use strict';
// ============================================================
//  Кипропедия — справочник в духе Цивилопедии.
//  Статьи «Основы» написаны вручную, остальное собирается из данных.
// ============================================================

const pl = (id, text) => `<a href="#" data-pedia="${id}">${text}</a>`;

const PEDIA_ARTICLES = [
  { id: 'basics', icon: '🏛️', title: 'Как играть', html: () => `
    <p>Вы ведёте поселение на Кипре сквозь эпохи — от медного века к бронзовому. Это градостроительный симулятор,
    в котором самый ценный ресурс добывается не руками, а головой.</p>
    <h4>Основной цикл</h4>
    <ol>
      <li><b>Собирайте и стройте.</b> Клик по лесу, холмам или равнине даёт немного дерева, камня или зерна.
      Поставьте ${pl('b:field', 'поля')}, ${pl('b:goatpen', 'козьи загоны')}, ${pl('b:lumber', 'лесорубов')} и ${pl('b:quarry', 'каменоломни')} — дальше ресурсы пойдут сами.</li>
      <li><b>Растите население.</b> ${pl('b:house', 'Жилища')} дают места, жители приходят, если есть зерно, и работают в зданиях. См. ${pl('a:pop', 'Жители и работники')}.</li>
      <li><b>Учитесь.</b> Кнопка «📜 Учиться» запускает раунд карточек. Каждый верный ответ приносит ${pl('a:logos', 'λ Логос')}.</li>
      <li><b>Тратьте Логос на главное:</b> ${pl('a:techs', 'знания')}, ${pl('a:specials', 'спецстроения')},
      ${pl('a:upgrade', 'улучшение зданий')} на 4, 6, 8 и 10-й уровень и ${pl('a:epochs', 'переход в новую эпоху')}.</li>
      <li><b>Или ускоряйтесь с первых минут:</b> ${pl('a:religion', 'обряды')} превращают λ в ресурсы, жителей и временные благословения.
      Учиться сразу не обязательно — можно сначала погонять город и упереться в λ позже.</li>
      <li><b>Расширяйте ${pl('a:storage', 'склады')}</b> — крупные цены просто не поместятся в маленькие амбары.</li>
    </ol>
    <h4>Сколько это займёт</h4>
    <p>Переход из медного века в бронзовый рассчитан на несколько дней игры. Сам переход стоит ${EPOCHS[0].advance.logos} λ,
    а знания и спецстроения можно взять либо за λ (быстро), либо трудом — горой обычных ресурсов. Чем больше учитесь, тем быстрее идёте. Город работает и когда игра закрыта — до ${BALANCE.offlineMaxHours} часов, пока не заполнятся склады.</p>
    <p class="tip">Совет: учите понемногу, но каждый день. Карточки, которые пора повторить, дают в 2.5 раза больше Логоса, чем досрочные.</p>` },

  { id: 'logos', icon: 'λ', title: 'Логос (λ)', html: () => `
    <p><b>Λόγος</b> — «слово, речь, разум». В игре это энергия знания. Его <b>нельзя</b> добыть зданиями, торговлей или козами —
    только правильными ответами на карточки.</p>
    <h4>Сколько дают карточки</h4>
    <table class="pt">
      <tr><td>Новая карточка или пора повторить</td><td><b>5 λ</b></td></tr>
      <tr><td>Досрочное повторение (ещё не пора)</td><td><b>2 λ</b></td></tr>
      <tr><td>Серия верных ответов</td><td>+10% за каждый ответ подряд, до ×2</td></tr>
      <tr><td>Святилища и писцы</td><td>общий бонус, виден в окне раунда</td></tr>
    </table>
    <p>Ошибка обнуляет серию. Логос не ограничен складами и не теряется при набегах.</p>
    <h4>На что тратится</h4>
    <ul>
      <li>${pl('a:techs', 'Знания')} — от 30 до 200 λ (или трудом, без λ);</li>
      <li>${pl('a:specials', 'Спецстроения')} — от 80 до 400 λ (или трудом, без λ);</li>
      <li>${pl('a:upgrade', 'Улучшение зданий')} на 4, 6, 8 и 10-й уровень — только за λ, и именно они меняют облик здания;</li>
      <li>${pl('a:religion', 'Обряды')} — от 5 λ: мгновенные ресурсы и жители, удвоение производства на время;</li>
      <li>${pl('a:epochs', 'Переход эпохи')} — ${EPOCHS[0].advance.logos} λ в бронзовый век, ${EPOCHS[1].advance.logos} λ дальше.</li>
    </ul>
    <p class="tip">Быстрый старт: первые λ можно сразу вложить в обряды — «Совет старейшин» (раз в минуту), благословения ×2 — или в первое знание.</p>` },

  { id: 'cards', icon: '🃏', title: 'Карточки и повторение', html: () => `
    <p>Раунд — ${Decks.settings(Game.state).roundSize} карточек (новые слова сначала показываются, а в конце раунда проверяются).
    Размер раунда и число новых слов настраиваются во вкладке «Карточки».</p>
    <h4>Виды заданий</h4>
    <table class="pt">
      <tr><td>🆕 Новая карточка</td><td>Знакомство: слово, произношение, перевод.</td></tr>
      <tr><td>🔤 Что это значит?</td><td>Греческое слово → выбрать перевод из четырёх.</td></tr>
      <tr><td>🇬🇷 Как по-гречески?</td><td>Перевод → выбрать греческое слово.</td></tr>
      <tr><td>🧩 Соберите слово</td><td>Короткое слово — из букв, длинное — из слогов; кусков не больше шести, плюс пара лишних.
      Можно печатать с греческой клавиатуры: слог выбирается, когда набран целиком.</td></tr>
      <tr><td>🔗 Пары</td><td>Соединить четыре слова с переводами.</td></tr>
      <tr><td>🤔 Вспомните сами</td><td>Открыть ответ и честно оценить себя.</td></tr>
    </table>
    <p>Чем лучше вы знаете карточку, тем сложнее задание: новые слова — выбор перевода, знакомые — сборка из букв.</p>
    <h4>Как слово становится выученным</h4>
    <ol>
      <li><b>Знакомство.</b> Новое слово показывается и в конце раунда проверяется.</li>
      <li><b>Заучивание.</b> Слово возвращается в ближайших раундах (уже через 30 секунд), пока вы не ответите верно
      ${Decks.settings(Game.state).learnSteps} раза. Ошибка откатывает на шаг назад. В таблице колоды это видно как ●●○.</li>
      <li><b>Выучено ✓.</b> Дальше слово почти не мешает новым: пара коротких повторов, а потом очень длинные паузы.</li>
    </ol>
    <h4>Настройки (вкладка «Карточки»)</h4>
    <table class="pt">
      <tr><td>Верных ответов до «выучено»</td><td>2–5. Меньше — быстрее к новым словам, больше — надёжнее.</td></tr>
      ${Object.values(APPETITES).map(a => `<tr><td>Повторять: ${a.name}</td><td>${a.desc}: ${a.intervals.map(fmtDur).join(' → ')}</td></tr>`).join('')}
      <tr><td>Новых слов за раунд</td><td>сколько незнакомых слов добавлять в каждый раунд.</td></tr>
    </table>
    <p>Если выученное слово забылось, оно снова попадает в заучивание, но достаточно одного верного ответа, чтобы вернуть его.
    Счётчик на кнопке «📜 Учиться» показывает, сколько карточек ждут.</p>
    <h4>Клавиши в раунде</h4>
    <p><kbd>1</kbd>–<kbd>4</kbd> — вариант ответа, <kbd>Enter</kbd> — дальше, <kbd>Пробел</kbd> — показать ответ,
    <kbd>Backspace</kbd> — стереть букву, <kbd>Esc</kbd> — выйти.</p>
    <p>🔊 — произношение. Если звука нет, в Windows добавьте греческий голос: Параметры → Время и язык → Речь → Добавить голоса → Ελληνικά.</p>` },

  { id: 'import', icon: '📥', title: 'Импорт колод', html: () => `
    <h4>Встроенные колоды</h4>
    <p>Кроме стартового набора «Кипр» (перевод на русский) в игре есть ~420 слов уровня A1 (перевод на английский),
    разбитых на колоды: существительные мужского и женского рода (в подсказке — артикль), люди и профессии,
    наречия и числа, глаголы на -ω, на -άω/-ώ и на -μαι. Все включены по умолчанию — отключите лишние галочкой.
    Варианты ответа берутся из той же колоды, так что язык перевода не подсказывает ответ.</p>
    <h4>Своя колода</h4>
    <p>Вкладка «Карточки» → «Импорт колоды». Вставьте текст или выберите файл (.txt, .tsv, .csv, .json).
    Колоду можно выключить галочкой — тогда её карточки не попадут в раунды.</p>
    <h4>Форматы</h4>
    <pre>σπίτι	дом	spíti        ← табуляция (как экспорт из Anki)
νερό ; вода ; neró         ← точка с запятой
ψωμί — хлеб                ← тире
θάλασσα, море              ← запятая
# строки с решёткой пропускаются</pre>
    <pre>[{"front": "σπίτι", "back": "дом", "hint": "spíti"}]
{"name": "Моя колода", "cards": [["νερό", "вода"]]}</pre>
    <p>Третья колонка — подсказка (транслитерация, пример). Греческая сторона определяется автоматически и становится «лицом» карточки,
    даже если в файле она во второй колонке. HTML-теги из Anki вычищаются.</p>
    <h4>Из Anki</h4>
    <p>Файл → Экспорт → «Notes in Plain Text (.txt)», снять галочку «Include HTML» — и импортировать получившийся файл.</p>
    <p class="tip">Игра не навязывает греческий: подойдут карточки на любом языке. Но сборка слова, озвучка и шрифт заточены под греческий.</p>` },

  { id: 'pop', icon: '👥', title: 'Жители и работники', html: () => `
    <p><b>Места.</b> Жилище даёт 4 места на 1-м уровне и +1 за каждый следующий; в бронзовом веке дома из сырцового кирпича
    дают ещё +2. Знания «Каменные основания» и «Тёсаная кладка» добавляют места каждому дому.</p>
    <p><b>Рост.</b> Пока есть свободные места и больше 5 зерна, каждые ${BALANCE.growthTime} секунд приходит новый житель
    (быстрее со ${pl('b:shrine1', 'Святилищем богини плодородия')} и во время ${pl('a:religion', 'Праздника плодородия')}).
    Обряд «Зов поселенцев» приводит жителей сразу.</p>
    <p><b>Еда.</b> Каждый житель съедает ${BALANCE.foodPerPop} зерна в секунду. Если зерно кончилось — начинается голод и люди уходят.</p>
    <p><b>Работники.</b> Каждому зданию нужны работники: базовое число плюс один за каждые два уровня улучшения.
    Работают сами жители — отдельно нанимать никого не нужно.</p>
    <h4>Как читать верхнюю панель</h4>
    <table class="pt">
      <tr><td>👥 12 из 16 мест</td><td>в поселении 12 жителей, в домах есть место для 16 — значит, люди ещё будут прибывать.</td></tr>
      <tr><td>⚒ 10 работают</td><td>зданиям нужно 10 работников, жителей хватает — всё работает в полную силу.</td></tr>
      <tr><td>⚒ 18 нужно · 67%</td><td>зданиям нужно 18 работников, а жителей 12: все здания работают на 67%. Стройте и улучшайте жилища.</td></tr>
    </table>` },

  { id: 'storage', icon: STORAGE_ICON, title: 'Склады', html: () => `
    <p>Каждый ресурс хранится отдельно, но предел у всех общий: ${BALANCE.baseStorage} без построек.
    ${pl('b:storehouse', 'Склад')} добавляет +250 за каждый уровень; знания и спецстроения увеличивают вместимость ещё.</p>
    <p>Когда склад полон, ресурс подсвечивается красным и дальше не копится. <b>Цена, которая больше вместимости,
    недоступна вовсе</b> — поэтому перед большими стройками и переходом эпохи придётся строить и улучшать склады.</p>
    <p>Текущая вместимость — значок ${STORAGE_ICON} в верхней панели.</p>` },

  { id: 'upgrade', icon: '⬆️', title: 'Улучшение зданий', html: () => {
    const ex = 'field';
    let rows = '';
    for (let L = 2; L <= 10; L++) {
      const { cost, logos } = Game.upgradeCost(ex, L);
      rows += `<tr class="${logos ? 'lv-logos' : ''}"><td>${L}</td><td>${Game.icons(ex, L).join('')}</td><td>${num(BUILDINGS[ex].prod.food * Game.levelMult(L))}/с <span class="dim">(+${Math.round((Game.levelMult(L) - 1) * 100)}%)</span></td>
        <td>${logos ? `<b>λ ${logos}</b> <span class="dim">· новый облик</span>` : Object.entries(cost).map(([k, v]) => `${RES[k].icon} ${v}`).join(' ')}</td></tr>`;
    }
    return `
    <p>Кликните по зданию, чтобы увидеть, что даст следующий уровень, или <b>Shift+клик</b>, чтобы улучшить сразу.</p>
    <h4>Два вида уровней</h4>
    <ul>
      <li><b>Уровни труда</b> (2, 3, 5, 7, 9) — только за обычные ресурсы. Облик здания не меняется.</li>
      <li><b>Уровни мудрости</b> (4, 6, 8, 10) — <b>только за λ</b>, без ресурсов. Именно они меняют облик здания на карте:
      хижина становится домом, росток — колосьями, а на высоких уровнях вырастает целая группа построек в золотой рамке.</li>
    </ul>
    <h4>Закон убывающей отдачи</h4>
    <ul>
      <li>Каждый уровень добавляет <b>+${Math.round(BALANCE.upProdStep * 100)}% к базовому выпуску</b>: 2-й — 120%, 3-й — 140%, 10-й — 280%.</li>
      <li>Цена ресурсами растёт <b>в ${BALANCE.upCostGrowth} раза за каждый уровень</b> — и за λ-уровни тоже, хоть их ресурсами и не оплачивают.
      Поэтому 5-й уровень стоит как 3-й × ${BALANCE.upCostGrowth} × ${BALANCE.upCostGrowth}.</li>
      <li>λ-уровни: 4-й — базовая цена, каждый следующий в ${BALANCE.logosGrowth} раза дороже, 8-й и 10-й — ещё вдвое.</li>
      <li>С ${BALANCE.copperFromLevel}-го уровня нужна медь, с ${BALANCE.bronzeFromLevel}-го — бронза.</li>
      <li>Предел уровня зависит от эпохи: в медном веке — ${EPOCHS[0].maxLevel}, в бронзовом — ${EPOCHS[1].maxLevel}.</li>
    </ul>
    <p>Новое здание того же типа тоже дорожает: каждое следующее в ${BALANCE.buildCostGrowth} раза. Выбор между «ещё одно поле» и «улучшить старое» — ваш.</p>
    <h4>Пример: поле</h4>
    <table class="pt levels"><tr><th>Ур.</th><th>Облик</th><th>Зерно</th><th>Цена улучшения</th></tr>${rows}</table>
    <p class="dim">Без учёта бонусов от знаний и спецстроений.</p>`;
  } },

  { id: 'techs', icon: '📜', title: 'Знания', html: () => `
    <p>Знания открывают новые здания и дают постоянные бонусы. Некоторые требуют других знаний.
    Чтобы перейти в новую эпоху, нужно изучить <b>все</b> знания текущей.</p>
    <h4>Два пути</h4>
    <ul>
      <li><b>За λ</b> — Логос плюс немного ресурсов. Быстро: награда за учёбу.</li>
      <li><b>Трудом</b> — без λ, но ресурсная часть цены ×${BALANCE.laborTechMult}, а каждый λ заменяется ${BALANCE.laborPerLogos} единицами
      дерева и камня (в бронзовом веке — камня, меди и дерева). Долго, нужны большие склады, зато можно и без карточек.</li>
    </ul>
    <p>Так же устроены ${pl('a:specials', 'спецстроения')}, только их цена трудом — ×${BALANCE.laborSpecialMult}.</p>
    ${EPOCHS.map((E, e) => {
      const list = TECHS.filter(t => t.epoch === e);
      return list.length ? `<h4>${E.name}</h4><ul>${list.map(t => `<li>${t.icon} ${pl('t:' + t.id, t.name)} — ${t.desc}</li>`).join('')}</ul>` : '';
    }).join('')}` },

  { id: 'specials', icon: '✨', title: 'Спецстроения', html: () => `
    <p>Уникальные постройки по мотивам реальных памятников Кипра. Каждое можно возвести один раз; они дороги, но заметно меняют экономику.
    Некоторые нужны для перехода в новую эпоху. Улучшать их не нужно.</p>
    <p>Как и ${pl('a:techs', 'знания')}, их можно строить двумя путями: за λ и ресурсы или трудом — без λ, но ресурсов примерно вдвое-втрое больше.</p>
    ${EPOCHS.map((E, e) => {
      const list = Object.entries(BUILDINGS).filter(([, B]) => B.special && B.epoch === e);
      return list.length ? `<h4>${E.name}</h4><ul>${list.map(([id, B]) => `<li>${B.icon} ${pl('b:' + id, B.name)} — ${B.desc}</li>`).join('')}</ul>` : '';
    }).join('')}` },

  { id: 'epochs', icon: '⏳', title: 'Эпохи и переход', html: () => `
    <p>Переход в новую эпоху — главная цель. Условия смотрите во вкладке «Эпоха»: население, обязательные спецстроения,
    все знания эпохи, ресурсы и λ. Ресурсы и λ при переходе списываются.</p>
    <p>С новой эпохой все здания меняют облик (хижины становятся домами из сырцового кирпича), поднимается предел улучшения,
    появляются новые ресурсы, знания и спецстроения.</p>
    <ul>${EPOCHS.map((E, i) => `<li>${pl('e:' + i, E.name)} <span class="dim">${E.sub}</span>${E.locked ? ' — в следующей версии' : ''}</li>`).join('')}</ul>` },

  { id: 'events', icon: '🐐', title: 'События: козы и набеги', html: () => `
    <h4>Беглые козы</h4>
    <p>Время от времени на карте появляется коза. Кликните по ней, пока она не ушла в горы (около 14 секунд), — она принесёт
    зерно, дерево, камень, сыр или изделия: примерно столько, сколько поселение производит за 45 секунд.
    ${pl('b:sp_troodos', 'Пастушьи тропы Троодоса')} делают коз частыми гостями и щедрее на 60%.</p>
    <h4>Набеги «народов моря»</h4>
    <p>В бронзовом веке примерно раз в 15–25 минут игры с моря приходят разорители и уносят 15% всех запасов
    (кроме λ). Защищают от набегов только ${pl('b:sp_walls', 'Циклопические стены')} — с ними набег отбит, а трофеи достаются вам.
    Пока игра закрыта, набегов нет.</p>` },

  { id: 'goats', icon: '🐏', title: 'Козы и муфлоны Кипра', html: () => `
    <p>Козы прибыли на Кипр вместе с первыми земледельцами больше десяти тысяч лет назад — на лодках, вместе с овцами,
    свиньями и даже ланями. С тех пор козы повсюду: на прибрежных холмах, в деревнях, на склонах Троодоса.</p>
    <p>Из козьего и овечьего молока на острове веками делают сыр; самый известный кипрский сыр — <b>халлуми</b>, хорошо
    держащий форму на огне.</p>
    <p>В горах живёт <b>кипрский муфлон</b> (по-гречески <i>αγρινό</i>, агрино) — дикий баран с огромными закрученными рогами,
    потомок древних одомашненных овец, одичавших на острове. Сегодня он охраняется и считается одним из символов Кипра.</p>
    <p class="tip">Пара слов для карточек: η κατσίκα — коза, το τυρί — сыр, το γάλα — молоко, ο βοσκός — пастух.</p>` },

  { id: 'religion', icon: '🛐', title: 'Религия и обряды', html: () => `
    <p>Обряды — вкладка «Обряды». Это главный способ потратить Логос <b>сразу</b>: получить ресурсы и жителей немедленно
    или удвоить производство на несколько минут. Благословения продлеваются повторным обрядом (до ${BALANCE.maxBuffMinutes} минут),
    но не усиливаются. Активные благословения видны в верхней панели с таймером.</p>
    <table class="pt">${RITUALS.map(R => `<tr><td>${R.icon} ${R.name}</td><td>${R.desc}<br><span class="dim">${[R.logos ? 'λ ' + R.logos : 'без λ', ...Object.entries(R.cost || {}).map(([k, v]) => RES[k].icon + ' ' + v)].join(' · ')}${R.req ? ` · нужно: ${pl('b:' + R.req, BUILDINGS[R.req].name)}` : ''}${R.epoch ? ' · бронзовый век' : ''}</span></td></tr>`).join('')}</table>
    <p class="dim">Обряды прошлой эпохи в новой стоят в 1.5 раза больше λ.</p>
    <h4>Религия медного века</h4>
    <p>Письменных источников нет — только находки. Главный образ эпохи — фигурки с раскинутыми руками, похожие на крест:
    их резали из голубовато-зелёного речного камня и носили как подвески. В Киссонерге нашли глиняную фигурку роженицы
    и «ритуальный клад» — модель здания с фигурками внутри, словно застывший обряд. Чаще всего эти находки связывают
    с культом плодородия: рождение, урожай, приплод стад.</p>
    <h4>Религия бронзового века</h4>
    <p>Появляются настоящие святилища. В Энкоми почитают бога в рогатом шлеме и «Слиткового бога», стоящего на медном слитке, —
    покровителя главного богатства острова. В святилищах Энкоми и Китиона находят бычьи черепа, обработанные так, чтобы их
    можно было надеть: жрецы, по-видимому, выступали в бычьих масках. Около 1200 г. до н. э. в Палепафосе основано святилище богини, которую греки позже назовут Афродитой.</p>` },

  { id: 'keys', icon: '⌨️', title: 'Управление', html: () => `
    <table class="pt">
      <tr><td>Клик по клетке</td><td>собрать ресурс / открыть здание / поставить здание</td></tr>
      <tr><td><kbd>Shift</kbd>+клик по зданию</td><td>улучшить сразу</td></tr>
      <tr><td><kbd>Shift</kbd>+клик при строительстве</td><td>поставить и строить ещё</td></tr>
      <tr><td><kbd>U</kbd> в окне здания</td><td>улучшить</td></tr>
      <tr><td>Правый клик / <kbd>Esc</kbd></td><td>отменить строительство, закрыть окно</td></tr>
      <tr><td><kbd>F1</kbd> или <kbd>?</kbd></td><td>Кипропедия</td></tr>
      <tr><td><b>?</b> рядом с названием</td><td>статья о здании или знании</td></tr>
    </table>
    <p>Игра сохраняется сама каждые несколько секунд в этом браузере. Сброс — во вкладке «Карточки».</p>` },
];

const Pedia = {
  current: 'a:basics',

  open(id) {
    if (id) this.current = id;
    $('#pedia').classList.remove('hidden');
    if (!this.bound) {
      this.bound = true;
      $('#pedia').addEventListener('click', e => {
        if (e.target.id === 'pedia' || e.target.closest('[data-pedia-close]')) return this.close();
        const a = e.target.closest('[data-pedia]');
        if (a) { e.preventDefault(); this.current = a.dataset.pedia; this.render(); }
      });
    }
    this.render();
  },
  close() { $('#pedia').classList.add('hidden'); },

  nav() {
    const groups = [
      { title: 'Основы', items: PEDIA_ARTICLES.map(a => ({ id: 'a:' + a.id, icon: a.icon, title: a.title })) },
      { title: 'Ресурсы', items: RES_KEYS.map(k => ({ id: 'r:' + k, icon: RES[k].icon, title: RES[k].name })).concat([{ id: 'r:logos', icon: 'λ', title: 'Логос' }]) },
      { title: 'Здания', items: Object.entries(BUILDINGS).filter(([, B]) => !B.special).map(([id, B]) => ({ id: 'b:' + id, icon: Game.icons(id, 1)[0], title: B.name })) },
      { title: 'Спецстроения', items: Object.entries(BUILDINGS).filter(([, B]) => B.special).map(([id, B]) => ({ id: 'b:' + id, icon: B.icon, title: B.name })) },
      { title: 'Знания', items: TECHS.map(t => ({ id: 't:' + t.id, icon: t.icon, title: t.name })) },
      { title: 'Эпохи', items: EPOCHS.map((E, i) => ({ id: 'e:' + i, icon: ['🪨', '🔔', '🏛️'][i] || '⏳', title: E.name })) },
    ];
    return groups.map(g => `<div class="pn-group"><div class="pn-title">${g.title}</div>${g.items.map(it =>
      `<a href="#" class="pn-item ${it.id === this.current ? 'active' : ''}" data-pedia="${it.id}"><span>${it.icon}</span>${esc(it.title)}</a>`).join('')}</div>`).join('');
  },

  render() {
    $('#pediaNav').innerHTML = this.nav();
    $('#pediaBody').innerHTML = this.article(this.current);
    $('#pediaBody').scrollTop = 0;
    const act = $('#pediaNav .active');
    if (act) act.scrollIntoView({ block: 'nearest' });
  },

  article(id) {
    const [kind, key] = id.split(':');
    try {
      if (kind === 'a') { const a = PEDIA_ARTICLES.find(x => x.id === key) || PEDIA_ARTICLES[0]; return this.head(a.icon, a.title, 'Основы') + a.html(); }
      if (kind === 'r') return key === 'logos' ? this.article('a:logos') : this.resArticle(key);
      if (kind === 'b') return this.buildingArticle(key);
      if (kind === 't') return this.techArticle(key);
      if (kind === 'e') return this.epochArticle(+key);
    } catch (e) { console.error(e); }
    return this.article('a:basics');
  },

  head(icon, title, sub) {
    return `<div class="pa-head"><div class="pa-ic">${icon}</div><div><div class="pa-sub">${esc(sub)}</div><h2>${esc(title)}</h2></div></div>`;
  },
  costText(cost, logos) {
    const parts = Object.entries(cost || {}).map(([k, v]) => `<span class="chip">${RES[k].icon} ${v}</span>`);
    if (logos) parts.push(`<span class="chip logos">λ ${logos}</span>`);
    return parts.join(' ') || '—';
  },

  resArticle(k) {
    const R = RES[k];
    const from = [], to = [];
    for (const [id, B] of Object.entries(BUILDINGS)) {
      const name = B.special ? B.name : B.name;
      if (B.prod && B.prod[k] > 0) from.push(pl('b:' + id, name));
      if (B.prod && B.prod[k] < 0) to.push(pl('b:' + id, name) + ' (сырьё)');
      if (B.cost && B.cost[k]) to.push(pl('b:' + id, name));
    }
    for (const t of TECHS) if (t.cost[k]) to.push(pl('t:' + t.id, t.name));
    EPOCHS.forEach((E, i) => { if (E.advance && E.advance.res[k]) to.push(pl('e:' + i, 'переход: ' + E.name)); });
    const gather = Object.entries(TERRAIN).filter(([, T]) => T.gather === k).map(([, T]) => T.name.toLowerCase());
    const extra = {
      food: 'Жители съедают по ' + BALANCE.foodPerPop + ' зерна в секунду. Без зерна — голод.',
      cheese: 'Сыр делают в козьих загонах после знания ' + pl('t:cheesemaking', '«Сыроделие»') + '. Нужен для Святилища богини плодородия и перехода в бронзовый век.',
      goods: 'Каменные фигурки, расписная керамика, бусы — всё, что ценится в торговле и обрядах.',
      copper: 'С 7-го уровня улучшения любых зданий требуют медь.',
      bronze: 'Сплав меди с привозным оловом. С 9-го уровня улучшения требуют бронзу.',
    }[k] || '';
    return this.head(R.icon, R.name, 'Ресурс') + `
      <p>Появляется: ${EPOCHS[R.epoch].name}${R.tech ? `, после знания ${pl('t:' + R.tech, '«' + TECH_BY_ID[R.tech].name + '»')}` : ''}.</p>
      ${extra ? `<p>${extra}</p>` : ''}
      <h4>Где добыть</h4><p>${from.join(', ') || '—'}${gather.length ? `; вручную — клик по клетке «${gather.join(', ')}»` : ''}${['food', 'wood', 'stone', 'cheese', 'goods'].includes(k) ? '; ' + pl('a:events', 'беглые козы') : ''}.</p>
      <h4>На что идёт</h4><p>${to.join(', ') || '—'}.</p>
      <p class="dim">Хранится в пределах вместимости ${pl('a:storage', 'складов')}.</p>`;
  },

  buildingArticle(type) {
    const B = BUILDINGS[type];
    if (!B) return this.article('a:basics');
    const terrain = B.terrain.map(t => TERRAIN[t].name.toLowerCase()).join(', ') + (B.coast ? ' (только у моря)' : '');
    const req = B.tech ? `<p>Нужно знание: ${pl('t:' + B.tech, '«' + TECH_BY_ID[B.tech].name + '»')}.</p>` : '';
    if (B.special) {
      return this.head(B.icon, B.name, 'Спецстроение · ' + EPOCHS[B.epoch].name) + `
        <p class="lead">${esc(B.desc)}</p>
        <table class="pt"><tr><td>Цена</td><td>${this.costText(B.cost, B.logos)}</td></tr>
          <tr><td>Где строить</td><td>${terrain}</td></tr></table>${req}
        <h4>История</h4><p class="lore">${B.lore}</p>`;
    }
    const icon = Game.icons(type, 1)[0];
    const forms = B.forms.map((f, i) => f ? `<li>${EPOCHS[i].name}: ${f.name}</li>` : "").join("");
    // таблица уровней
    let main = '';
    if (B.prod) { const k = Object.keys(B.prod).find(r => B.prod[r] > 0); main = { label: RES[k].icon + ' ' + RES[k].name, f: L => num(B.prod[k] * Game.levelMult(L)) + '/с' }; }
    else if (B.cap) main = { label: '👥 Места', f: L => B.cap + L - 1 };
    else if (B.storage) main = { label: STORAGE_ICON + ' Склад', f: L => '+' + B.storage * L };
    else if (B.logosBonus) main = { label: 'λ Бонус', f: L => '+' + Math.round((B.logosBonus + B.logosBonusPerLevel * (L - 1)) * 100) + '%' };
    const maxL = EPOCHS[1].maxLevel;
    let rows = `<tr><td>1</td><td>${Game.icons(type, 1).join('')}</td><td>${main.f(1)}</td><td>${B.workers || 0}</td><td>${this.costText(B.cost)} <span class="dim">(постройка)</span></td></tr>`;
    for (let L = 2; L <= maxL; L++) {
      const { cost, logos } = Game.upgradeCost(type, L);
      rows += `<tr class="${L > EPOCHS[0].maxLevel ? 'ep1' : ''} ${logos ? 'lv-logos' : ''}"><td>${L}</td><td>${Game.icons(type, L).join('')}</td><td>${main.f(L)}</td><td>${B.workers ? B.workers + Math.floor((L - 1) / 2) : 0}</td><td>${this.costText(cost, logos)}</td></tr>`;
    }
    const prod = B.prod ? Object.entries(B.prod).map(([k, v]) => `${RES[k].icon} ${v > 0 ? '+' : ''}${v}/с${B.prodTech && B.prodTech[k] ? ` (после ${pl('t:' + B.prodTech[k], '«' + TECH_BY_ID[B.prodTech[k]].name + '»')})` : ''}`).join(', ') : '';
    return this.head(icon, B.name, 'Здание · с эпохи «' + EPOCHS[B.epoch].name + '»') + `
      <p class="lead">${esc(B.desc)}</p>
      <table class="pt"><tr><td>Где строить</td><td>${terrain}</td></tr>
        ${prod ? `<tr><td>Выпуск на 1-м уровне</td><td>${prod}</td></tr>` : ''}
        ${B.max ? `<tr><td>Ограничение</td><td>не больше ${B.max}</td></tr>` : ''}
        <tr><td>Название по эпохам</td><td><ul class="flat">${forms}</ul></td></tr></table>${req}
      <h4>Уровни</h4>
      <table class="pt levels"><tr><th>Ур.</th><th>Облик</th><th>${main.label}</th><th>Работн.</th><th>Цена</th></tr>${rows}</table>
      <p class="dim">Уровни выше ${EPOCHS[0].maxLevel}-го доступны с бронзового века. Выпуск без бонусов. ${pl('a:upgrade', 'Как устроены улучшения')}.</p>
      <h4>История</h4><p class="lore">${B.lore}</p>`;
  },

  techArticle(id) {
    const T = TECH_BY_ID[id];
    if (!T) return this.article('a:basics');
    const opens = Object.entries(BUILDINGS).filter(([, B]) => B.tech === id).map(([bid, B]) => pl('b:' + bid, B.special ? B.name : B.forms.find(Boolean).name));
    const leadsTo = TECHS.filter(t => (t.req || []).includes(id)).map(t => pl('t:' + t.id, t.name));
    const st = Game.hasTech(id) ? '<span class="chip good">✓ изучено</span>' : '';
    return this.head(T.icon, T.name, 'Знание · ' + EPOCHS[T.epoch].name) + `
      <p class="lead">${esc(T.desc)} ${st}</p>
      <table class="pt"><tr><td>Цена</td><td>${this.costText(T.cost, T.logos)}</td></tr>
        ${T.req ? `<tr><td>Требует</td><td>${T.req.map(r => pl('t:' + r, TECH_BY_ID[r].name)).join(', ')}</td></tr>` : ''}
        ${opens.length ? `<tr><td>Открывает</td><td>${opens.join(', ')}</td></tr>` : ''}
        ${leadsTo.length ? `<tr><td>Ведёт к</td><td>${leadsTo.join(', ')}</td></tr>` : ''}</table>`;
  },

  epochArticle(i) {
    const E = EPOCHS[i];
    if (!E) return this.article('a:basics');
    let h = this.head(['🪨', '🔔', '🏛️'][i] || '⏳', E.name, E.sub) + `<p class="lore">${E.intro}</p>`;
    if (E.locked) return h + '<p><b>Эта эпоха появится в следующей версии.</b></p>';
    h += `<table class="pt"><tr><td>Предел уровня зданий</td><td>${E.maxLevel}</td></tr>`;
    const techs = TECHS.filter(t => t.epoch === i).map(t => pl('t:' + t.id, t.name));
    const sps = Object.entries(BUILDINGS).filter(([, B]) => B.special && B.epoch === i).map(([id, B]) => pl('b:' + id, B.name));
    const blds = Object.entries(BUILDINGS).filter(([, B]) => !B.special && B.epoch === i).map(([id, B]) => pl('b:' + id, B.name));
    h += `<tr><td>Новые здания</td><td>${blds.join(', ')}</td></tr><tr><td>Знания</td><td>${techs.join(', ')}</td></tr>
      <tr><td>Спецстроения</td><td>${sps.join(', ')}</td></tr></table>`;
    const a = E.advance;
    if (a) {
      h += `<h4>Чтобы перейти дальше</h4><ul>
        <li>население ${a.pop};</li>
        <li>${a.specials.map(s => pl('b:' + s, BUILDINGS[s].name)).join(' и ')};</li>
        ${a.allTechs ? '<li>все знания эпохи;</li>' : ''}
        <li>${Object.entries(a.res).map(([k, v]) => `${RES[k].icon} ${v}`).join(', ')}, λ ${a.logos}.</li></ul>`;
    }
    return h;
  },
};
