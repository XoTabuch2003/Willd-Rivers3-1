const STORAGE_KEY = 'dyki_richky_articles_v1';
const THEMES_KEY = 'dyki_richky_themes';
const COVER_KEY = 'dyki_richky_cover';
const GH_KEY = 'dyki_richky_github';
const DATA_URL = 'articles.json';

const DEFAULT_THEMES = [
  { id: 'fish', name: 'Риби', icon: '🐟' },
  { id: 'river', name: 'Річки', icon: '🌊' },
  { id: 'plant', name: 'Рослинність', icon: '🌿' },
  { id: 'animal', name: 'Тварини', icon: '🦊' },
  { id: 'bird', name: 'Птахи', icon: '🐦' },
  { id: 'research', name: 'Дослідження', icon: '🔬' }
];

let articles = [];
let themes = [];
let dataLoaded = false;
let currentThemeFilter = '';
let formMap = null, formMarker = null, homeMap = null;

// ===== Load / Save =====
async function loadArticles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length) { articles = p; dataLoaded = true; return; }
    }
  } catch(e){}
  try {
    const res = await fetch(DATA_URL + '?t=' + Date.now());
    if (res.ok) {
      const d = await res.json();
      if (Array.isArray(d)) { articles = d; dataLoaded = true; return; }
    }
  } catch(e){}
  articles = []; dataLoaded = true;
}

function saveArticlesLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
}

function loadThemes() {
  try {
    const raw = localStorage.getItem(THEMES_KEY);
    if (raw) { themes = JSON.parse(raw); return; }
  } catch(e){}
  themes = [...DEFAULT_THEMES];
  localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
}

function saveThemes() {
  localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
  renderThemeButtons();
  populateThemeSelect();
  renderThemesSettings();
}

// ===== GitHub Auto Publish =====
function getGithubSettings() {
  try { return JSON.parse(localStorage.getItem(GH_KEY) || '{}'); } catch(e){ return {}; }
}
function saveGithubSettings() {
  const s = {
    user: document.getElementById('gh-user').value.trim(),
    repo: document.getElementById('gh-repo').value.trim(),
    token: document.getElementById('gh-token').value.trim()
  };
  localStorage.setItem(GH_KEY, JSON.stringify(s));
  document.getElementById('gh-status').style.display = 'block';
  document.getElementById('gh-status').textContent = '✓ Налаштування збережено';
  updatePublishHint();
}
async function testGithub() {
  const s = getGithubSettings();
  const status = document.getElementById('gh-status');
  status.style.display = 'block';
  if (!s.token || !s.user || !s.repo) {
    status.textContent = 'Заповніть усі поля';
    return;
  }
  status.textContent = 'Перевіряю...';
  try {
    const res = await fetch(`https://api.github.com/repos/${s.user}/${s.repo}/contents/articles.json`, {
      headers: { Authorization: 'token ' + s.token, Accept: 'application/vnd.github.v3+json' }
    });
    if (res.ok || res.status === 404) {
      status.textContent = '✓ З’єднання успішне! Автопублікація увімкнена.';
    } else {
      status.textContent = 'Помилка: ' + res.status + ' — перевірте токен і права repo';
    }
  } catch(e) {
    status.textContent = 'Помилка мережі: ' + e.message;
  }
}

