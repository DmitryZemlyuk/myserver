/*
 * Lampa – «Синхронизация»: свой сервер вместо CUB для закладок, отметок просмотра, фильтров, истории поиска,
 * профилей, бэкапов настроек и уведомлений о новых сериях. Сервер – агент «Мой сервер» (agent/lampa.js).
 *
 * Два режима, выбираются сами:
 *  - синхронизация CUB включена: закладки и статусы живут в CUB, плагин копирует их на сервер (только туда);
 *    профили – из CUB (на сервере у каждого свой двойник). Остальное – в обе стороны.
 *  - синхронизация CUB выключена: всё в обе стороны через свой сервер, свой выбор профиля с PIN.
 *
 * Данные разбиты на записи (ключ, запись) – так сервер сливает изменения разных устройств по одной записи.
 */
(function () {
  'use strict';
  if (window.lsync_plugin) return;
  window.lsync_plugin = true;

  var VERSION = '1.0.4';
  var API = 'https://myserver-api.darksky484.workers.dev/api/lampa';
  var PAGE = 2000;
  var CATS = ['like', 'wath', 'book', 'history', 'look', 'viewed', 'scheduled', 'continued', 'thrown'];
  var COLORS = ['#0a84ff', '#c2485f', '#2f9e6e', '#ff9f0a', '#bf5af2', '#5e5ce6', '#64d2ff', '#8e8e93'];
  var SKIP_ONLINE = /cache|token|cookie|proxy|auth|login|pass|hash_|_hash|unic_id|uid/i;

  // ------------------------------------------------------------------ language
  var STR = {
    title: ['Мій сервер', 'Мой сервер', 'My Server'],
    st_off: ['Не підключено до сервера', 'Не подключено к серверу', 'Not connected to the server'],
    st_on: ['Підключено – мій сервер', 'Подключено – мой сервер', 'Connected – my server'],
    st_err: ['Сервер не відповідає', 'Сервер не отвечает', 'The server does not respond'],
    st_last: ['Остання синхронізація: {a}', 'Последняя синхронизация: {a}', 'Last sync: {a}'],
    st_never: ['ще не було', 'ещё не было', 'not yet'],
    st_cub: ['Синхронізація CUB увімкнена: закладки зберігаються в CUB, на сервер іде копія', 'Синхронизация CUB включена: закладки хранятся в CUB, на сервер идёт копия',
      'CUB sync is on: bookmarks live in CUB, a copy goes to the server'],
    st_local: ['Синхронізація CUB вимкнена: усе зберігається на твоєму сервері', 'Синхронизация CUB выключена: всё хранится на твоём сервере',
      'CUB sync is off: everything lives on your server'],
    connect: ['Підключити до сервера', 'Подключить к серверу', 'Connect to the server'],
    connect_d: ['Підтвердження прийде в Telegram-бот «Мой сервер»', 'Подтверждение придёт в Telegram-бот «Мой сервер»', 'You confirm it in the "Мой сервер" Telegram bot'],
    disconnect: ['Від’єднати цей пристрій', 'Отключить это устройство', 'Disconnect this device'],
    disconnect_q: ['Від’єднати пристрій від сервера? Дані на сервері залишаться.', 'Отключить устройство от сервера? Данные на сервере останутся.',
      'Disconnect this device from the server? The data on the server stays.'],
    pair_t: ['Підключення до сервера', 'Подключение к серверу', 'Connecting to the server'],
    pair_text: ['У Telegram прийшов запит. Перевір код і натисни «Разрешить».', 'В Telegram пришёл запрос. Проверь код и нажми «Разрешить».',
      'A request has arrived in Telegram. Check the code and tap «Разрешить».'],
    pair_code: ['Код', 'Код', 'Code'],
    pair_wait: ['Чекаю на підтвердження…', 'Жду подтверждения…', 'Waiting for confirmation…'],
    pair_ok: ['Пристрій підключено', 'Устройство подключено', 'Device connected'],
    pair_no: ['Підключення відхилено', 'Подключение отклонено', 'Connection declined'],
    pair_exp: ['Час минув, спробуй ще раз', 'Время вышло, попробуй ещё раз', 'Time is up, try again'],
    pair_fail: ['Не вдалося зв’язатися з сервером', 'Не удалось связаться с сервером', 'Could not reach the server'],
    pair_bot: ['Бот на сервері не працює', 'Бот на сервере не работает', 'The bot on the server is not running'],
    pair_many: ['Забагато спроб, зачекай трохи', 'Слишком много попыток, подожди немного', 'Too many attempts, wait a bit'],
    revoked: ['Пристрій від’єднано від сервера', 'Устройство отключено от сервера', 'This device was disconnected from the server'],
    profile: ['Профіль', 'Профиль', 'Profile'],
    profile_main: ['Основний профіль', 'Основной профиль', 'Main profile'],
    profile_change: ['Змінити профіль', 'Сменить профиль', 'Switch profile'],
    profile_cub: ['Профілі беруться з CUB, поки ввімкнена його синхронізація', 'Профили берутся из CUB, пока включена его синхронизация',
      'Profiles come from CUB while its sync is on'],
    profiles_manage: ['Керування профілями', 'Управление профилями', 'Manage profiles'],
    who: ['Хто дивиться?', 'Кто смотрит?', 'Who is watching?'],
    add: ['Додати', 'Добавить', 'Add'],
    pin_enter: ['Введи PIN для профілю «{n}»', 'Введите PIN для профиля «{n}»', 'Enter the PIN for “{n}”'],
    pin_wrong: ['Невірний PIN, залишилось спроб: {n}', 'Неверный PIN, осталось попыток: {n}', 'Wrong PIN, {n} tries left'],
    pin_locked: ['Забагато спроб, зачекай {n} хв', 'Слишком много попыток, подожди {n} мин', 'Too many tries, wait {n} min'],
    pin_hint: ['Цифри – стрілками пульта або цифровими кнопками', 'Цифры – стрелками пульта или цифровыми кнопками', 'Digits – with the arrows or the number keys'],
    pin_erase: ['Стерти', 'Стереть', 'Erase'],
    new_profile: ['Новий профіль', 'Новый профиль', 'New profile'],
    pr_name: ['Ім’я профілю', 'Имя профиля', 'Profile name'],
    pr_rename: ['Перейменувати', 'Переименовать', 'Rename'],
    pr_pin: ['PIN-код', 'PIN-код', 'PIN code'],
    pr_pin_set: ['Новий PIN (4 цифри)', 'Новый PIN (4 цифры)', 'New PIN (4 digits)'],
    pr_pin_remove: ['Прибрати PIN', 'Убрать PIN', 'Remove the PIN'],
    pr_pin_old: ['Поточний PIN', 'Текущий PIN', 'Current PIN'],
    pr_child: ['Дитячий профіль', 'Детский профиль', 'Kids profile'],
    pr_color: ['Колір', 'Цвет', 'Color'],
    pr_delete: ['Видалити профіль', 'Удалить профиль', 'Delete profile'],
    pr_delete_q: ['Видалити профіль «{n}» і його дані? Копія залишиться в бекапі на 30 днів.', 'Удалить профиль «{n}» и его данные? Копия останется в бэкапе на 30 дней.',
      'Delete “{n}” and its data? A copy stays in the backups for 30 days.'],
    pr_last: ['Останній профіль видалити не можна', 'Последний профиль удалить нельзя', 'The last profile cannot be deleted'],
    pr_limit: ['Досягнуто ліміту профілів', 'Достигнут лимит профилей', 'Profile limit reached'],
    pin_set: ['є PIN', 'есть PIN', 'has PIN'],
    what: ['Що синхронізувати', 'Что синхронизировать', 'What to sync'],
    fav: ['Закладки і статуси', 'Закладки и статусы', 'Bookmarks and statuses'],
    fav_d: ['Обране, Пізніше, Історія, Дивлюсь, Переглянуто…', 'Избранное, Позже, История, Смотрю, Просмотрено…', 'Favorites, Later, History, Watching, Watched…'],
    marks: ['Позначки перегляду', 'Отметки просмотра', 'Watch marks'],
    marks_d: ['Продовжити серію з того ж місця на іншому пристрої', 'Продолжить серию с того же места на другом устройстве', 'Resume an episode where you left off on another device'],
    filters: ['Фільтри', 'Фильтры', 'Filters'],
    filters_d: ['Вибір джерела, озвучки і фільтри торентів', 'Выбор источника, озвучки и фильтры торрентов', 'Chosen source, voice-over and torrent filters'],
    search: ['Історія пошуку', 'История поиска', 'Search history'],
    search_d: ['Спільна для всіх пристроїв профілю', 'Общая для всех устройств профиля', 'Shared by all devices of the profile'],
    actions: ['Дії', 'Действия', 'Actions'],
    now: ['Синхронізувати зараз', 'Синхронизировать сейчас', 'Sync now'],
    done: ['Синхронізовано', 'Синхронизировано', 'Synced'],
    fail: ['Не вдалося синхронізувати', 'Не удалось синхронизировать', 'Sync failed'],
    backups: ['Бекапи і відновлення', 'Бэкапы и восстановление', 'Backups and restore'],
    backup_now: ['Зберегти налаштування цього пристрою', 'Сохранить настройки этого устройства', 'Save this device’s settings'],
    backup_saved: ['Бекап налаштувань збережено на сервері', 'Бэкап настроек сохранён на сервере', 'Settings backup saved on the server'],
    restore_settings: ['Відновити налаштування', 'Восстановить настройки', 'Restore settings'],
    restore_data: ['Відновити закладки й позначки на дату', 'Восстановить закладки и отметки на дату', 'Restore bookmarks and marks as of a date'],
    restore_q: ['Відновити? Поточні дані буде замінено.', 'Восстановить? Текущие данные будут заменены.', 'Restore? The current data will be replaced.'],
    restored: ['Відновлено. Lampa перезапуститься', 'Восстановлено. Lampa перезапустится', 'Restored. Lampa will restart'],
    restored_data: ['Відновлено', 'Восстановлено', 'Restored'],
    restore: ['Відновити', 'Восстановить', 'Restore'],
    delete: ['Видалити', 'Удалить', 'Delete'],
    deleted: ['Видалено', 'Удалено', 'Deleted'],
    delete_q: ['Видалити цей бекап?', 'Удалить этот бэкап?', 'Delete this backup?'],
    keep_note: ['Автоматичні – останні 7 на пристрій, усе інше – 30 днів', 'Автоматические – последние 7 на устройство, остальные – 30 дней',
      'Automatic ones – the last 7 per device, the rest – 30 days'],
    rename: ['Перейменувати', 'Переименовать', 'Rename'],
    device_name: ['Назва пристрою', 'Название устройства', 'Device name'],
    disconnect_one: ['Від’єднати', 'Отключить', 'Disconnect'],
    auto_backup: ['Бекап налаштувань раз на добу', 'Бэкап настроек раз в сутки', 'Daily settings backup'],
    ask_profile: ['Питати профіль під час запуску', 'Спрашивать профиль при запуске', 'Ask for the profile at start'],
    devices: ['Пристрої', 'Устройства', 'Devices'],
    this_device: ['цей пристрій', 'это устройство', 'this device'],
    revoke_q: ['Від’єднати «{n}»?', 'Отключить «{n}»?', 'Disconnect “{n}”?'],
    seen: ['був {a}', 'был {a}', 'seen {a}'],
    follow_on: ['Стежу за серіями', 'Слежу за сериями', 'Following'],
    follow_off: ['Стежити за серіями', 'Следить за сериями', 'Follow episodes'],
    follow_on_n: ['Нові серії приходитимуть у Telegram', 'Новые серии будут приходить в Telegram', 'New episodes will come to Telegram'],
    follow_off_n: ['Більше не стежу', 'Больше не слежу', 'Not following any more'],
    notify: ['Сповіщення про нові серії', 'Уведомления о новых сериях', 'New-episode notifications'],
    notify_d: ['Серіали з «Дивлюсь» і з кнопкою «Стежити за серіями» в картці. Приходять у Telegram і push дашборда',
      'Сериалы из «Смотрю» и с кнопкой «Следить за сериями» в карточке. Приходят в Telegram и push дашборда',
      'Series in “Watching” and those with “Follow episodes” on their card. They come to Telegram and the dashboard’s push'],
    followed: ['Стежу: {n}', 'Слежу: {n}', 'Following: {n}'],
    need_connect: ['Спершу підключи пристрій до сервера', 'Сначала подключи устройство к серверу', 'Connect this device to the server first'],
    empty: ['Порожньо', 'Пусто', 'Nothing here'],
    auto: ['авто', 'авто', 'auto'],
    yes: ['Так', 'Да', 'Yes'],
    no: ['Ні', 'Нет', 'No'],
    version: ['Версія плагіна', 'Версия плагина', 'Plugin version'],
    ago_now: ['щойно', 'только что', 'just now'],
    ago_m: ['{n} хв тому', '{n} мин назад', '{n} min ago'],
    ago_h: ['{n} год тому', '{n} ч назад', '{n} h ago'],
    ago_d: ['{n} дн тому', '{n} дн назад', '{n} d ago']
  };
  (function () {
    var add = {};
    Object.keys(STR).forEach(function (k) { add['lsync_' + k] = {uk: STR[k][0], ru: STR[k][1], en: STR[k][2]}; });
    Lampa.Lang.add(add);
  })();
  function t(k, vars) {
    var s = Lampa.Lang.translate('lsync_' + k);
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  }
  function ago(ms) {
    if (!ms) return t('st_never');
    var s = (Date.now() - ms) / 1000;
    if (s < 60) return t('ago_now');
    if (s < 5400) return t('ago_m', {n: Math.max(1, Math.round(s / 60))});
    if (s < 172800) return t('ago_h', {n: Math.round(s / 3600)});
    return t('ago_d', {n: Math.round(s / 86400)});
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
  function noty(k, vars) { try { Lampa.Noty.show(t(k, vars)); } catch (e) { /* */ } }

  // ------------------------------------------------------------------ own storage (raw localStorage, not Lampa's)
  function lsGet(k, d) { try { var v = window.localStorage.getItem('lsync_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { window.localStorage.setItem('lsync_' + k, JSON.stringify(v)); } catch (e) { /* quota: the next run sends again */ } }
  function lsDel(k) { try { window.localStorage.removeItem('lsync_' + k); } catch (e) { /* */ } }
  function on(name) { var v = Lampa.Storage.field(name); return v !== false && v !== 'false' && v !== 'off'; }

  // ------------------------------------------------------------------ network
  function req(method, path, body) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open(method, API + path, true);
      x.timeout = body && body.changes && body.changes.length > 200 ? 60000 : 20000;
      var token = lsGet('token', '');
      if (token) x.setRequestHeader('Authorization', 'Bearer ' + token);
      if (body) x.setRequestHeader('Content-Type', 'application/json');
      x.onload = function () {
        var j = null;
        try { j = JSON.parse(x.responseText); } catch (e) { /* */ }
        if (x.status === 401 && token && path !== '/pair') { forget(true); }
        if (x.status >= 200 && x.status < 300 && j) resolve(j);
        else reject({status: x.status, body: j});
      };
      x.onerror = function () { reject({status: 0}); };
      x.ontimeout = function () { reject({status: 0, timeout: true}); };
      x.send(body ? JSON.stringify(body) : null);
    });
  }

  // ------------------------------------------------------------------ hashing (what was last sent / received)
  function hash(v) {
    var s = JSON.stringify(v === undefined ? null : v), h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return h.toString(36) + ':' + s.length.toString(36);
  }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

  // ------------------------------------------------------------------ mode, profile
  function permit() { try { return Lampa.Account.Permit; } catch (e) { return null; } }
  function cubOn() { var p = permit(); try { return !!(p && p.sync); } catch (e) { return false; } }
  function cubProfile() { var p = permit(); try { return p && p.account && p.account.profile && p.account.profile.id ? p.account.profile : null; } catch (e) { return null; } }

  var S = {
    busy: false, again: false, timer: null, lastOk: lsGet('last', 0), error: false,
    profiles: lsGet('profiles', []), me: null, pinOk: {}
  };
  function profileId() { return lsGet('profile', ''); }
  function profileOf(id) { for (var i = 0; i < S.profiles.length; i++) if (S.profiles[i].id === id) return S.profiles[i]; return null; }
  function profileName(p) { return p ? (p.name || t('profile_main')) : ''; }

  // ------------------------------------------------------------------ what is synced
  // spec: {k: server key, local(): Lampa storage key, mode: map|whole|fav, group: Storage field of the toggle}
  function timelineKey() { try { return Lampa.Timeline.filename(); } catch (e) { return 'file_view'; } }
  function specs() {
    var list = [
      {k: 'favorite', local: function () { return 'favorite'; }, mode: 'fav', group: 'lsync_fav'},
      {k: 'file_view', local: timelineKey, mode: 'map', group: 'lsync_marks'},
      {k: 'search_history', local: function () { return 'search_history'; }, mode: 'whole', group: 'lsync_search', empty: []},
      {k: 'torrents_filter', local: function () { return 'torrents_filter'; }, mode: 'whole', group: 'lsync_filters', empty: {}},
      {k: 'lsync_follow', local: function () { return 'lsync_follow'; }, mode: 'map', group: null},
      {k: 'lsync_status', local: function () { return 'lsync_status'; }, mode: 'map', group: 'lsync_fav'}
    ];
    // online plugins' choices (source, voice-over, last watched) – whatever "online_*" keys there are on this device
    var seen = {};
    try {
      Object.keys(window.localStorage).forEach(function (key) {
        if (key.indexOf('online_') !== 0 || SKIP_ONLINE.test(key) || seen[key] || key.length > 80 || !/^[A-Za-z0-9_.-]+$/.test(key)) return;
        seen[key] = 1;
        list.push(onlineSpec(key));
      });
    } catch (e) { /* */ }
    return list;
  }
  // isMap: for a key this device does not have yet, what the server's entries look like
  function onlineSpec(key, isMap) {
    var raw = null;
    try { raw = window.localStorage.getItem(key); } catch (e) { /* */ }
    var obj = !!isMap;
    if (raw !== null) { obj = false; try { var v = JSON.parse(raw); obj = !!(v && typeof v === 'object' && !Array.isArray(v)); } catch (e) { /* plain string */ } }
    return {k: key, local: function () { return key; }, mode: obj ? 'map' : 'whole', group: 'lsync_filters', empty: obj ? {} : '', online: true};
  }
  function specFor(k, list, isMap) {
    for (var i = 0; i < list.length; i++) if (list[i].k === k) return list[i];
    if (k.indexOf('online_') === 0 && !SKIP_ONLINE.test(k)) { var s = onlineSpec(k, isMap); list.push(s); return s; }
    return null;
  }
  function enabled(spec) { return !spec.group || on(spec.group); }

  // the bookmarks while CUB keeps them (read-only for us)
  function cubFavorite() {
    var B = Lampa.Account && Lampa.Account.Bookmarks;
    if (!B || typeof B.get !== 'function') return null;
    var out = {card: []}, cards = {}, total = 0;
    CATS.forEach(function (c) {
      var list = [];
      try { list = B.get({type: c}) || []; } catch (e) { list = []; }
      out[c] = [];
      list.forEach(function (card) {
        if (!card || card.id == null) return;
        total++;
        if (out[c].indexOf(card.id) === -1) out[c].push(card.id);
        if (!cards[card.id]) { cards[card.id] = 1; out.card.push(card); }
      });
    });
    return total ? out : null;        // nothing at all: not loaded yet, never "everything was deleted"
  }
  function readLocal(spec) {
    if (spec.mode === 'fav' && cubOn()) return cubFavorite();
    var v = Lampa.Storage.get(spec.local(), spec.mode === 'whole' ? (spec.empty !== undefined ? JSON.stringify(spec.empty) : '') : '{}');
    return clone(v);
  }
  function flatten(spec, v) {
    var out = {};
    if (v == null) return out;
    if (spec.mode === 'whole') { if (v !== '') out[''] = v; return out; }
    if (typeof v !== 'object' || Array.isArray(v)) return out;
    if (spec.mode === 'map') { Object.keys(v).forEach(function (e) { if (e.length <= 300 && v[e] !== undefined) out[e] = v[e]; }); return out; }
    // fav: lists and cards
    Object.keys(v).forEach(function (key) {
      if (key === 'card') {
        (Array.isArray(v.card) ? v.card : []).forEach(function (c) { if (c && c.id != null) out['card:' + c.id] = c; });
      } else if (Array.isArray(v[key])) out['list:' + key] = v[key];
      else if (v[key] != null) out['raw:' + key] = v[key];
    });
    return out;
  }
  function unflatten(spec, entries) {
    if (spec.mode === 'whole') return entries.hasOwnProperty('') ? entries[''] : clone(spec.empty);
    if (spec.mode === 'map') return entries;
    var v = {card: []};
    CATS.forEach(function (c) { v[c] = []; });
    Object.keys(entries).forEach(function (e) {
      if (e.indexOf('card:') === 0) v.card.push(entries[e]);
      else if (e.indexOf('list:') === 0) v[e.slice(5)] = entries[e];
      else if (e.indexOf('raw:') === 0) v[e.slice(4)] = entries[e];
    });
    return v;
  }
  function writeLocal(spec, value) {
    Lampa.Storage.set(spec.local(), value, true);
    try {
      if (spec.k === 'favorite' && Lampa.Favorite && Lampa.Favorite.read) Lampa.Favorite.read();
      if (spec.k === 'file_view' && Lampa.Timeline && Lampa.Timeline.read) Lampa.Timeline.read();
    } catch (e) { /* */ }
  }

  // ------------------------------------------------------------------ sync
  function shadowOf(pid) { return lsGet('shadow_' + pid, {}); }
  function collect(list, shadow) {
    var changes = [], now = Date.now();
    list.forEach(function (spec) {
      if (!enabled(spec)) return;
      var v = readLocal(spec);
      if (v === null && spec.mode === 'fav') return;      // CUB bookmarks not loaded yet
      var cur = flatten(spec, v), sh = shadow[spec.k] || {};
      Object.keys(cur).forEach(function (e) {
        var h = hash(cur[e]);
        if (sh[e] !== h) changes.push({k: spec.k, e: e, v: cur[e], t: now, h: h});
      });
      Object.keys(sh).forEach(function (e) { if (!cur.hasOwnProperty(e)) changes.push({k: spec.k, e: e, v: null, t: now, h: null}); });
    });
    return changes;
  }
  // merge: the first sync of a profile on this device – lists that are here and on the server are joined (the server's
  // first), so neither the device's own bookmarks nor the server's are lost; otherwise the server's value is taken
  function union(a, b) { var out = a.slice(); b.forEach(function (x) { if (out.indexOf(x) === -1) out.push(x); }); return out; }
  function apply(list, shadow, changes, merge) {
    var byKey = {};
    changes.forEach(function (c) { (byKey[c.k] = byKey[c.k] || []).push(c); });
    Object.keys(byKey).forEach(function (k) {
      var spec = specFor(k, list, byKey[k].some(function (c) { return c.e !== ''; }));
      if (!spec || !enabled(spec)) return;
      // while CUB keeps the bookmarks, the server's copy is not written back (CUB wins, the next run sends it again)
      if (spec.mode === 'fav' && cubOn()) return;
      var cur = flatten(spec, readLocal(spec)), sh = shadow[k] = shadow[k] || {}, changed = false;
      byKey[k].forEach(function (c) {
        if (c.v === null) { if (cur.hasOwnProperty(c.e)) { delete cur[c.e]; changed = true; } delete sh[c.e]; }
        else {
          var h = hash(c.v), v = c.v;
          if (merge && Array.isArray(v) && Array.isArray(cur[c.e])) v = union(v, cur[c.e]);
          if (!cur.hasOwnProperty(c.e) || hash(cur[c.e]) !== hash(v)) { cur[c.e] = v; changed = true; }
          sh[c.e] = h;                                     // what the server has; a joined list differs and is sent next
        }
      });
      if (changed) writeLocal(spec, unflatten(spec, cur));
    });
  }
  function ack(shadow, sent) {
    sent.forEach(function (c) {
      var sh = shadow[c.k] = shadow[c.k] || {};
      if (c.h === null) delete sh[c.e]; else sh[c.e] = c.h;
    });
  }

  // profile switch: the per-profile data on this device is replaced by the new profile's
  function resetLocal(keepFav) {
    specs().forEach(function (spec) {
      if (spec.k === 'favorite' && (keepFav || cubOn())) return;
      if (spec.k === 'file_view' && cubOn()) return;      // with CUB its key is per CUB profile already
      writeLocal(spec, spec.mode === 'fav' ? unflatten(spec, {}) : spec.mode === 'map' ? {} : clone(spec.empty));
    });
  }
  function setProfile(pid) {
    var old = profileId();
    if (old === pid) return;
    lsSet('profile', pid);
    lsDel('shadow_' + pid); lsDel('seq_' + pid);
    if (old) resetLocal(false);
    S.pinOk = {};
    Lampa.Listener.send('lsync', {type: 'profile', profile: pid});
  }

  function refreshMe() {
    return req('GET', '/me').then(function (j) {
      S.me = j; S.profiles = j.profiles || []; lsSet('profiles', S.profiles);
      return j;
    });
  }
  // the profile this device works with now
  function resolveProfile() {
    if (cubOn()) {
      var cp = cubProfile();
      if (!cp) return Promise.reject({status: 0, why: 'cub'});
      var map = lsGet('cubmap', {}), key = String(cp.id);
      var have = map[key] && profileOf(map[key]);
      var p = have ? Promise.resolve(map[key]) : req('POST', '/profiles', {action: 'ensure', cub: key, name: cp.name || ''}).then(function (j) {
        S.profiles = j.profiles || S.profiles; lsSet('profiles', S.profiles);
        map[key] = j.profile.id; lsSet('cubmap', map);
        return j.profile.id;
      });
      return p.then(function (pid) { setProfile(pid); return pid; });
    }
    var pid = profileId();
    if (pid && profileOf(pid)) return Promise.resolve(pid);
    var first = S.profiles[0];
    if (!first) return refreshMe().then(function () { if (!S.profiles[0]) throw {status: 0}; setProfile(S.profiles[0].id); return S.profiles[0].id; });
    setProfile(first.id);
    return Promise.resolve(first.id);
  }

  function syncNow(manual) {
    if (!lsGet('token', '')) return Promise.resolve(false);
    if (S.busy) { S.again = true; return Promise.resolve(false); }
    S.busy = true;
    var mode = cubOn() ? 'cub' : 'local', prevMode = lsGet('mode', mode);
    var p = (S.profiles.length ? Promise.resolve() : refreshMe()).then(resolveProfile).then(function (pid) {
      // CUB switched off: the copy on the server becomes this device's bookmarks (the local ones are from before CUB)
      var switched = prevMode === 'cub' && mode === 'local';
      if (switched) {
        var sh0 = shadowOf(pid); delete sh0.favorite; lsSet('shadow_' + pid, sh0);
        writeLocal(specs()[0], unflatten(specs()[0], {}));
        lsSet('seq_' + pid, 0);
      }
      lsSet('mode', mode);
      var list = specs(), shadow = shadowOf(pid), rounds = 0, pending = null;
      // the first time on this device: take what the server has before sending anything
      var initial = switched || (!lsGet('seq_' + pid, 0) && !Object.keys(shadow).length);
      if (!initial) pending = collect(list, shadow);
      function round() {
        if (pending === null && !initial) pending = collect(list, shadow);
        var chunk = initial ? [] : pending.splice(0, PAGE);
        var body = {profile: pid, since: lsGet('seq_' + pid, 0), changes: chunk.map(function (c) { return {k: c.k, e: c.e, v: c.v, t: c.t}; })};
        return req('POST', '/sync', body).then(function (j) {
          ack(shadow, chunk);
          apply(list, shadow, j.changes || [], initial);
          lsSet('shadow_' + pid, shadow);
          lsSet('seq_' + pid, j.seq || 0);
          rounds++;
          if (rounds >= 50) return;
          if (j.more) return round();
          if (initial) { initial = false; pending = null; return round(); }   // now send this device's own data
          if (pending.length) return round();
        });
      }
      return round();
    }).then(function () {
      S.lastOk = Date.now(); S.error = false; lsSet('last', S.lastOk);
      if (manual) noty('done');
      autoBackup();
      return true;
    }, function (e) {
      S.error = true;
      if (manual) noty(e && e.status === 0 ? 'pair_fail' : 'fail');
      return false;
    });
    return p.then(function (r) {
      S.busy = false;
      updateStatus();
      if (S.again) { S.again = false; schedule(2000); }
      return r;
    });
  }
  function schedule(ms) {
    clearTimeout(S.timer);
    S.timer = setTimeout(function () { syncNow(false); }, ms || 3000);
  }

  // ------------------------------------------------------------------ pairing
  function deviceName() {
    var map = {android: 'Android', tizen: 'Samsung TV', webos: 'LG TV', orsay: 'Samsung TV', apple: 'iOS', apple_tv: 'Apple TV', browser: 'Браузер', nw: 'ПК', electron: 'ПК'};
    var plat = '';
    try { plat = Lampa.Platform.get(); } catch (e) { /* */ }
    var own = '';
    try { own = Lampa.Storage.get('device_name', ''); } catch (e) { /* */ }
    var tv = false;
    try { tv = Lampa.Platform.screen('tv'); } catch (e) { /* */ }
    var base = map[plat] || plat || 'Lampa';
    if (plat === 'android' && tv) base = 'Android TV';
    own = String(own || '').trim();
    return {name: own && own.toLowerCase() !== 'lampa' ? own : 'Lampa – ' + base, platform: plat};
  }
  function pair() {
    var d = deviceName(), poll = null, closed = false;
    var html = $('<div class="lsync-pair"><div class="lsync-pair__text"></div><div class="lsync-pair__code"></div><div class="lsync-pair__wait"></div></div>');
    html.find('.lsync-pair__text').text(t('pair_text'));
    html.find('.lsync-pair__wait').text(t('pair_wait'));
    function close() {
      if (closed) return;
      closed = true; clearTimeout(poll);
      Lampa.Modal.close();
      Lampa.Controller.toggle('settings_component');
    }
    req('POST', '/pair', {name: d.name, platform: d.platform}).then(function (j) {
      html.find('.lsync-pair__code').html(esc(t('pair_code')) + ' <b>' + esc(j.code) + '</b>');
      Lampa.Modal.open({title: t('pair_t'), html: html, size: 'small', align: 'center', onBack: close});
      var until = Date.now() + (j.ttl || 600000);
      (function check() {
        if (closed) return;
        if (Date.now() > until) { noty('pair_exp'); return close(); }
        req('GET', '/pair/' + j.id + '?secret=' + encodeURIComponent(j.secret)).then(function (r) {
          if (closed) return;
          if (r.status === 'ok' && r.token) {
            lsSet('token', r.token); lsSet('device', r.device || '');
            noty('pair_ok'); close();
            refreshMe().then(function () { return syncNow(false); }).then(function () { reopenSettings(); });
            return;
          }
          if (r.status === 'no') { noty('pair_no'); return close(); }
          if (r.status === 'expired') { noty('pair_exp'); return close(); }
          poll = setTimeout(check, 2500);
        }, function () { poll = setTimeout(check, 5000); });
      })();
    }, function (e) {
      noty(e && e.status === 503 ? 'pair_bot' : e && e.status === 429 ? 'pair_many' : 'pair_fail');
    });
  }
  function forget(revoked) {
    var pid = profileId();
    lsDel('token'); lsDel('device'); lsDel('seq_' + pid); lsDel('shadow_' + pid); lsDel('last');
    S.lastOk = 0; S.me = null;
    if (revoked) noty('revoked');
    updateStatus();
  }

  // ------------------------------------------------------------------ settings backups
  function settingsSnapshot() {
    var data = {}, keys = [];
    try { keys = Lampa.Storage.keys ? Lampa.Storage.keys() : Object.keys(window.localStorage); } catch (e) { keys = Object.keys(window.localStorage); }
    keys.forEach(function (k) {
      if (k.indexOf('lsync_') === 0 || k === 'app.js') return;
      var v = Lampa.Storage.value ? Lampa.Storage.value(k, '') : window.localStorage.getItem(k);
      if (v !== null && v !== undefined) data[k] = String(v);
    });
    // at most ~5 MB: the biggest values (caches) go first
    var size = 0;
    Object.keys(data).forEach(function (k) { size += data[k].length + k.length; });
    if (size > 5000000) {
      Object.keys(data).sort(function (a, b) { return data[b].length - data[a].length; }).forEach(function (k) {
        if (size > 5000000) { size -= data[k].length + k.length; delete data[k]; }
      });
    }
    return data;
  }
  function backupSettings(auto) {
    return req('POST', '/backups', {action: 'save', auto: !!auto, data: settingsSnapshot()}).then(function () {
      if (!auto) noty('backup_saved');
      lsSet('backup_day', new Date().toDateString());
    }, function () { if (!auto) noty('fail'); });
  }
  function autoBackup() {
    if (!on('lsync_auto_backup')) return;
    if (lsGet('backup_day', '') === new Date().toDateString()) return;
    lsSet('backup_day', new Date().toDateString());
    setTimeout(function () { backupSettings(true); }, 15000);
  }
  function fmtDate(ms) {
    try { return new Date(ms).toLocaleString(Lampa.Storage.get('language', 'ru'), {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}); }
    catch (e) { return new Date(ms).toISOString().slice(0, 16).replace('T', ' '); }
  }
  function confirm(text, yes, back) {
    Lampa.Select.show({
      title: text,
      items: [{title: t('yes'), ok: true}, {title: t('no')}],
      onSelect: function (a) { if (a.ok) yes(); else back(); },
      onBack: back
    });
  }
  function backupsMenu() {
    var back = function () { Lampa.Controller.toggle('settings_component'); };
    req('GET', '/backups').then(function (j) {
      var sets = j.backups.filter(function (b) { return b.kind === 'settings'; });
      var datas = j.backups.filter(function (b) { return b.kind === 'data'; });
      Lampa.Select.show({
        title: t('backups'), onBack: back,
        items: [{title: t('backup_now'), act: 'save'},
          {title: t('restore_settings'), subtitle: sets.length + ' · ' + t('keep_note'), act: 'settings', noenter: !sets.length},
          {title: t('restore_data'), subtitle: String(datas.length), act: 'data', noenter: !datas.length}],
        onSelect: function (a) {
          if (a.act === 'save') { backupSettings(false).then(back); return; }
          backupList(a.act, a.act === 'settings' ? sets : datas);
        }
      });
    }, function () { noty('pair_fail'); });
  }
  function backupList(kind, list) {
    var up = function () { backupsMenu(); };
    if (!list.length) return up();
    Lampa.Select.show({
      title: t(kind === 'settings' ? 'restore_settings' : 'restore_data'), onBack: up,
      items: list.slice(0, 60).map(function (b) {
        return {title: fmtDate(b.at), subtitle: kind === 'settings' ? (b.device || '') + (b.auto ? ' · ' + t('auto') : '') : '', file: b.file};
      }),
      onSelect: function (b) {
        var again = function () { backupList(kind, list); };
        Lampa.Select.show({
          title: b.title, onBack: again,
          items: [{title: t('restore'), act: 'restore'}, {title: t('delete'), act: 'delete'}],
          onSelect: function (x) {
            if (x.act === 'delete') {
              confirm(t('delete_q'), function () {
                req('POST', '/backups', {action: 'delete', file: b.file}).then(function () {
                  noty('deleted'); list = list.filter(function (y) { return y.file !== b.file; }); backupList(kind, list);
                }, function () { noty('fail'); again(); });
              }, again);
              return;
            }
            confirm(t('restore_q'), function () { restoreBackup(kind, b.file); }, again);
          }
        });
      }
    });
  }
  function restoreBackup(kind, file) {
    var back = function () { Lampa.Controller.toggle('settings_component'); };
    if (kind === 'settings') {
      req('POST', '/backups', {action: 'get', file: file}).then(function (r) {
        var data = r.data || {};
        // the synced data (bookmarks, marks, filters, search) is not taken from a settings backup: it would
        // overwrite the server's newer copy on every device
        var jobs = Object.keys(data).filter(function (k) { return k.indexOf('lsync_') !== 0 && !watched(k); }).map(function (k) {
          try { return Lampa.Storage.restore ? Lampa.Storage.restore(k, data[k]) : (window.localStorage.setItem(k, data[k]), Promise.resolve(true)); }
          catch (e) { return Promise.resolve(false); }
        });
        Promise.all(jobs).then(function () { noty('restored'); setTimeout(function () { window.location.reload(); }, 3000); });
      }, function () { noty('fail'); back(); });
    } else {
      req('POST', '/restore', {file: file, profile: profileId()}).then(function () {
        noty('restored_data'); back(); syncNow(false);
      }, function () { noty('fail'); back(); });
    }
  }

  // ------------------------------------------------------------------ devices
  function devicesMenu() {
    var back = function () { Lampa.Controller.toggle('settings_component'); };
    req('GET', '/devices').then(function (j) {
      Lampa.Select.show({
        title: t('devices'), onBack: back,
        items: j.devices.map(function (d) {
          return {title: d.name + (d.me ? ' (' + t('this_device') + ')' : ''), subtitle: t('seen', {a: ago(d.seen)}), id: d.id, me: d.me, name: d.name};
        }),
        onSelect: function (a) {
          var again = function () { devicesMenu(); };
          Lampa.Select.show({
            title: a.name, onBack: again,
            items: [{title: t('rename'), act: 'rename'}, {title: t('disconnect_one'), act: 'revoke'}],
            onSelect: function (x) {
              if (x.act === 'rename') {
                Lampa.Input.edit({free: true, title: t('device_name'), nosave: true, value: a.name}, function (name) {
                  name = String(name || '').trim();
                  if (!name || name === a.name) return again();
                  req('POST', '/devices/rename', {id: a.id, name: name}).then(again, function () { noty('fail'); again(); });
                });
                return;
              }
              confirm(t('revoke_q', {n: a.name}), function () {
                req('POST', '/devices/revoke', {id: a.id}).then(function () { if (a.me) forget(false); back(); reopenSettings(); }, function () { noty('fail'); again(); });
              }, again);
            }
          });
        }
      });
    }, function () { noty('pair_fail'); });
  }

  // ------------------------------------------------------------------ profiles (own, while CUB sync is off)
  var css = '' +
    '.lsync-pair{padding:1em 0;text-align:center;line-height:1.5}.lsync-pair__code{font-size:2em;margin:.6em 0}.lsync-pair__wait{opacity:.6}' +
    '.lsync-who{display:flex;flex-direction:column;align-items:center;gap:1.6em;padding:1em 0 1.5em}' +
    '.lsync-who__list{display:flex;flex-wrap:wrap;justify-content:center;gap:2em}' +
    '.lsync-who__item{display:flex;flex-direction:column;align-items:center;gap:.7em;padding:.4em;border-radius:1em}' +
    '.lsync-who__ava{width:6em;height:6em;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2.4em;font-weight:700;color:#fff;transition:transform .2s,box-shadow .2s}' +
    '.lsync-who__item.focus .lsync-who__ava{transform:scale(1.08);box-shadow:0 0 0 .18em #fff,0 1em 2em rgba(0,0,0,.5)}' +
    '.lsync-who__name{font-size:1.1em;opacity:.75}.lsync-who__item.focus .lsync-who__name{opacity:1;font-weight:600}' +
    '.lsync-who__add .lsync-who__ava{background:rgba(255,255,255,.08);border:.12em dashed rgba(255,255,255,.3);font-weight:400}' +
    '.lsync-pin{display:flex;flex-direction:column;align-items:center;gap:1.2em;padding:.5em 0 1em}' +
    '.lsync-pin__dots{display:flex;gap:1em}.lsync-pin__dots span{width:1em;height:1em;border-radius:50%;border:.12em solid rgba(255,255,255,.5)}' +
    '.lsync-pin__dots span.on{background:#fff;border-color:#fff}.lsync-pin__err{color:#ff7b72;min-height:1.3em}' +
    '.lsync-pin__keys{display:flex;flex-wrap:wrap;justify-content:center;gap:.4em;max-width:100%}' +
    '.lsync-pin__key{min-width:2.4em;padding:.55em .5em;text-align:center;border-radius:.6em;background:rgba(255,255,255,.1);font-size:1.3em;font-weight:600}' +
    '.lsync-pin__key.focus{background:#fff;color:#000}.lsync-pin__hint{opacity:.55;font-size:.9em}' +
    '.button--lsync.active svg path{fill:currentColor}';
  $('head').append('<style id="lsync-css">' + css + '</style>');

  function initial(p) { var n = profileName(p).trim(); return n ? n.charAt(0).toUpperCase() : '?'; }
  function whoIsWatching(onDone, startup) {
    var html = $('<div class="lsync-who"><div class="lsync-who__list"></div></div>'), list = html.find('.lsync-who__list');
    S.profiles.forEach(function (p) {
      var item = $('<div class="lsync-who__item selector"><div class="lsync-who__ava"></div><div class="lsync-who__name"></div></div>');
      item.find('.lsync-who__ava').text(initial(p)).css('background', p.color || COLORS[0]);
      item.find('.lsync-who__name').text(profileName(p) + (p.pin ? ' 🔒' : ''));
      item.data('pid', p.id);
      list.append(item);
    });
    var add = $('<div class="lsync-who__item lsync-who__add selector"><div class="lsync-who__ava">+</div><div class="lsync-who__name"></div></div>');
    add.find('.lsync-who__name').text(t('add')); add.data('add', 1);
    list.append(add);
    var cur = list.find('.selector').filter(function () { return $(this).data('pid') === profileId(); })[0];
    var curP = profileOf(profileId());
    var done = function () {
      if (startup && curP && curP.pin && !S.pinOk[curP.id]) return;     // a locked profile: pick one first
      Lampa.Modal.close(); if (onDone) onDone();
    };
    Lampa.Modal.open({
      title: t('who'), html: html, size: 'medium', align: 'center', select: cur,
      onBack: done,
      onSelect: function (el) {
        if (el.data('add')) { Lampa.Modal.close(); return editProfile(null, function () { whoIsWatching(onDone, startup); }); }
        var p = profileOf(el.data('pid'));
        if (!p) return;
        var go = function () { S.pinOk[p.id] = true; Lampa.Modal.close(); switchTo(p.id); if (onDone) onDone(); };
        if (p.pin && !S.pinOk[p.id] && (startup || p.id !== profileId())) { Lampa.Modal.close(); askPin(p, go, function () { whoIsWatching(onDone, startup); }); }
        else go();
      }
    });
  }
  function switchTo(pid) {
    if (pid === profileId()) return;
    // what is not sent yet goes to the old profile first
    syncNow(false).then(function () { setProfile(pid); return syncNow(false); }).then(function () { reopenSettings(true); });
  }
  function askPin(p, ok, back) {
    var digits = '', keyHandler = null;
    var html = $('<div class="lsync-pin"><div class="lsync-pin__title"></div><div class="lsync-pin__dots"><span></span><span></span><span></span><span></span></div>' +
      '<div class="lsync-pin__err"></div><div class="lsync-pin__keys"></div><div class="lsync-pin__hint"></div></div>');
    html.find('.lsync-pin__title').text(t('pin_enter', {n: profileName(p)}));
    html.find('.lsync-pin__hint').text(t('pin_hint'));
    var keys = html.find('.lsync-pin__keys');
    '1234567890'.split('').forEach(function (d) { keys.append($('<div class="lsync-pin__key selector"></div>').text(d).data('d', d)); });
    keys.append($('<div class="lsync-pin__key selector"></div>').text('⌫').attr('aria-label', t('pin_erase')).data('d', 'x'));
    function draw() { html.find('.lsync-pin__dots span').each(function (i) { $(this).toggleClass('on', i < digits.length); }); }
    function finish(fn) { document.removeEventListener('keydown', keyHandler, true); Lampa.Modal.close(); fn(); }
    function press(d) {
      if (d === 'x') { digits = digits.slice(0, -1); draw(); return; }
      if (digits.length >= 4) return;
      digits += d; draw();
      if (digits.length < 4) return;
      req('POST', '/profile/check', {id: p.id, pin: digits}).then(function () { finish(ok); }, function (e) {
        digits = ''; draw();
        var b = e && e.body || {};
        html.find('.lsync-pin__err').text(b.locked ? t('pin_locked', {n: Math.ceil((b.retry || 900) / 60)}) : b.left != null ? t('pin_wrong', {n: b.left}) : t('pair_fail'));
      });
    }
    keyHandler = function (ev) {
      var c = ev.keyCode, d = c >= 48 && c <= 57 ? String(c - 48) : c >= 96 && c <= 105 ? String(c - 96) : c === 8 ? 'x' : null;
      if (d === null) return;
      ev.preventDefault(); ev.stopPropagation(); press(d);
    };
    document.addEventListener('keydown', keyHandler, true);
    Lampa.Modal.open({
      title: t('profile'), html: html, size: 'medium', align: 'center',
      onBack: function () { finish(back); },
      onSelect: function (el) { press(el.data('d')); }
    });
  }
  function pinInput(title, call) {
    Lampa.Input.edit({free: true, title: title, nosave: true, value: '', layout: 'nums', keyboard: 'lampa', password: true}, function (v) { call(String(v || '').replace(/\D/g, '').slice(0, 4)); });
  }
  function editProfile(p, done) {
    var back = function () { if (done) done(); else Lampa.Controller.toggle('settings_component'); };
    if (!p) {
      Lampa.Input.edit({free: true, title: t('pr_name'), nosave: true, value: ''}, function (name) {
        name = String(name || '').trim();
        if (!name) return back();
        req('POST', '/profiles', {action: 'create', name: name}).then(function (j) { S.profiles = j.profiles; lsSet('profiles', S.profiles); back(); },
          function (e) { noty(e && e.status === 409 ? 'pr_limit' : 'fail'); back(); });
      });
      return;
    }
    var save = function (body) {
      body.action = 'update'; body.id = p.id;
      return req('POST', '/profiles', body).then(function (j) { S.profiles = j.profiles; lsSet('profiles', S.profiles); p = profileOf(p.id) || p; },
        function (e) { noty(e && e.status === 403 ? 'pin_wrong' : 'fail', {n: '–'}); });
    };
    var items = [{title: t('pr_rename'), subtitle: profileName(p), act: 'name'}, {title: t('pr_pin'), subtitle: p.pin ? t('pin_set') : '–', act: 'pin'}];
    if (p.pin) items.push({title: t('pr_pin_remove'), act: 'nopin'});
    items = items.concat([{title: t('pr_color'), act: 'color'}, {title: t('pr_child'), checkbox: true, checked: !!p.child, act: 'child'}, {title: t('pr_delete'), act: 'delete'}]);
    Lampa.Select.show({
      title: profileName(p), items: items, onBack: back,
      onCheck: function (a) { if (a.act === 'child') save({child: !p.child}); },
      onSelect: function (a) {
        var again = function () { editProfile(profileOf(p.id) || p, done); };
        if (a.act === 'name') {
          Lampa.Input.edit({free: true, title: t('pr_name'), nosave: true, value: p.name || ''}, function (name) {
            name = String(name || '').trim(); if (!name) return again(); save({name: name}).then(again);
          });
        } else if (a.act === 'pin') {
          var setNew = function (old) { pinInput(t('pr_pin_set'), function (pin) { if (pin.length !== 4) return again(); save({pin: pin, oldPin: old}).then(again); }); };
          if (p.pin) pinInput(t('pr_pin_old'), function (old) { if (old.length !== 4) return again(); setNew(old); }); else setNew('');
        } else if (a.act === 'nopin') {
          pinInput(t('pr_pin_old'), function (old) { if (old.length !== 4) return again(); save({pin: '', oldPin: old}).then(again); });
        } else if (a.act === 'color') {
          Lampa.Select.show({title: t('pr_color'), onBack: again,
            items: COLORS.map(function (c) { return {title: '<span style="display:inline-block;width:1em;height:1em;border-radius:50%;vertical-align:middle;background:' + c + '"></span>&nbsp; ' + c, color: c, selected: c === p.color}; }),
            onSelect: function (x) { save({color: x.color}).then(again); }});
        } else if (a.act === 'delete') {
          if (S.profiles.length <= 1) { noty('pr_last'); return again(); }
          confirm(t('pr_delete_q', {n: profileName(p)}), function () {
            var run = function (pin) {
              req('POST', '/profiles', {action: 'delete', id: p.id, pin: pin}).then(function (j) {
                S.profiles = j.profiles; lsSet('profiles', S.profiles);
                if (p.id === profileId()) { setProfile(S.profiles[0].id); syncNow(false); }
                back();
              }, function (e) { noty(e && e.status === 403 ? 'pin_wrong' : 'fail', {n: '–'}); back(); });
            };
            if (p.pin) pinInput(t('pr_pin_old'), run); else run('');
          }, again);
        }
      }
    });
  }
  function profilesMenu() {
    var back = function () { Lampa.Controller.toggle('settings_component'); };
    refreshMe().then(function () {
      var items = S.profiles.map(function (p) { return {title: profileName(p), subtitle: (p.pin ? t('pin_set') : '') + (p.id === profileId() ? (p.pin ? ' · ' : '') + t('this_device') : ''), p: p}; });
      items.push({title: t('new_profile'), add: true});
      Lampa.Select.show({title: t('profiles_manage'), items: items, onBack: back,
        onSelect: function (a) { editProfile(a.add ? null : a.p, function () { profilesMenu(); }); }});
    }, function () { noty('pair_fail'); });
  }

  // ------------------------------------------------------------------ "follow new episodes" on a series card
  var BELL = '<svg viewBox="0 0 25 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.01892 24C6.27423 27.3562 9.07836 30 12.5 30C15.9216 30 18.7257 27.3562 18.981 24H15.9645C15.7219 25.6961 14.2632 27 12.5 27C10.7367 27 9.27804 25.6961 9.03542 24H6.01892Z" fill="currentColor"></path><path d="M3.81972 14.5957V10.2679C3.81972 5.41336 7.7181 1.5 12.5 1.5C17.2819 1.5 21.1803 5.41336 21.1803 10.2679V14.5957C21.1803 15.8462 21.5399 17.0709 22.2168 18.1213L23.0727 19.4494C24.2077 21.2106 22.9392 23.5 20.9098 23.5H4.09021C2.06084 23.5 0.792282 21.2106 1.9273 19.4494L2.78317 18.1213C3.46012 17.0709 3.81972 15.8462 3.81972 14.5957Z" stroke="currentColor" stroke-width="2.6"></path></svg>';
  function isTv(c) { return !!(c && (c.number_of_seasons || c.first_air_date || c.original_name || c.media_type === 'tv') && c.id); }
  function followList() { var v = Lampa.Storage.get('lsync_follow', '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? clone(v) : {}; }
  function follows(id) { var f = followList()[id]; return !!(f && f.on !== false); }
  function drawFollow(btn, id) {
    var yes = follows(id);
    btn.toggleClass('active', yes).find('span').text(t(yes ? 'follow_on' : 'follow_off'));
  }
  Lampa.Listener.follow('full', function (e) {
    if (e.type !== 'complite') return;
    try {
      var card = e.data && e.data.movie;
      if (!isTv(card) || (card.source && card.source !== 'tmdb' && card.source !== 'cub')) return;
      var root = e.object && e.object.activity ? e.object.activity.render() : e.body;
      var box = root.find('.full-start-new__buttons');
      if (!box.length) box = root.find('.full-start__buttons');
      if (!box.length || box.find('.button--lsync').length) return;
      var btn = $('<div class="full-start__button selector button--lsync">' + BELL + '<span></span></div>');
      drawFollow(btn, card.id);
      btn.on('hover:enter', function () {
        if (!lsGet('token', '')) return noty('need_connect');
        var f = followList(), yes = !follows(card.id);
        if (yes) f[card.id] = {on: true, name: card.name || card.original_name || '', t: Date.now()};
        else delete f[card.id];
        Lampa.Storage.set('lsync_follow', f);          // the change listener sends it
        drawFollow(btn, card.id);
        noty(yes ? 'follow_on_n' : 'follow_off_n');
      });
      var opts = box.find('.button--options');
      if (opts.length) opts.before(btn); else box.append(btn);
    } catch (x) { /* a card layout we do not know */ }
  });

  // ------------------------------------------------------------------ settings page
  var statusEl = null;
  function statusText() {
    if (!lsGet('token', '')) return t('st_off');
    var s = S.error ? t('st_err') : t('st_on');
    return s + ' · ' + t('st_last', {a: ago(S.lastOk)});
  }
  function updateStatus() { if (statusEl && statusEl.length) statusEl.find('.settings-param__name').text(statusText()); }
  function reopenSettings(force) {
    try {
      var en = Lampa.Controller.enabled();
      if (force || (en && en.name === 'settings_component' && $('.settings').length && statusEl && document.body.contains(statusEl[0]))) Lampa.Settings.create('lsync');
    } catch (e) { /* */ }
  }
  function param(p) { p.component = 'lsync'; Lampa.SettingsApi.addParam(p); }
  function YESNO() { return {on: t('yes'), off: t('no')}; }
  // Lampa calls onRender before the item is on the page (remove() would not stick): hidden and out of the navigation
  function hideItem(item) { item.removeClass('selector').addClass('hide').css('display', 'none'); }
  function onlyIf(cond) { return function (item) { if (!cond()) hideItem(item); }; }
  var connected = function () { return !!lsGet('token', ''); };

  Lampa.SettingsApi.addComponent({
    component: 'lsync', name: t('title'),
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-15.5 6.2"></path><path d="M3 12A9 9 0 0 1 18.5 5.8"></path><path d="M18 2v4h-4"></path><path d="M6 22v-4h4"></path></svg>'
  });
  param({param: {name: 'lsync_status_line', type: 'static'}, field: {name: t('st_off')},
    onRender: function (item) {
      statusEl = item; updateStatus();
      item.find('.settings-param__descr').remove();
      if (connected()) item.append($('<div class="settings-param__descr"></div>').text(cubOn() ? t('st_cub') : t('st_local')));
      if (connected() && !S.busy && Date.now() - S.lastOk > 30000) syncNow(false);
    }});
  param({param: {name: 'lsync_connect', type: 'button'}, field: {name: t('connect'), description: t('connect_d')}, onRender: onlyIf(function () { return !connected(); }), onChange: pair});
  param({param: {name: 'lsync_profile_title', type: 'title'}, field: {name: t('profile')}, onRender: onlyIf(connected)});
  param({param: {name: 'lsync_profile_line', type: 'static'}, field: {name: t('profile')},
    onRender: function (item) {
      if (!connected()) return hideItem(item);
      item.find('.settings-param__name').text(profileName(profileOf(profileId())) || '–');
      if (cubOn()) item.append($('<div class="settings-param__descr"></div>').text(t('profile_cub')));
    }});
  param({param: {name: 'lsync_profile_switch', type: 'button'}, field: {name: t('profile_change')},
    onRender: onlyIf(function () { return connected() && !cubOn(); }),
    onChange: function () { refreshMe().then(function () { whoIsWatching(function () { Lampa.Controller.toggle('settings_component'); }); }, function () { noty('pair_fail'); }); }});
  param({param: {name: 'lsync_profiles', type: 'button'}, field: {name: t('profiles_manage')}, onRender: onlyIf(function () { return connected() && !cubOn(); }), onChange: profilesMenu});
  param({param: {name: 'lsync_ask_profile', type: 'select', values: YESNO(), default: 'on'}, field: {name: t('ask_profile')}, onRender: onlyIf(function () { return connected() && !cubOn(); })});
  param({param: {name: 'lsync_what', type: 'title'}, field: {name: t('what')}});
  param({param: {name: 'lsync_fav', type: 'select', values: YESNO(), default: 'on'}, field: {name: t('fav'), description: t('fav_d')}, onChange: function () { schedule(1000); }});
  param({param: {name: 'lsync_marks', type: 'select', values: YESNO(), default: 'on'}, field: {name: t('marks'), description: t('marks_d')}, onChange: function () { schedule(1000); }});
  param({param: {name: 'lsync_filters', type: 'select', values: YESNO(), default: 'on'}, field: {name: t('filters'), description: t('filters_d')}, onChange: function () { schedule(1000); }});
  param({param: {name: 'lsync_search', type: 'select', values: YESNO(), default: 'on'}, field: {name: t('search'), description: t('search_d')}, onChange: function () { schedule(1000); }});
  param({param: {name: 'lsync_notify_title', type: 'title'}, field: {name: t('notify')}});
  param({param: {name: 'lsync_notify_line', type: 'static'}, field: {name: t('followed', {n: 0}), description: t('notify_d')},
    onRender: function (item) { item.find('.settings-param__name').text(t('followed', {n: Object.keys(followList()).length})); }});
  param({param: {name: 'lsync_actions', type: 'title'}, field: {name: t('actions')}, onRender: onlyIf(connected)});
  param({param: {name: 'lsync_now', type: 'button'}, field: {name: t('now')}, onRender: onlyIf(connected), onChange: function () { syncNow(true); }});
  param({param: {name: 'lsync_backups', type: 'button'}, field: {name: t('backups')}, onRender: onlyIf(connected), onChange: backupsMenu});
  param({param: {name: 'lsync_auto_backup', type: 'select', values: YESNO(), default: 'on'}, field: {name: t('auto_backup')}, onRender: onlyIf(connected)});
  param({param: {name: 'lsync_devices', type: 'button'}, field: {name: t('devices')}, onRender: onlyIf(connected), onChange: devicesMenu});
  param({param: {name: 'lsync_disconnect', type: 'button'}, field: {name: t('disconnect')}, onRender: onlyIf(connected),
    onChange: function () { confirm(t('disconnect_q'), function () { forget(false); reopenSettings(true); }, function () { Lampa.Controller.toggle('settings_component'); }); }});
  param({param: {name: 'lsync_version', type: 'static'}, field: {name: t('version') + ': ' + VERSION}});

  // ------------------------------------------------------------------ start
  function watched(name) {
    if (!name) return false;
    if (name === 'favorite' || name === 'search_history' || name === 'torrents_filter' || name === 'lsync_follow' || name === 'lsync_status') return true;
    if (name === 'file_view' || name.indexOf('file_view_') === 0) return true;
    return name.indexOf('online_') === 0 && !SKIP_ONLINE.test(name);
  }
  function start() {
    Lampa.Storage.listener.follow('change', function (e) { if (connected() && watched(e.name)) schedule(3000); });
    // with CUB the bookmarks change in its module, not in the storage
    Lampa.Listener.follow('state:changed', function (e) { if (connected() && e && e.target === 'favorite' && cubOn()) schedule(4000); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && connected()) schedule(1500); });
    setInterval(function () { if (connected() && !document.hidden) syncNow(false); }, 60000);
    if (!connected()) return;
    refreshMe().then(function () {
      if (!cubOn() && S.profiles.length > 1 && on('lsync_ask_profile')) {
        var ctrl = Lampa.Controller.enabled() ? Lampa.Controller.enabled().name : 'content';
        S.pinOk = {};
        whoIsWatching(function () { try { Lampa.Controller.toggle(ctrl); } catch (e) { /* */ } }, true);
      }
    }, function () { /* offline: the cached profile list is used */ }).then(function () { setTimeout(function () { syncNow(false); }, 3000); });
  }
  if (window.appready) start();
  else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
})();
