/* ===== Wiki Page ===== */
(function () {
  initPage('wiki');

  const STORAGE_KEY = 'korean_history_wiki';
  const ERAS = ['전체', '고조선', '삼국', '남북국', '고려', '조선', '근현대'];
  const CATEGORIES = ['전체', '인물', '사건', '제도', '문화'];
  const ERA_COLORS = {
    '고조선': '#94857A', '삼국': '#5E8B6A', '남북국': '#5A7FA0',
    '고려': '#7E6B9B', '조선': '#C08B5C', '근현대': '#5B8F8F'
  };

  let wikiItems = [];
  let currentEra = '전체';
  let currentCategory = '전체';
  let searchQuery = '';
  let isGraphView = false;

  /* ========== Data Persistence ========== */

  function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      wikiItems = JSON.parse(stored);
    } else {
      wikiItems = JSON.parse(JSON.stringify(WIKI_DATA));
      saveData();
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wikiItems));
    relationCache = null; /* 항목 변경 시 관계 그래프 재계산 */
  }

  function resetData() {
    if (!confirm('데이터를 초기 상태로 되돌리시겠습니까?\n추가/수정한 항목이 모두 사라집니다.')) return;
    localStorage.removeItem(STORAGE_KEY);
    wikiItems = JSON.parse(JSON.stringify(WIKI_DATA));
    saveData();
    renderCards();
    if (isGraphView) initGraph();
  }

  function generateId() {
    return 'w' + Date.now();
  }

  /* ========== Filters & Search ========== */

  function getFilteredItems() {
    return wikiItems.filter(item => {
      if (currentEra !== '전체' && item.era !== currentEra) return false;
      if (currentCategory !== '전체' && item.category !== currentCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inDesc = item.desc.toLowerCase().includes(q);
        const inTags = item.tags.some(t => t.toLowerCase().includes(q));
        if (!inTitle && !inDesc && !inTags) return false;
      }
      return true;
    });
  }

  function renderFilterTabs() {
    const eraTabs = document.getElementById('era-tabs');
    const catTabs = document.getElementById('cat-tabs');

    eraTabs.innerHTML = ERAS.map(era =>
      `<button class="tab ${era === currentEra ? 'active' : ''}" role="tab" aria-selected="${era === currentEra}" data-era="${era}">${era}</button>`
    ).join('');

    catTabs.innerHTML = CATEGORIES.map(cat =>
      `<button class="tab ${cat === currentCategory ? 'active' : ''}" role="tab" aria-selected="${cat === currentCategory}" data-cat="${cat}">${cat}</button>`
    ).join('');

    eraTabs.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-era]');
      if (!btn) return;
      currentEra = btn.dataset.era;
      renderFilterTabs();
      renderCards();
    });

    catTabs.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      currentCategory = btn.dataset.cat;
      renderFilterTabs();
      renderCards();
    });
  }

  /* ========== Card Rendering ========== */

  function renderCards() {
    const grid = document.getElementById('card-grid');
    const noResults = document.getElementById('no-results');
    const items = getFilteredItems();

    if (items.length === 0) {
      grid.innerHTML = '';
      noResults.hidden = false;
      return;
    }
    noResults.hidden = true;

    const frag = document.createDocumentFragment();
    items.forEach(item => {
      const article = document.createElement('article');
      article.className = 'card wiki-card';
      article.setAttribute('role', 'listitem');
      article.setAttribute('tabindex', '0');
      article.setAttribute('aria-label', item.title + ' — ' + item.era + ' ' + item.category);
      article.innerHTML = `
        <div class="card-header">
          ${getEraBadgeHTML(item.era)}
          ${getCategoryBadgeHTML(item.category)}
          ${renderStars(item.importance)}
        </div>
        <h3 class="card-title">${escapeHTML(item.title)}</h3>
        <p class="card-desc">${escapeHTML(item.desc)}</p>
        <div class="card-tags">${renderTagChips(item.tags)}</div>
      `;
      article.addEventListener('click', () => openDetailModal(item.id));
      article.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetailModal(item.id); }
      });
      frag.appendChild(article);
    });

    grid.innerHTML = '';
    grid.appendChild(frag);
  }

  /* ========== Detail Modal ========== */

  function openDetailModal(id) {
    const item = wikiItems.find(i => i.id === id);
    if (!item) return;

    const related = findRelated(item);

    const html = `
      <h2 class="modal-title">${escapeHTML(item.title)}</h2>
      <div class="modal-meta">
        ${getEraBadgeHTML(item.era)}
        ${getCategoryBadgeHTML(item.category)}
        ${renderStars(item.importance)}
      </div>
      <p class="modal-desc">${escapeHTML(item.desc)}</p>
      <div class="modal-tags">${renderTagChips(item.tags)}</div>
      <div class="modal-actions">
        <button class="btn btn-outline btn-sm" id="modal-edit" aria-label="수정">수정</button>
        <button class="btn btn-danger btn-sm" id="modal-delete" aria-label="삭제">삭제</button>
      </div>
      ${related.length > 0 ? `
        <div class="modal-related">
          <h4>연관 항목</h4>
          ${related.map(r => `<button class="related-item" data-id="${r.id}">${escapeHTML(r.title)}</button>`).join('')}
        </div>
      ` : ''}
    `;

    openModal(html, item.title + ' 상세 정보');

    document.getElementById('modal-edit').addEventListener('click', () => {
      closeModal();
      setTimeout(() => openFormModal(item), 100);
    });
    document.getElementById('modal-delete').addEventListener('click', () => deleteItem(item.id));

    document.querySelectorAll('.related-item').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal();
        setTimeout(() => openDetailModal(btn.dataset.id), 100);
      });
    });
  }

  function findRelated(item) {
    const tagSet = new Set(item.tags);
    const scored = wikiItems
      .filter(other => other.id !== item.id)
      .map(other => {
        const shared = other.tags.filter(t => tagSet.has(t)).length;
        return { ...other, shared };
      })
      .filter(o => o.shared > 0)
      .sort((a, b) => b.shared - a.shared);
    return scored.slice(0, 5);
  }

  function deleteItem(id) {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    wikiItems = wikiItems.filter(i => i.id !== id);
    saveData();
    closeModal();
    renderCards();
    if (isGraphView) initGraph();
  }

  /* ========== Form Modal ========== */

  function openFormModal(existing) {
    const isEdit = !!existing;
    const html = `
      <h2 class="modal-title">${isEdit ? '항목 수정' : '새 항목 추가'}</h2>
      <form id="wiki-form">
        <div class="form-group">
          <label for="f-title">제목 *</label>
          <input type="text" id="f-title" required value="${isEdit ? escapeHTML(existing.title) : ''}">
        </div>
        <div class="form-group">
          <label for="f-era">시대</label>
          <select id="f-era">
            ${ERAS.slice(1).map(e => `<option value="${e}" ${isEdit && existing.era === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="f-cat">분류</label>
          <select id="f-cat">
            ${CATEGORIES.slice(1).map(c => `<option value="${c}" ${isEdit && existing.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="f-desc">설명</label>
          <textarea id="f-desc" rows="5">${isEdit ? escapeHTML(existing.desc) : ''}</textarea>
        </div>
        <div class="form-group">
          <label for="f-tags">태그 (쉼표로 구분)</label>
          <input type="text" id="f-tags" placeholder="예: 고구려, 불교, 태학" value="${isEdit ? existing.tags.join(', ') : ''}">
        </div>
        <div class="form-group">
          <label>중요도</label>
          <div class="radio-group">
            ${[1, 2, 3].map(n => `
              <label>
                <input type="radio" name="importance" value="${n}" ${(isEdit ? existing.importance : 2) === n ? 'checked' : ''}>
                ${'★'.repeat(n)}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${isEdit ? '수정' : '추가'}</button>
          <button type="button" class="btn btn-outline" id="form-cancel">취소</button>
        </div>
      </form>
    `;

    openModal(html, isEdit ? '항목 수정' : '새 항목 추가');

    document.getElementById('form-cancel').addEventListener('click', closeModal);
    document.getElementById('wiki-form').addEventListener('submit', function (e) {
      e.preventDefault();
      handleFormSubmit(existing);
    });
  }

  function handleFormSubmit(existing) {
    const title = document.getElementById('f-title').value.trim();
    if (!title) return;

    const newItem = {
      id: existing ? existing.id : generateId(),
      title: title,
      era: document.getElementById('f-era').value,
      category: document.getElementById('f-cat').value,
      desc: document.getElementById('f-desc').value.trim(),
      tags: document.getElementById('f-tags').value
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0),
      importance: parseInt(document.querySelector('input[name="importance"]:checked').value)
    };

    if (existing) {
      const idx = wikiItems.findIndex(i => i.id === existing.id);
      if (idx !== -1) wikiItems[idx] = newItem;
    } else {
      wikiItems.push(newItem);
    }

    saveData();
    closeModal();
    renderCards();
    if (isGraphView) initGraph();
  }

  /* ========== View Toggle ========== */

  function toggleView() {
    isGraphView = !isGraphView;
    document.getElementById('list-view').hidden = isGraphView;
    document.getElementById('graph-view').hidden = !isGraphView;
    document.getElementById('view-label').textContent = isGraphView ? '카드 보기' : '관계도 보기';

    /* 전체화면 전환: navbar, main, footer 숨김 */
    document.getElementById('navbar').style.display = isGraphView ? 'none' : '';
    document.getElementById('main').style.display = isGraphView ? 'none' : '';
    document.getElementById('footer').style.display = isGraphView ? 'none' : '';

    if (isGraphView) {
      requestAnimationFrame(function () { initGraph(); });
    } else {
      stopSimulation();
    }
  }

  /* ========== Era Band Map (관계도) ========== */

  const BAND = {
    PAD: 20,          /* 좌우 여백 */
    TOP_PAD: 64,      /* 뒤로가기 버튼 아래에서 시작 */
    HEADER_H: 34,
    HEADER_GAP: 12,
    CAT_COL_W: 46,    /* 분류 라벨 열 너비 */
    CARD_H: 30,
    CARD_PAD_X: 22,
    CARD_GAP_X: 8,
    CARD_GAP_Y: 8,
    CAT_GAP_Y: 14,    /* 분류 블록 사이 */
    BAND_PAD_B: 10,
    BAND_GAP: 18,
    FONT: "'Pretendard', system-ui, sans-serif"
  };

  const ERA_ORDER = ['고조선', '삼국', '남북국', '고려', '조선', '근현대'];
  const CAT_ORDER = ['인물', '사건', '제도', '문화'];

  /* 관계선 계산에서 제외할 시대·국가명 태그.
     이 태그들은 수십 개 항목이 공유해서 포함하면 관계선이 수천 개로 폭증한다. */
  const TAG_STOPWORDS = new Set([
    '고조선', '삼국', '남북국', '고려', '조선', '근현대',
    '고구려', '백제', '신라', '통일신라', '가야', '발해'
  ]);

  let eraCollapsed = {};
  let graphCards = {};      /* id → {cx, cy, era, group} */
  let relationCache = null; /* id → Set(관련 id) */
  let _measureSvg = null;

  function measureText(str, fontSize) {
    if (!_measureSvg) {
      _measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      _measureSvg.style.cssText = 'position:absolute;top:-9999px;left:-9999px;';
      document.body.appendChild(_measureSvg);
    }
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('font-size', fontSize);
    t.setAttribute('font-family', BAND.FONT);
    t.textContent = str;
    _measureSvg.appendChild(t);
    const w = t.getComputedTextLength();
    _measureSvg.removeChild(t);
    return w;
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  /* ----- 태그 기반 관계 계산 ----- */

  function buildRelations() {
    if (relationCache) return relationCache;
    const map = {};
    wikiItems.forEach(i => { map[i.id] = new Set(); });
    /* "성종 (조선)" → "성종" 처럼 괄호를 뗀 제목으로 태그와 대조 */
    const bareTitle = i => i.title.replace(/\s*\(.*\)\s*$/, '');
    for (let a = 0; a < wikiItems.length; a++) {
      for (let b = a + 1; b < wikiItems.length; b++) {
        const A = wikiItems[a], B = wikiItems[b];
        const linked =
          A.tags.some(t => !TAG_STOPWORDS.has(t) && B.tags.includes(t)) ||
          A.tags.includes(bareTitle(B)) ||
          B.tags.includes(bareTitle(A));
        if (linked) { map[A.id].add(B.id); map[B.id].add(A.id); }
      }
    }
    relationCache = map;
    return map;
  }

  /* ----- 레이아웃: 시대 밴드 안에서 카드를 여러 행으로 감아서 채움 ----- */

  function layoutBands(width) {
    const flowX0 = BAND.PAD + BAND.CAT_COL_W;
    const flowMaxX = width - BAND.PAD;
    const bands = [];
    const cards = [];
    let y = BAND.TOP_PAD;

    ERA_ORDER.forEach(era => {
      const items = wikiItems.filter(i => i.era === era);
      if (items.length === 0) return;
      const collapsed = !!eraCollapsed[era];
      const band = { era, y0: y, count: items.length, collapsed, catLabels: [] };
      y += BAND.HEADER_H + (collapsed ? 0 : BAND.HEADER_GAP);

      if (!collapsed) {
        CAT_ORDER.forEach(cat => {
          const catItems = items.filter(i => i.category === cat);
          if (catItems.length === 0) return;
          band.catLabels.push({ label: cat, y: y + BAND.CARD_H / 2 });
          let cx = flowX0;
          let rowY = y;
          catItems.forEach(item => {
            const w = Math.max(
              measureText(item.title, item.importance === 1 ? 11 : 12) + BAND.CARD_PAD_X,
              64
            );
            if (cx + w > flowMaxX && cx > flowX0) {
              cx = flowX0;
              rowY += BAND.CARD_H + BAND.CARD_GAP_Y;
            }
            cards.push({ item, x: cx, y: rowY, w, h: BAND.CARD_H });
            cx += w + BAND.CARD_GAP_X;
          });
          y = rowY + BAND.CARD_H + BAND.CAT_GAP_Y;
        });
        y += BAND.BAND_PAD_B - BAND.CAT_GAP_Y;
      }
      band.y1 = y;
      y += BAND.BAND_GAP;
      bands.push(band);
    });

    return { bands, cards, height: y + BAND.PAD };
  }

  /* ----- 렌더링 ----- */

  function bezierEdge(x1, y1, x2, y2) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const off = Math.min(48, len * 0.18);
    return `M${x1},${y1} Q${mx - dy / len * off},${my + dx / len * off} ${x2},${y2}`;
  }

  function renderBands(svg, layout) {
    svg.innerHTML = '';
    graphCards = {};

    const styleEl = svgEl('style', {});
    styleEl.textContent = [
      '.band-card{cursor:pointer}',
      '.band-card rect{transition:stroke .15s}',
      '.band-card:hover rect{stroke:#1A1A1A;stroke-width:2}',
      '.band-header{cursor:pointer}',
      '.band-header:hover{opacity:.85}',
      '.band-card,.band-edge{transition:opacity .15s}',
      'svg.relating .band-card{opacity:.16}',
      'svg.relating .band-card.lit{opacity:1}'
    ].join('');
    svg.appendChild(styleEl);

    const bgGroup = svgEl('g', { class: 'band-bgs' });
    const edgeGroup = svgEl('g', { class: 'band-edges' });
    const nodeGroup = svgEl('g', { class: 'band-nodes' });
    svg.appendChild(bgGroup);
    svg.appendChild(edgeGroup);
    svg.appendChild(nodeGroup);

    const width = parseFloat(svg.getAttribute('viewBox').split(' ')[2]);

    layout.bands.forEach(band => {
      const color = ERA_COLORS[band.era] || '#1A1A1A';

      /* 밴드 배경 */
      bgGroup.appendChild(svgEl('rect', {
        x: BAND.PAD - 8, y: band.y0 - 6,
        width: width - (BAND.PAD - 8) * 2, height: band.y1 - band.y0 + 12,
        rx: 14, fill: color, opacity: 0.07
      }));

      /* 밴드 헤더 (클릭 → 접기/펼치기) */
      const label = (band.collapsed ? '▸ ' : '▾ ') + band.era;
      const countText = String(band.count);
      const labelW = measureText(label, 14);
      const countW = measureText(countText, 11) + 14;
      const headerW = labelW + countW + 30;
      const hg = svgEl('g', { class: 'band-header', 'data-era': band.era });
      hg.appendChild(svgEl('rect', {
        x: BAND.PAD, y: band.y0, width: headerW, height: 28, rx: 14, fill: color
      }));
      const ht = svgEl('text', {
        x: BAND.PAD + 12, y: band.y0 + 15, fill: '#fff',
        'font-size': 14, 'font-weight': 600,
        'dominant-baseline': 'central', 'font-family': BAND.FONT
      });
      ht.textContent = label;
      hg.appendChild(ht);
      hg.appendChild(svgEl('rect', {
        x: BAND.PAD + labelW + 20, y: band.y0 + 5, width: countW, height: 18,
        rx: 9, fill: 'rgba(255,255,255,0.25)'
      }));
      const hc = svgEl('text', {
        x: BAND.PAD + labelW + 20 + countW / 2, y: band.y0 + 15, fill: '#fff',
        'font-size': 11, 'font-weight': 500, 'text-anchor': 'middle',
        'dominant-baseline': 'central', 'font-family': BAND.FONT
      });
      hc.textContent = countText;
      hg.appendChild(hc);
      hg.addEventListener('click', function () { toggleEra(band.era); });
      nodeGroup.appendChild(hg);

      /* 분류 라벨 */
      band.catLabels.forEach(cl => {
        const t = svgEl('text', {
          x: BAND.PAD + 4, y: cl.y, fill: '#9B9B9B',
          'font-size': 11, 'font-weight': 500,
          'dominant-baseline': 'central', 'font-family': BAND.FONT
        });
        t.textContent = cl.label;
        nodeGroup.appendChild(t);
      });
    });

    /* 카드 */
    layout.cards.forEach(c => {
      const item = c.item;
      const color = ERA_COLORS[item.era] || '#1A1A1A';
      const imp = item.importance;
      const cg = svgEl('g', { class: 'band-card', 'data-id': item.id });
      cg.appendChild(svgEl('rect', {
        x: c.x, y: c.y, width: c.w, height: c.h, rx: c.h / 2,
        fill: '#FFFFFF',
        stroke: imp === 3 ? color : (imp === 1 ? '#E8E8E8' : '#D0D0D0'),
        'stroke-width': imp === 3 ? 2 : 1
      }));
      const t = svgEl('text', {
        x: c.x + c.w / 2, y: c.y + c.h / 2 + 1,
        fill: imp === 1 ? '#9B9B9B' : '#1A1A1A',
        'font-size': imp === 1 ? 11 : 12,
        'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': BAND.FONT
      });
      t.textContent = item.title;
      cg.appendChild(t);

      cg.addEventListener('click', function () { openDetailModal(item.id); });
      cg.addEventListener('mouseenter', function () { showRelations(svg, item.id); });
      cg.addEventListener('mouseleave', function () { clearRelations(svg); });
      nodeGroup.appendChild(cg);

      graphCards[item.id] = { cx: c.x + c.w / 2, cy: c.y + c.h / 2, era: item.era, group: cg };
    });
  }

  /* ----- 관계 하이라이트: 호버한 카드와 태그를 공유하는 카드를 선으로 연결 ----- */

  function showRelations(svg, id) {
    const rel = buildRelations()[id];
    const from = graphCards[id];
    if (!rel || rel.size === 0 || !from) return;

    const edgeGroup = svg.querySelector('.band-edges');
    svg.classList.add('relating');
    from.group.classList.add('lit');

    rel.forEach(rid => {
      const to = graphCards[rid];
      if (!to) return; /* 접힌 밴드 안의 항목 */
      to.group.classList.add('lit');
      edgeGroup.appendChild(svgEl('path', {
        class: 'band-edge',
        d: bezierEdge(from.cx, from.cy, to.cx, to.cy),
        stroke: ERA_COLORS[from.era] || '#1A1A1A',
        'stroke-width': 1.5, fill: 'none', opacity: 0.55
      }));
    });
  }

  function clearRelations(svg) {
    svg.classList.remove('relating');
    svg.querySelector('.band-edges').innerHTML = '';
    svg.querySelectorAll('.band-card.lit').forEach(el => el.classList.remove('lit'));
  }

  function toggleEra(era) {
    eraCollapsed[era] = !eraCollapsed[era];
    initGraph();
  }

  /* ----- 팬(드래그)·휠 스크롤 ----- */

  function setupPanning(svg) {
    let isPanning = false;
    let startX = 0, startY = 0;
    let vb = null;

    function parseVB() {
      return svg.getAttribute('viewBox').split(' ').map(Number);
    }

    function onStart(e) {
      if (e.target.closest('.band-card') || e.target.closest('.band-header')) return;
      isPanning = true;
      const pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX; startY = pt.clientY;
      vb = parseVB();
      svg.style.cursor = 'grabbing';
    }
    function clampY(y, v) {
      const maxY = Math.max(0, (svg._contentH || v[3]) - v[3] + 40);
      return Math.min(Math.max(y, 0), maxY);
    }
    function onMove(e) {
      if (!isPanning) return;
      e.preventDefault();
      const pt = e.touches ? e.touches[0] : e;
      const rect = svg.getBoundingClientRect();
      const sy = vb[3] / rect.height;
      const dy = (pt.clientY - startY) * sy;
      svg.setAttribute('viewBox', `0 ${clampY(vb[1] - dy, vb)} ${vb[2]} ${vb[3]}`);
    }
    function onEnd() {
      if (!isPanning) return;
      isPanning = false;
      svg.style.cursor = 'grab';
    }

    svg.addEventListener('mousedown', onStart);
    svg.addEventListener('mousemove', onMove);
    svg.addEventListener('mouseup', onEnd);
    svg.addEventListener('mouseleave', onEnd);
    svg.addEventListener('touchstart', onStart, { passive: false });
    svg.addEventListener('touchmove', onMove, { passive: false });
    svg.addEventListener('touchend', onEnd);

    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      const v = parseVB();
      const rect = svg.getBoundingClientRect();
      const scale = v[3] / rect.height;
      const maxY = Math.max(0, (svg._contentH || v[3]) - v[3] + 40);
      const y = Math.min(Math.max(v[1] + e.deltaY * scale, 0), maxY);
      svg.setAttribute('viewBox', `0 ${y} ${v[2]} ${v[3]}`);
    }, { passive: false });
  }

  function initGraph() {
    const svg = document.getElementById('graph-svg');
    const rect = svg.getBoundingClientRect();
    const cw = rect.width || window.innerWidth;
    const ch = rect.height || window.innerHeight;

    /* viewBox를 화면 크기 그대로 두고(1:1 렌더링) 팬·휠로 세로 이동 */
    const vbW = Math.max(cw, 320);
    const vbH = Math.max(ch, 320);
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');

    const layout = layoutBands(vbW);
    svg._contentH = layout.height;
    renderBands(svg, layout);

    /* 팬·휠 리스너는 최초 1회만 등록 (재렌더마다 누적 등록되던 버그 수정) */
    if (!svg._navBound) {
      setupPanning(svg);
      svg._navBound = true;
    }
  }

  function stopSimulation() {
    const svg = document.getElementById('graph-svg');
    if (svg) clearRelations(svg);
  }

  let _bandResizeTimer = null;
  window.addEventListener('resize', function () {
    if (!isGraphView) return;
    clearTimeout(_bandResizeTimer);
    _bandResizeTimer = setTimeout(function () { initGraph(); }, 200);
  });

  /* ========== Search ========== */

  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', debounce(function () {
    searchQuery = searchInput.value.trim();
    renderCards();
  }, 300));

  /* ========== Button Listeners ========== */

  document.getElementById('btn-add').addEventListener('click', () => openFormModal(null));
  document.getElementById('btn-reset').addEventListener('click', resetData);
  document.getElementById('btn-toggle-view').addEventListener('click', toggleView);
  document.getElementById('btn-graph-back').addEventListener('click', toggleView);

  /* ========== Init ========== */

  loadData();
  renderFilterTabs();
  renderCards();

})();