async function publishToGithub() {
  const s = getGithubSettings();
  if (!s.token || !s.user || !s.repo) return { ok: false, msg: 'Токен не налаштовано' };

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(articles, null, 2))));
  let sha = null;
  try {
    const getRes = await fetch(`https://api.github.com/repos/${s.user}/${s.repo}/contents/articles.json`, {
      headers: { Authorization: 'token ' + s.token, Accept: 'application/vnd.github.v3+json' }
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch(e) {}

  const body = {
    message: 'Оновлення статей — ' + new Date().toLocaleString('uk'),
    content: content,
    branch: 'main'
  };
  if (sha) body.sha = sha;

  try {
    const res = await fetch(`https://api.github.com/repos/${s.user}/${s.repo}/contents/articles.json`, {
      method: 'PUT',
      headers: {
        Authorization: 'token ' + s.token,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (res.ok) return { ok: true, msg: 'Опубліковано на GitHub!' };
    const err = await res.json().catch(() => ({}));
    return { ok: false, msg: 'Помилка GitHub: ' + (err.message || res.status) };
  } catch(e) {
    return { ok: false, msg: 'Помилка: ' + e.message };
  }
}

function updatePublishHint() {
  const s = getGithubSettings();
  const el = document.getElementById('publish-hint');
  if (!el) return;
  if (s.token && s.user && s.repo) {
    el.innerHTML = '✅ <strong>Автопублікація увімкнена.</strong> Після збереження стаття одразу з’явиться на сайті для всіх.';
  } else {
    el.innerHTML = 'Стаття збережеться локально. Щоб публікувати автоматично — налаштуйте GitHub-токен у <a href="#settings" onclick="showPage(\'settings\')">Налаштуваннях</a>.';
  }
}

// ===== Cover =====
function loadCover() {
  const cover = localStorage.getItem(COVER_KEY) || 'cover-01.png';
  const hero = document.getElementById('heroBlock');
  if (hero) hero.style.backgroundImage = `url('${cover}')`;
}
function saveCover() {
  const url = document.getElementById('cover-url').value.trim();
  const file = document.getElementById('cover-file').files[0];
  if (file) {
    const r = new FileReader();
    r.onload = () => { localStorage.setItem(COVER_KEY, r.result); loadCover(); alert('Збережено'); };
    r.readAsDataURL(file);
  } else if (url) {
    localStorage.setItem(COVER_KEY, url); loadCover(); alert('Збережено');
  } else alert('Вкажіть URL або файл');
}
function resetCover() {
  localStorage.removeItem(COVER_KEY); loadCover();
  document.getElementById('cover-url').value = '';
  document.getElementById('coverPreview').innerHTML = '';
}
function handleCoverUpload(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { document.getElementById('coverPreview').innerHTML = `<img src="${r.result}" style="max-height:140px;border-radius:10px">`; };
  r.readAsDataURL(f);
}

// ===== Themes =====
function renderThemeButtons() {
  const html = themes.map(t =>
    `<button class="theme-btn ${currentThemeFilter === t.id ? 'active' : ''}" onclick="filterByTheme('${t.id}')">${t.icon} ${t.name}</button>`
  ).join('') + `<button class="theme-btn ${currentThemeFilter === '' ? 'active' : ''}" onclick="filterByTheme('')">📋 Усі</button>`;

  const home = document.getElementById('theme-buttons');
  const cat = document.getElementById('catalog-theme-buttons');
  if (home) home.innerHTML = html;
  if (cat) cat.innerHTML = html;
}

function populateThemeSelect() {
  const sel = document.getElementById('f-type');
  if (!sel) return;
  sel.innerHTML = themes.map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('');
}

function renderThemesSettings() {
  const list = document.getElementById('themes-list');
  if (!list) return;
  list.innerHTML = themes.map((t, i) => `
    <div class="theme-item">
      <span class="theme-icon">${t.icon}</span>
      <span class="theme-name">${escapeHtml(t.name)}</span>
      <button type="button" class="btn-icon" onclick="editTheme(${i})" title="Редагувати">✏️</button>
      <button type="button" class="btn-icon" onclick="deleteTheme(${i})" title="Видалити">🗑️</button>
    </div>
  `).join('');
}

function addTheme() {
  const name = document.getElementById('new-theme-name').value.trim();
  const icon = document.getElementById('new-theme-icon').value.trim() || '📌';
  if (!name) return alert('Введіть назву');
  const id = 'theme_' + Date.now().toString(36);
  themes.push({ id, name, icon });
  saveThemes();
  document.getElementById('new-theme-name').value = '';
  document.getElementById('new-theme-icon').value = '';
}

function editTheme(i) {
  const t = themes[i];
  const name = prompt('Назва тематики:', t.name);
  if (name === null) return;
  const icon = prompt('Іконка (емодзі):', t.icon);
  if (icon === null) return;
  themes[i] = { ...t, name: name.trim() || t.name, icon: icon.trim() || t.icon };
  saveThemes();
}

function deleteTheme(i) {
  if (themes.length <= 1) return alert('Має залишитись хоча б одна тематика');
  if (!confirm('Видалити тематику «' + themes[i].name + '»?')) return;
  themes.splice(i, 1);
  saveThemes();
}

function filterByTheme(id) {
  currentThemeFilter = id;
  renderThemeButtons();
  if (document.getElementById('page-catalog').classList.contains('active')) {
    filterCatalog();
  } else {
    showPage('catalog');
  }
}

function getTheme(id) {
  return themes.find(t => t.id === id) || { icon: '📌', name: id };
}

// ===== Navigation =====
function showPage(pageId, articleId = null) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  document.getElementById('mainNav').classList.remove('open');
  document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
  const nav = document.querySelector(`.nav a[href="#${pageId}"]`);
  if (nav) nav.classList.add('active');

  if (pageId === 'home') { renderRecent(); setTimeout(initHomeMap, 120); }
  if (pageId === 'catalog') renderCatalog();
  if (pageId === 'article' && articleId) renderArticle(articleId);
  if (pageId === 'add') { populateThemeSelect(); updatePublishHint(); setTimeout(initFormMap, 120); }
  if (pageId === 'settings') {
    const s = getGithubSettings();
    document.getElementById('gh-user').value = s.user || '';
    document.getElementById('gh-repo').value = s.repo || '';
    document.getElementById('gh-token').value = s.token || '';
    renderThemesSettings();
  }

  window.scrollTo(0, 0);
  history.replaceState(null, '', pageId === 'article' && articleId ? '#article/' + articleId : '#' + pageId);
}

document.getElementById('navToggle').addEventListener('click', () => {
  document.getElementById('mainNav').classList.toggle('open');
});

// ===== Init =====
async function init() {
  loadThemes();
  await loadArticles();
  articles = articles.map(a => ({ type: a.type || 'fish', ...a }));
  loadCover();
  renderThemeButtons();
  populateThemeSelect();

  const hash = location.hash.slice(1);
  if (hash.startsWith('article/')) showPage('article', hash.split('/')[1]);
  else if (['home','catalog','add','settings','about'].includes(hash)) showPage(hash);
  else showPage('home');
}
window.addEventListener('load', init);

// ===== Geo =====
async function searchPlace() {
  const q = document.getElementById('f-geoSearch').value.trim();
  if (!q) return alert('Введіть назву');
  const box = document.getElementById('geoResults');
  box.innerHTML = '<p style="padding:8px;color:#666">Шукаю...</p>';
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ua&limit=5&accept-language=uk`);
    const data = await res.json();
    if (!data.length) { box.innerHTML = '<p style="padding:8px;color:#666">Нічого не знайдено</p>'; return; }
    box.innerHTML = data.map(item =>
      `<button type="button" class="geo-result-btn" onclick="selectPlace(${item.lat},${item.lon},'${escapeHtml(item.display_name).replace(/'/g,"\\'")}')">📍 ${escapeHtml(item.display_name)}</button>`
    ).join('');
  } catch(e) {
    box.innerHTML = '<p style="padding:8px;color:#b33">Помилка пошуку</p>';
  }
}
function selectPlace(lat, lon, name) {
  document.getElementById('f-lat').value = parseFloat(lat).toFixed(5);
  document.getElementById('f-lon').value = parseFloat(lon).toFixed(5);
  document.getElementById('geoResults').innerHTML = `<p class="geo-selected">✓ ${escapeHtml(name)}</p>`;
  updateFormMapMarker(parseFloat(lat), parseFloat(lon));
}
function getCurrentLocation() {
  if (!navigator.geolocation) return alert('Не підтримується');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(5);
      const lon = pos.coords.longitude.toFixed(5);
      document.getElementById('f-lat').value = lat;
      document.getElementById('f-lon').value = lon;
      updateFormMapMarker(+lat, +lon);
    },
    err => alert('Не вдалося отримати місце. Використайте пошук за назвою або клік по карті.')
  );
}

