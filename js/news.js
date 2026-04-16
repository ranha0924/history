/* ===== News Page ===== */
(function () {
  initPage('news');

  const monthSelect = document.getElementById('month-select');
  const daySelect = document.getElementById('day-select');
  const btnToday = document.getElementById('btn-today');
  const btnAll = document.getElementById('btn-all');
  const newsList = document.getElementById('news-list');
  const fullList = document.getElementById('full-list');
  const dateDisplay = document.getElementById('date-display');

  let showingAll = false;

  /* ---- Populate selects ---- */
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m + '월';
    monthSelect.appendChild(opt);
  }
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d + '일';
    daySelect.appendChild(opt);
  }

  /* ---- Set to today ---- */
  function setToday() {
    const now = new Date();
    monthSelect.value = now.getMonth() + 1;
    daySelect.value = now.getDate();
    showEventsForDate();
  }

  /* ---- Show events for selected date ---- */
  function showEventsForDate() {
    if (showingAll) toggleFullList();

    const month = parseInt(monthSelect.value);
    const day = parseInt(daySelect.value);
    dateDisplay.textContent = month + '월 ' + day + '일';

    const events = NEWS_DATA.filter(e => e.month === month && e.day === day);

    if (events.length === 0) {
      newsList.innerHTML = `
        <div class="no-results">
          <p>오늘은 조용한 날이었습니다.</p>
          <p style="margin-top:8px; font-size:0.85rem;">다른 날짜를 선택하거나 전체 보기를 눌러보세요.</p>
        </div>
      `;
      return;
    }

    newsList.innerHTML = events.map(e => {
      const yearText = e.year > 0 ? e.year + '년' : '기원전 ' + Math.abs(e.year) + '년';
      const eraColor = getEraColorVar(e.era);
      return `
        <article class="news-card" style="border-left-color: ${eraColor}">
          <div class="news-meta">
            <span class="news-year">${yearText}</span>
            ${getEraBadgeHTML(e.era)}
          </div>
          <h2 class="news-title">${escapeHTML(e.title)}</h2>
          <p class="news-body">${escapeHTML(e.desc)}</p>
        </article>
      `;
    }).join('');
  }

  /* ---- Era color helper ---- */
  function getEraColorVar(era) {
    const map = {
      '고조선': '#8B6914',
      '삼국': '#2E7D32',
      '남북국': '#1565C0',
      '고려': '#6A1B9A',
      '조선': '#C62828',
      '근현대': '#37474F'
    };
    return map[era] || '#8B1A1A';
  }

  /* ---- Full list mode ---- */
  function toggleFullList() {
    showingAll = !showingAll;
    fullList.hidden = !showingAll;
    newsList.hidden = showingAll;
    btnAll.textContent = showingAll ? '날짜별 보기' : '전체 보기';
    dateDisplay.textContent = showingAll ? '전체 사건' : monthSelect.value + '월 ' + daySelect.value + '일';

    if (showingAll && fullList.innerHTML === '') {
      renderFullList();
    }
  }

  function renderFullList() {
    const grouped = {};
    NEWS_DATA.forEach(e => {
      if (!grouped[e.month]) grouped[e.month] = [];
      grouped[e.month].push(e);
    });

    let html = '';
    for (let m = 1; m <= 12; m++) {
      const items = grouped[m];
      if (!items) continue;
      items.sort((a, b) => a.day - b.day);

      html += `
        <div class="month-group">
          <button class="month-group-header" data-month="${m}" aria-expanded="false">
            <span class="arrow">&#9654;</span>
            ${m}월 (${items.length}건)
          </button>
          <div class="month-group-items" hidden>
            ${items.map(e => {
              const yearText = e.year > 0 ? e.year + '년' : '기원전 ' + Math.abs(e.year) + '년';
              return `
                <div>
                  <button class="month-item" data-id="${e.month}-${e.day}" aria-expanded="false">
                    <span class="month-item-day">${e.day}일</span>
                    <span class="month-item-title">${escapeHTML(e.title)}</span>
                    <span class="month-item-year">${yearText}</span>
                    ${getEraBadgeHTML(e.era)}
                  </button>
                  <div class="month-item-desc" hidden>${escapeHTML(e.desc)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    fullList.innerHTML = html;

    /* Accordion for months */
    fullList.querySelectorAll('.month-group-header').forEach(btn => {
      btn.addEventListener('click', function () {
        const items = this.nextElementSibling;
        const isOpen = !items.hidden;
        items.hidden = isOpen;
        this.classList.toggle('open', !isOpen);
        this.setAttribute('aria-expanded', !isOpen);
      });
    });

    /* Accordion for individual items */
    fullList.querySelectorAll('.month-item').forEach(btn => {
      btn.addEventListener('click', function () {
        const desc = this.nextElementSibling;
        const isOpen = !desc.hidden;
        desc.hidden = isOpen;
        this.setAttribute('aria-expanded', !isOpen);
      });
    });
  }

  /* ---- Event listeners ---- */
  monthSelect.addEventListener('change', showEventsForDate);
  daySelect.addEventListener('change', showEventsForDate);
  btnToday.addEventListener('click', setToday);
  btnAll.addEventListener('click', toggleFullList);

  /* ---- Init ---- */
  setToday();
})();
