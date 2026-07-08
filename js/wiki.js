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

  /* ========== Radial Map (관계도: 부채꼴) ========== */

  const RAD = {
    ROOT_R: 44,                       /* 루트 원 반지름 */
    ERA_R: 140,                       /* 시대 노드가 놓이는 반지름 */
    CARD_R0: 230,                     /* 첫 카드 링 반지름 */
    RING_GAP: 44,                     /* 링 사이 간격 */
    SECTOR_PAD: 0.045,                /* 부채꼴 양끝 여백 (rad) */
    MIN_ANGLE: 32 * Math.PI / 180,    /* 항목이 적은 시대의 최소 각도 */
    CARD_H: 28,
    CARD_PAD_X: 22,
    GAP: 10,                          /* 같은 링의 카드 사이 여백(px) */
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
    t.setAttribute('font-family', RAD.FONT);
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

  /* ----- 부채꼴 레이아웃 -----
     루트를 중심에 두고 시대를 항목 수에 비례한 각도의 부채꼴로 배치.
     각 부채꼴 안에서 카드는 반지름을 늘려가며 여러 겹의 호(링)로 감는다. */

  function sectorAngles(eras) {
    const TWO_PI = Math.PI * 2;
    const weights = eras.map(e => e.collapsed ? 2 : Math.max(e.items.length, 2));
    const sumW = weights.reduce((s, w) => s + w, 0);
    let spans = weights.map(w => (w / sumW) * TWO_PI);
    /* 최소 각도 보장: 작은 부채꼴을 올려주고 큰 부채꼴에서 회수 */
    const deficit = spans.reduce((s, sp) => s + Math.max(0, RAD.MIN_ANGLE - sp), 0);
    const surplus = spans.reduce((s, sp) => s + Math.max(0, sp - RAD.MIN_ANGLE), 0);
    spans = spans.map(sp => sp < RAD.MIN_ANGLE
      ? RAD.MIN_ANGLE
      : sp - (sp - RAD.MIN_ANGLE) / surplus * deficit);
    return spans;
  }

  /* 여백(GAP)을 포함해 이미 놓인 알약들과 겹치는지 검사 */
  function collides(rects, cx, cy, w, h) {
    const m = RAD.GAP / 2;
    const x = cx - w / 2, y = cy - h / 2;
    for (let i = 0; i < rects.length; i++) {
      const p = rects[i];
      if (x - m < p.x + p.w && p.x - m < x + w && y - m < p.y + p.h && p.y - m < y + h) return true;
    }
    return false;
  }

  function layoutRadial() {
    const placedRects = [];
    const eras = ERA_ORDER
      .map(era => ({
        era,
        items: wikiItems.filter(i => i.era === era)
          .sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category)),
        collapsed: !!eraCollapsed[era]
      }))
      .filter(e => e.items.length > 0);

    const spans = sectorAngles(eras);
    const nodes = [];
    let angle = -Math.PI / 2; /* 12시 방향부터 시계 방향 */
    let minX = -RAD.ROOT_R, maxX = RAD.ROOT_R, minY = -RAD.ROOT_R, maxY = RAD.ROOT_R;

    eras.forEach((e, ei) => {
      const a0 = angle + RAD.SECTOR_PAD;
      const a1 = angle + spans[ei] - RAD.SECTOR_PAD;
      const mid = (a0 + a1) / 2;
      const eraNode = {
        era: e.era, collapsed: e.collapsed, count: e.items.length,
        cx: Math.cos(mid) * RAD.ERA_R, cy: Math.sin(mid) * RAD.ERA_R,
        cards: []
      };

      if (!e.collapsed) {
        /* 링을 따라 각도를 조금씩 전진시키며, 이미 놓인 카드와의 실제 사각형 충돌이
           없는 첫 위치에 배치. 링이 꽉 차면 반지름을 키워 다음 링으로 넘어간다. */
        let r = RAD.CARD_R0;
        let cursor = a0;
        e.items.forEach(item => {
          const w = Math.max(
            measureText(item.title, item.importance === 1 ? 11 : 12) + RAD.CARD_PAD_X, 64);
          const half = () => (w / 2 + 4) / r; /* 알약의 대략적 각도 반폭 */
          let a = Math.max(cursor, a0 + half());
          for (;;) {
            if (a + half() > a1) {
              r += RAD.RING_GAP; cursor = a0;
              a = a0 + half();
              if (r > 2200) break; /* 안전장치: 그냥 현재 위치에 배치 */
              continue;
            }
            const cx = Math.cos(a) * r;
            const cy = Math.sin(a) * r;
            if (!collides(placedRects, cx, cy, w, RAD.CARD_H)) break;
            a += 10 / r; /* 10px 단위로 전진하며 빈자리 탐색 */
          }
          const cx = Math.cos(a) * r;
          const cy = Math.sin(a) * r;
          eraNode.cards.push({ item, cx, cy, w, h: RAD.CARD_H });
          placedRects.push({ x: cx - w / 2, y: cy - RAD.CARD_H / 2, w, h: RAD.CARD_H });
          cursor = a;
          minX = Math.min(minX, cx - w / 2); maxX = Math.max(maxX, cx + w / 2);
          minY = Math.min(minY, cy - RAD.CARD_H / 2); maxY = Math.max(maxY, cy + RAD.CARD_H / 2);
        });
      }
      minX = Math.min(minX, eraNode.cx - 60); maxX = Math.max(maxX, eraNode.cx + 60);
      minY = Math.min(minY, eraNode.cy - 30); maxY = Math.max(maxY, eraNode.cy + 30);
      nodes.push(eraNode);
      angle += spans[ei];
    });

    const PAD = 60;
    return { nodes, bounds: { minX: minX - PAD, maxX: maxX + PAD, minY: minY - PAD, maxY: maxY + PAD } };
  }

  /* ----- 렌더링 ----- */

  function bezierEdge(x1, y1, x2, y2) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const off = Math.min(48, len * 0.18);
    return `M${x1},${y1} Q${mx - dy / len * off},${my + dx / len * off} ${x2},${y2}`;
  }

  function renderRadial(svg, layout) {
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

    const linkGroup = svgEl('g', { class: 'band-links' });   /* 시대→카드 연결선 */
    const edgeGroup = svgEl('g', { class: 'band-edges' });   /* 관계 하이라이트 선 */
    const nodeGroup = svgEl('g', { class: 'band-nodes' });
    svg.appendChild(linkGroup);
    svg.appendChild(edgeGroup);
    svg.appendChild(nodeGroup);

    layout.nodes.forEach(en => {
      const color = ERA_COLORS[en.era] || '#1A1A1A';

      /* 루트 → 시대 연결선 */
      linkGroup.appendChild(svgEl('path', {
        d: bezierEdge(0, 0, en.cx, en.cy),
        stroke: color, 'stroke-width': 2, fill: 'none', opacity: 0.7
      }));

      /* 시대 → 카드 연결선 (부챗살) */
      en.cards.forEach(c => {
        linkGroup.appendChild(svgEl('line', {
          x1: en.cx, y1: en.cy, x2: c.cx, y2: c.cy,
          stroke: color, 'stroke-width': 1, opacity: 0.18
        }));
      });

      /* 시대 노드 */
      const label = en.era;
      const labelW = measureText(label, 14);
      const countText = String(en.count);
      const countW = measureText(countText, 11) + 14;
      const ew = labelW + countW + 30;
      const eg = svgEl('g', { class: 'band-header', 'data-era': en.era });
      eg.appendChild(svgEl('rect', {
        x: en.cx - ew / 2, y: en.cy - 14, width: ew, height: 28, rx: 14,
        fill: color, opacity: en.collapsed ? 0.55 : 1
      }));
      const et = svgEl('text', {
        x: en.cx - ew / 2 + 12, y: en.cy + 1, fill: '#fff',
        'font-size': 14, 'font-weight': 600,
        'dominant-baseline': 'central', 'font-family': RAD.FONT
      });
      et.textContent = label;
      eg.appendChild(et);
      eg.appendChild(svgEl('rect', {
        x: en.cx - ew / 2 + labelW + 20, y: en.cy - 9, width: countW, height: 18,
        rx: 9, fill: 'rgba(255,255,255,0.25)'
      }));
      const ec = svgEl('text', {
        x: en.cx - ew / 2 + labelW + 20 + countW / 2, y: en.cy + 1, fill: '#fff',
        'font-size': 11, 'font-weight': 500, 'text-anchor': 'middle',
        'dominant-baseline': 'central', 'font-family': RAD.FONT
      });
      ec.textContent = countText;
      eg.appendChild(ec);
      eg.addEventListener('click', function () { toggleEra(en.era); });
      nodeGroup.appendChild(eg);

      /* 카드 */
      en.cards.forEach(c => {
        const item = c.item;
        const imp = item.importance;
        const cg = svgEl('g', { class: 'band-card', 'data-id': item.id });
        cg.appendChild(svgEl('rect', {
          x: c.cx - c.w / 2, y: c.cy - c.h / 2, width: c.w, height: c.h, rx: c.h / 2,
          fill: '#FFFFFF',
          stroke: imp === 3 ? color : (imp === 1 ? '#E8E8E8' : '#D0D0D0'),
          'stroke-width': imp === 3 ? 2 : 1
        }));
        const t = svgEl('text', {
          x: c.cx, y: c.cy + 1,
          fill: imp === 1 ? '#9B9B9B' : '#1A1A1A',
          'font-size': imp === 1 ? 11 : 12,
          'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': RAD.FONT
        });
        t.textContent = item.title;
        cg.appendChild(t);

        cg.addEventListener('click', function () { openDetailModal(item.id); });
        cg.addEventListener('mouseenter', function () { showRelations(svg, item.id); });
        cg.addEventListener('mouseleave', function () { clearRelations(svg); });
        nodeGroup.appendChild(cg);

        graphCards[item.id] = { cx: c.cx, cy: c.cy, era: item.era, group: cg };
      });
    });

    /* 루트 노드 */
    const rg = svgEl('g', { class: 'band-header' });
    rg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: RAD.ROOT_R, fill: '#1A1A1A' }));
    const rt = svgEl('text', {
      x: 0, y: 1, fill: '#fff', 'font-size': 16, 'font-weight': 700,
      'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': RAD.FONT
    });
    rt.textContent = '한국사';
    rg.appendChild(rt);
    nodeGroup.appendChild(rg);
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
      if (!to) return; /* 접힌 부채꼴 안의 항목 */
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

  function clampVB(x, y, vb, svg) {
    const b = svg._bounds;
    if (!b) return [x, y];
    return [
      Math.min(Math.max(x, b.minX), Math.max(b.minX, b.maxX - vb[2])),
      Math.min(Math.max(y, b.minY), Math.max(b.minY, b.maxY - vb[3]))
    ];
  }

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
    function onMove(e) {
      if (!isPanning) return;
      e.preventDefault();
      const pt = e.touches ? e.touches[0] : e;
      const rect = svg.getBoundingClientRect();
      const sx = vb[2] / rect.width;
      const sy = vb[3] / rect.height;
      const [x, y] = clampVB(vb[0] - (pt.clientX - startX) * sx, vb[1] - (pt.clientY - startY) * sy, vb, svg);
      svg.setAttribute('viewBox', `${x} ${y} ${vb[2]} ${vb[3]}`);
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
      const [x, y] = clampVB(v[0] + e.deltaX * scale, v[1] + e.deltaY * scale, v, svg);
      svg.setAttribute('viewBox', `${x} ${y} ${v[2]} ${v[3]}`);
    }, { passive: false });
  }

  function initGraph() {
    const svg = document.getElementById('graph-svg');
    const rect = svg.getBoundingClientRect();
    const cw = Math.max(rect.width || window.innerWidth, 320);
    const ch = Math.max(rect.height || window.innerHeight, 320);

    /* 화면 크기 1:1 뷰박스, 초기 위치는 루트(원점)가 화면 중앙에 오도록 */
    svg.setAttribute('viewBox', `${-cw / 2} ${-ch / 2} ${cw} ${ch}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const layout = layoutRadial();
    svg._bounds = layout.bounds;
    renderRadial(svg, layout);

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

  let _radResizeTimer = null;
  window.addEventListener('resize', function () {
    if (!isGraphView) return;
    clearTimeout(_radResizeTimer);
    _radResizeTimer = setTimeout(function () { initGraph(); }, 200);
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