function initFormMap() {
  const el = document.getElementById('form-map');
  if (!el || typeof L === 'undefined') return;
  if (formMap) { formMap.remove(); formMap = null; formMarker = null; }
  formMap = L.map('form-map').setView([49, 31.5], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(formMap);
  formMap.on('click', e => {
    document.getElementById('f-lat').value = e.latlng.lat.toFixed(5);
    document.getElementById('f-lon').value = e.latlng.lng.toFixed(5);
    updateFormMapMarker(e.latlng.lat, e.latlng.lng);
  });
  const lat = parseFloat(document.getElementById('f-lat').value);
  const lon = parseFloat(document.getElementById('f-lon').value);
  if (lat && lon) updateFormMapMarker(lat, lon);
  setTimeout(() => formMap.invalidateSize(), 200);
}
function updateFormMapMarker(lat, lon) {
  if (!formMap) return;
  if (formMarker) formMap.removeLayer(formMarker);
  formMarker = L.marker([lat, lon]).addTo(formMap);
  formMap.setView([lat, lon], 11);
}

// ===== Home map =====
function initHomeMap() {
  const el = document.getElementById('home-map');
  if (!el || typeof L === 'undefined') return;
  if (homeMap) { homeMap.remove(); homeMap = null; }
  homeMap = L.map('home-map').setView([48.5, 31.5], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(homeMap);

  const withCoords = articles.filter(a => a.lat && a.lon);
  withCoords.forEach(a => {
    const t = getTheme(a.type);
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="map-pin">${t.icon}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    L.marker([+a.lat, +a.lon], { icon }).addTo(homeMap)
      .bindPopup(`<b>${escapeHtml(a.name)}</b><br>${t.icon} ${escapeHtml(t.name)}<br>${escapeHtml(a.water||'')}<br><a href="#" onclick="showPage('article','${a.id}');return false">Відкрити →</a>`);
  });
  if (withCoords.length > 1) {
    homeMap.fitBounds(withCoords.map(a => [+a.lat, +a.lon]), { padding: [40, 40], maxZoom: 9 });
  }
  setTimeout(() => homeMap.invalidateSize(), 200);
}

// ===== Render =====
function renderCard(a) {
  const t = getTheme(a.type);
  const photo = a.photo ? `background-image:url('${a.photo}')` : '';
  return `<article class="card" onclick="showPage('article','${a.id}')">
    <div class="card-img" style="${photo}">
      <span class="badge badge-type">${t.icon} ${escapeHtml(t.name)}</span>
      ${a.status ? `<span class="badge">${escapeHtml(a.status)}</span>` : ''}
    </div>
    <div class="card-body">
      <h3>${escapeHtml(a.name)}</h3>
      ${a.latin ? `<div class="card-latin">${escapeHtml(a.latin)}</div>` : ''}
      <div class="card-meta">
        ${a.water ? `<span>🌊 ${escapeHtml(shorten(a.water,38))}</span>` : ''}
        ${a.period ? `<span>📅 ${escapeHtml(shorten(a.period,22))}</span>` : ''}
      </div>
    </div>
  </article>`;
}

function renderRecent() {
  const list = document.getElementById('recent-list');
  if (!dataLoaded) { list.innerHTML = '<div class="empty-state">Завантаження...</div>'; return; }
  const sorted = [...articles].sort((a,b) => (b.created||'').localeCompare(a.created||'')).slice(0, 6);
  list.innerHTML = sorted.length ? sorted.map(renderCard).join('') :
    '<div class="empty-state"><p>Ще немає статей</p><button class="btn btn-primary" onclick="showPage(\'add\')">Додати</button></div>';
}

function renderCatalog() {
  const waterSel = document.getElementById('filterWater');
  const waters = [...new Set(articles.map(a => a.water).filter(Boolean))].sort();
  const cur = waterSel.value;
  waterSel.innerHTML = '<option value="">Усі водні об’єкти</option>' + waters.map(w =>
    `<option value="${escapeHtml(w)}" ${w===cur?'selected':''}>${escapeHtml(w)}</option>`).join('');
  filterCatalog();
}

function filterCatalog() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const water = document.getElementById('filterWater').value;
  let list = articles;
  if (currentThemeFilter) list = list.filter(a => (a.type || 'fish') === currentThemeFilter);
  if (q) list = list.filter(a =>
    (a.name||'').toLowerCase().includes(q) || (a.latin||'').toLowerCase().includes(q) ||
    (a.water||'').toLowerCase().includes(q) || (a.intro||'').toLowerCase().includes(q) || (a.body||'').toLowerCase().includes(q)
  );
  if (water) list = list.filter(a => a.water === water);
  const el = document.getElementById('catalog-list');
  el.innerHTML = list.length ? list.map(renderCard).join('') : '<div class="empty-state">Нічого не знайдено</div>';
}

function renderArticle(id) {
  const a = articles.find(x => x.id === id);
  if (!a) {
    document.getElementById('article-content').innerHTML = '<div class="empty-state">Не знайдено</div>';
    return;
  }
  const t = getTheme(a.type);
  const links = (a.links||'').split('\n').filter(Boolean).map(l =>
    `<li><a href="${escapeHtml(l.trim())}" target="_blank">${escapeHtml(l.trim())}</a></li>`).join('');

  document.getElementById('article-content').innerHTML = `
    <div class="article-header">
      <div class="type-badge-large">${t.icon} ${escapeHtml(t.name)}</div>
      <h1>${escapeHtml(a.name)}</h1>
      ${a.latin ? `<div class="article-latin">${escapeHtml(a.latin)}</div>` : ''}
      <div class="article-meta">
        ${a.water ? `<span><strong>Водний ресурс:</strong> ${escapeHtml(a.water)}</span>` : ''}
        ${a.period ? `<span><strong>Період:</strong> ${escapeHtml(a.period)}</span>` : ''}
        ${a.weather ? `<span><strong>Погода:</strong> ${escapeHtml(a.weather)}</span>` : ''}
        ${a.status ? `<span><strong>Статус:</strong> ${escapeHtml(a.status)}</span>` : ''}
      </div>
    </div>
    ${a.photo ? `<img src="${escapeHtml(a.photo)}" class="article-photo" onerror="this.style.display='none'">` : ''}
    ${a.intro ? `<div class="article-section"><p>${escapeHtml(a.intro)}</p></div>` : ''}
    ${a.body ? `<div class="article-section"><p style="white-space:pre-wrap">${escapeHtml(a.body)}</p></div>` : ''}
    ${a.morph ? `<div class="article-section"><h2>Морфологічні ознаки</h2><p>${escapeHtml(a.morph)}</p></div>` : ''}
    ${a.ecology ? `<div class="article-section"><h2>Екологія</h2><p>${escapeHtml(a.ecology)}</p></div>` : ''}
    ${a.feeding ? `<div class="article-section"><h2>Живлення</h2><p>${escapeHtml(a.feeding)}</p></div>` : ''}
    ${a.repro ? `<div class="article-section"><h2>Розмноження</h2><p>${escapeHtml(a.repro)}</p></div>` : ''}
    ${(a.lat && a.lon) ? `<div class="article-section"><h2>Геолокація</h2><p>${a.lat}, ${a.lon}</p><div id="map"></div></div>` : ''}
    ${links ? `<div class="article-section"><h2>Посилання</h2><ul class="links-list">${links}</ul></div>` : ''}
    <div class="article-actions">
      <button class="btn btn-secondary" onclick="showPage('catalog')">← Усі статті</button>
      <button class="btn btn-outline" onclick="editArticle('${a.id}')">✏️ Редагувати</button>
      <button class="btn btn-outline" style="color:#b33" onclick="deleteArticle('${a.id}')">🗑️ Видалити</button>
    </div>`;

  if (a.lat && a.lon) {
    setTimeout(() => {
      const m = L.map('map').setView([+a.lat, +a.lon], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(m);
      L.marker([+a.lat, +a.lon]).addTo(m).bindPopup(escapeHtml(a.name)).openPopup();
    }, 150);
  }
}

// ===== Form =====
document.getElementById('articleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editId').value || slugify(document.getElementById('f-name').value) + '-' + Date.now().toString(36);
  const photoFile = document.getElementById('f-photoFile').files[0];
  let photo = document.getElementById('f-photo').value.trim();

  const doSave = async (photoData) => {
    const article = {
      id,
      type: document.getElementById('f-type').value,
      name: document.getElementById('f-name').value.trim(),
      latin: document.getElementById('f-latin').value.trim(),
      water: document.getElementById('f-water').value.trim(),
      period: document.getElementById('f-period').value.trim(),
      weather: document.getElementById('f-weather').value.trim(),
      photo: photoData || photo,
      lat: document.getElementById('f-lat').value.trim() || null,
      lon: document.getElementById('f-lon').value.trim() || null,
      intro: document.getElementById('f-intro').value.trim(),
      body: document.getElementById('f-body').value.trim(),
      links: document.getElementById('f-links').value.trim(),
      status: document.getElementById('f-status').value.trim(),
      created: new Date().toISOString().slice(0, 10)
    };
    const idx = articles.findIndex(x => x.id === id);
    if (idx >= 0) articles[idx] = article; else articles.unshift(article);
    saveArticlesLocal();

    // Auto publish
    const btn = e.target.querySelector('[type=submit]');
    const oldText = btn.textContent;
    btn.textContent = 'Публікую...';
    btn.disabled = true;
    const result = await publishToGithub();
    btn.textContent = oldText;
    btn.disabled = false;

    if (result.ok) {
      alert('✅ Збережено і опубліковано на сайті для всіх!');
    } else {
      alert('Збережено локально.\n' + (result.msg || '') + '\n\nНалаштуйте токен у Налаштуваннях для автопублікації.');
    }
    resetForm();
    showPage('article', id);
  };

  if (photoFile) {
    const r = new FileReader();
    r.onload = () => doSave(r.result);
    r.readAsDataURL(photoFile);
  } else doSave(photo);
});

function resetForm() {
  document.getElementById('articleForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('form-title').textContent = 'Нове спостереження';
  document.getElementById('photoPreview').innerHTML = '';
  document.getElementById('geoResults').innerHTML = '';
  if (formMarker && formMap) { formMap.removeLayer(formMarker); formMarker = null; }
}

function editArticle(id) {
  const a = articles.find(x => x.id === id); if (!a) return;
  document.getElementById('editId').value = a.id;
  populateThemeSelect();
  document.getElementById('f-type').value = a.type || 'fish';
  document.getElementById('f-name').value = a.name || '';
  document.getElementById('f-latin').value = a.latin || '';
  document.getElementById('f-water').value = a.water || '';
  document.getElementById('f-period').value = a.period || '';
  document.getElementById('f-weather').value = a.weather || '';
  document.getElementById('f-photo').value = (a.photo && !a.photo.startsWith('data:')) ? a.photo : '';
  document.getElementById('f-lat').value = a.lat || '';
  document.getElementById('f-lon').value = a.lon || '';
  document.getElementById('f-intro').value = a.intro || '';
  document.getElementById('f-body').value = a.body || [a.morph, a.ecology, a.feeding, a.repro].filter(Boolean).join('\n\n') || '';
  document.getElementById('f-links').value = a.links || '';
  document.getElementById('f-status').value = a.status || '';
  document.getElementById('form-title').textContent = 'Редагувати: ' + a.name;
  showPage('add');
}

function deleteArticle(id) {
  if (!confirm('Видалити статтю?')) return;
  articles = articles.filter(x => x.id !== id);
  saveArticlesLocal();
  publishToGithub().then(() => showPage('catalog'));
}

function handlePhotoUpload(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    document.getElementById('photoPreview').innerHTML = `<img src="${r.result}" alt="preview">`;
    document.getElementById('f-photo').value = '';
  };
  r.readAsDataURL(f);
}

// ===== Export / Import =====
function exportData() {
  const blob = new Blob([JSON.stringify(articles, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'articles.json';
  a.click();
}
function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d)) throw new Error('Не масив');
      if (!confirm('Імпортувати ' + d.length + ' статей?')) return;
      articles = d; saveArticlesLocal();
      alert('Готово'); showPage('catalog');
    } catch(err) { alert('Помилка: ' + err.message); }
  };
  r.readAsText(f); e.target.value = '';
}

// ===== Helpers =====
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function shorten(s, n) { return !s ? '' : s.length > n ? s.slice(0,n)+'…' : s; }
function slugify(s) {
  return String(s||'a').toLowerCase().replace(/[^\wа-яєіїґ\s-]/gi,'').replace(/\s+/g,'-').slice(0,40);
}

// PWA install banner
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  if (document.getElementById('install-banner')) return;
  const b = document.createElement('div');
  b.id = 'install-banner';
  b.innerHTML = `<div style="position:fixed;bottom:0;left:0;right:0;background:#0d3b2e;color:#fff;padding:14px 16px;display:flex;gap:12px;align-items:center;z-index:9999">
    <div style="flex:1"><strong>Встановити застосунок</strong></div>
    <button id="install-btn" style="background:#2e8b57;color:#fff;border:none;padding:10px 16px;border-radius:999px;font-weight:600">Встановити</button>
    <button onclick="this.closest('#install-banner').remove()" style="background:none;border:none;color:#fff;font-size:1.3rem">×</button>
  </div>`;
  document.body.appendChild(b);
  document.getElementById('install-btn').onclick = async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; }
    b.remove();
  };
});
