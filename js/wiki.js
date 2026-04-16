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

  /* ========== Mind Map ========== */

  const MM = {
    LEVEL_GAP: 200,
    ERA_GAP: 24,
    CARD_GAP_Y: 6,
    CAT_LABEL_GAP: 14,
    ROOT_PAD: 60,
    NODE_H_ERA: 36,
    NODE_W_ERA: 100,
    NODE_H_CARD: 28,
    CARD_PAD_X: 24,
    FONT: "'Pretendard', system-ui, sans-serif"
  };

  let eraCollapsed = {};
  let mmInitialized = false;
  let _measureSvg = null;

  function measureText(str, fontSize) {
    if (!_measureSvg) {
      _measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      _measureSvg.style.cssText = 'position:absolute;top:-9999px;left:-9999px;';
      document.body.appendChild(_measureSvg);
    }
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('font-size', fontSize);
    t.setAttribute('font-family', MM.FONT);
    t.textContent = str;
    _measureSvg.appendChild(t);
    const w = t.getComputedTextLength();
    _measureSvg.removeChild(t);
    return w;
  }

  function buildMindmapData() {
    const eras = ['고조선', '삼국', '남북국', '고려', '조선', '근현대'];
    const cats = ['인물', '사건', '제도', '문화'];
    const tree = { label: '한국사', children: [] };

    eras.forEach(era => {
      const items = wikiItems.filter(i => i.era === era);
      if (items.length === 0) return;
      const eraNode = { label: era, era: era, totalCount: items.length, children: [] };
      cats.forEach(cat => {
        const catItems = items.filter(i => i.category === cat);
        if (catItems.length === 0) return;
        eraNode.children.push({
          label: cat,
          cards: catItems.map(item => ({
            id: item.id, label: item.title, importance: item.importance, era: item.era
          }))
        });
      });
      tree.children.push(eraNode);
    });
    return tree;
  }

  function cardHeight(imp) { return MM.NODE_H_CARD + (imp === 3 ? 4 : imp === 1 ? -4 : 0); }

  function measureEraSubtree(eraNode) {
    let h = 0;
    eraNode.children.forEach((catGroup, ci) => {
      if (ci > 0) h += MM.CAT_LABEL_GAP;
      h += 16 + MM.CAT_LABEL_GAP;
      catGroup.cards.forEach((card, i) => {
        if (i > 0) h += MM.CARD_GAP_Y;
        h += cardHeight(card.importance);
      });
    });
    return Math.max(h, MM.NODE_H_ERA);
  }

  function layoutMindmap(tree, isVertical) {
    const pad = MM.ROOT_PAD;
    const gap = MM.LEVEL_GAP;
    const eraGap = MM.ERA_GAP;

    const rootW = measureText('한국사', 16) + 40;
    const rootH = 44;
    tree._w = rootW; tree._h = rootH;

    tree.children.forEach(era => {
      era._collapsed = !!eraCollapsed[era.era];
      era._w = MM.NODE_W_ERA;
      era._h = MM.NODE_H_ERA;
      era._subtreeH = era._collapsed ? MM.NODE_H_ERA : measureEraSubtree(era);
    });

    const totalEraH = tree.children.reduce((s, e) => s + e._subtreeH, 0) + eraGap * (tree.children.length - 1);

    if (isVertical) {
      const rootX = pad + 20;
      const rootY = pad;
      tree._x = rootX; tree._y = rootY;

      let maxW = rootW;
      const eraStartY = rootY + rootH + gap * 0.5;
      let curY = eraStartY;

      tree.children.forEach(era => {
        era._x = rootX;
        era._y = curY;

        if (!era._collapsed) {
          let cardX = era._x + era._w + gap * 0.6;
          let cardY = era._y;
          era.children.forEach((catGroup, ci) => {
            if (ci > 0) cardY += MM.CAT_LABEL_GAP;
            catGroup._x = cardX;
            catGroup._y = cardY;
            cardY += 16 + MM.CAT_LABEL_GAP;
            catGroup.cards.forEach((card, i) => {
              if (i > 0) cardY += MM.CARD_GAP_Y;
              const cw = measureText(card.label, card.importance === 1 ? 11 : 12) + MM.CARD_PAD_X;
              const ch = cardHeight(card.importance);
              card._x = cardX;
              card._y = cardY;
              card._w = Math.max(cw, 80);
              card._h = ch;
              cardY += ch;
              if (card._x + card._w + pad > maxW) maxW = card._x + card._w + pad;
            });
          });
        }
        curY += era._subtreeH + eraGap;
      });

      const totalW = Math.max(maxW + pad, rootW + pad * 2);
      const totalH = curY + pad;
      return { width: totalW, height: totalH };
    }

    /* Horizontal layout */
    const rootX = pad;
    const rootY = pad + totalEraH / 2;
    tree._x = rootX; tree._y = rootY;

    let curY = pad;
    let maxX = rootX + rootW;

    tree.children.forEach(era => {
      const eraX = rootX + rootW + gap;
      const eraCenterY = curY + era._subtreeH / 2;
      era._x = eraX;
      era._y = eraCenterY;

      if (!era._collapsed) {
        let cardX = eraX + era._w + gap * 0.7;
        let cardY = curY;
        era.children.forEach((catGroup, ci) => {
          if (ci > 0) cardY += MM.CAT_LABEL_GAP;
          catGroup._x = cardX;
          catGroup._y = cardY;
          cardY += 16 + MM.CAT_LABEL_GAP;
          catGroup.cards.forEach((card, i) => {
            if (i > 0) cardY += MM.CARD_GAP_Y;
            const cw = measureText(card.label, card.importance === 1 ? 11 : 12) + MM.CARD_PAD_X;
            const ch = cardHeight(card.importance);
            card._x = cardX;
            card._y = cardY;
            card._w = Math.max(cw, 80);
            card._h = ch;
            cardY += ch;
            if (cardX + card._w > maxX) maxX = cardX + card._w;
          });
        });
      }
      curY += era._subtreeH + eraGap;
    });

    const totalW = maxX + pad;
    const totalH = curY + pad;

    tree._y = pad + totalEraH / 2;
    return { width: totalW, height: totalH };
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function bezierH(x1, y1, x2, y2) {
    const mx = x1 + (x2 - x1) * 0.5;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }

  function bezierV(x1, y1, x2, y2) {
    const my = y1 + (y2 - y1) * 0.5;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  }

  function renderMindmap(svg, tree, isVertical) {
    svg.innerHTML = '';

    const styleEl = svgEl('style', {});
    styleEl.textContent = `.mm-card{cursor:pointer}.mm-card rect{transition:stroke .15s,stroke-width .15s}.mm-card:hover rect{stroke:#1A1A1A;stroke-width:2}.mm-era{cursor:pointer}.mm-era:hover{opacity:0.85}`;
    svg.appendChild(styleEl);

    const connGroup = svgEl('g', { class: 'mm-connections' });
    const nodeGroup = svgEl('g', { class: 'mm-nodes' });
    svg.appendChild(connGroup);
    svg.appendChild(nodeGroup);

    const bezier = isVertical ? bezierV : bezierH;

    /* Root node */
    const rg = svgEl('g', { class: 'mm-root' });
    const rw = tree._w, rh = tree._h;
    const rx = tree._x, ry = tree._y;
    rg.appendChild(svgEl('rect', { x: rx, y: ry - rh / 2, width: rw, height: rh, rx: 12, fill: '#1A1A1A' }));
    const rt = svgEl('text', { x: rx + rw / 2, y: ry + 1, fill: '#fff', 'font-size': 16, 'font-weight': 700, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': MM.FONT });
    rt.textContent = '한국사';
    rg.appendChild(rt);
    nodeGroup.appendChild(rg);

    /* Era nodes */
    tree.children.forEach(era => {
      const color = ERA_COLORS[era.era] || '#1A1A1A';
      const ex = era._x, ey = era._y;
      const ew = era._w, eh = era._h;

      /* Root → Era connection */
      let fromX, fromY, toX, toY;
      if (isVertical) {
        fromX = rx + rw / 2; fromY = ry + rh / 2;
        toX = ex + ew / 2; toY = ey - eh / 2;
      } else {
        fromX = rx + rw; fromY = ry;
        toX = ex; toY = ey;
      }
      connGroup.appendChild(svgEl('path', { d: bezier(fromX, fromY, toX, toY), stroke: color, 'stroke-width': 2, fill: 'none' }));

      /* Era group */
      const eg = svgEl('g', { class: 'mm-era', 'data-era': era.era });
      eg.appendChild(svgEl('rect', { x: ex, y: ey - eh / 2, width: ew, height: eh, rx: 8, fill: color }));
      const et = svgEl('text', { x: ex + ew / 2, y: ey + 1, fill: '#fff', 'font-size': 14, 'font-weight': 600, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': MM.FONT });
      et.textContent = era.label;
      eg.appendChild(et);

      /* Collapsed badge */
      if (era._collapsed) {
        const badgeText = String(era.totalCount);
        const bw = measureText(badgeText, 11) + 14;
        const bx = ex + ew + 6;
        const by = ey;
        eg.appendChild(svgEl('rect', { x: bx, y: by - 10, width: bw, height: 20, rx: 10, fill: 'rgba(0,0,0,0.12)' }));
        const bt = svgEl('text', { x: bx + bw / 2, y: by + 1, fill: '#6B6B6B', 'font-size': 11, 'font-weight': 500, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': MM.FONT });
        bt.textContent = badgeText;
        eg.appendChild(bt);
      }

      eg.addEventListener('click', function () { toggleEra(era.era); });
      nodeGroup.appendChild(eg);

      /* Expanded children */
      if (!era._collapsed) {
        era.children.forEach(catGroup => {
          /* Category label */
          const cl = svgEl('text', { x: catGroup._x, y: catGroup._y + 11, fill: '#9B9B9B', 'font-size': 11, 'font-weight': 500, 'font-family': MM.FONT });
          cl.textContent = catGroup.label;
          nodeGroup.appendChild(cl);

          catGroup.cards.forEach(card => {
            const cw = card._w, ch = card._h;
            const cx = card._x, cy = card._y;
            const imp = card.importance;

            /* Era → Card connection */
            let cfx, cfy, ctx, cty;
            if (isVertical) {
              cfx = ex + ew / 2; cfy = ey + eh / 2;
              ctx = cx + cw / 2; cty = cy;
            } else {
              cfx = ex + ew; cfy = ey;
              ctx = cx; cty = cy + ch / 2;
            }
            connGroup.appendChild(svgEl('path', { d: bezier(cfx, cfy, ctx, cty), stroke: '#D0D0D0', 'stroke-width': 1, fill: 'none' }));

            /* Card node */
            const cg = svgEl('g', { class: 'mm-card', 'data-id': card.id });
            const strokeW = imp === 3 ? 2 : 1;
            const strokeC = imp === 3 ? color : (imp === 1 ? '#E8E8E8' : '#D0D0D0');
            cg.appendChild(svgEl('rect', { x: cx, y: cy, width: cw, height: ch, rx: ch / 2, fill: '#FFFFFF', stroke: strokeC, 'stroke-width': strokeW }));
            const fontSize = imp === 1 ? 11 : 12;
            const textColor = imp === 1 ? '#9B9B9B' : '#1A1A1A';
            const ctxt = svgEl('text', { x: cx + cw / 2, y: cy + ch / 2 + 1, fill: textColor, 'font-size': fontSize, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': MM.FONT });
            ctxt.textContent = card.label;
            cg.appendChild(ctxt);

            cg.addEventListener('click', function () { openDetailModal(card.id); });
            nodeGroup.appendChild(cg);
          });
        });
      }
    });
  }

  function toggleEra(era) {
    eraCollapsed[era] = !eraCollapsed[era];
    initGraph();
  }

  function setupPanning(svg) {
    let isPanning = false;
    let startX = 0, startY = 0;
    let vb = null;

    function parseVB() {
      return svg.getAttribute('viewBox').split(' ').map(Number);
    }

    function onStart(e) {
      if (e.target.closest('.mm-card') || e.target.closest('.mm-era') || e.target.closest('.mm-root')) return;
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
      const dx = (pt.clientX - startX) * sx;
      const dy = (pt.clientY - startY) * sy;
      svg.setAttribute('viewBox', `${vb[0] - dx} ${vb[1] - dy} ${vb[2]} ${vb[3]}`);
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
  }

  function initGraph() {
    const svg = document.getElementById('graph-svg');
    const isVertical = window.innerWidth < 768;

    if (!mmInitialized) {
      ERAS.slice(1).forEach(e => { eraCollapsed[e] = true; });
      mmInitialized = true;
    }

    const tree = buildMindmapData();
    const { width: treeW, height: treeH } = layoutMindmap(tree, isVertical);

    /* 컨테이너 실제 크기 가져오기 */
    const rect = svg.getBoundingClientRect();
    const cw = rect.width || window.innerWidth;
    const ch = rect.height || (window.innerHeight - 140);

    /* 트리가 컨테이너보다 작으면 컨테이너 크기 사용, 크면 트리 크기 사용 */
    const vbW = Math.max(treeW, cw);
    const vbH = Math.max(treeH, ch);
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    renderMindmap(svg, tree, isVertical);
    setupPanning(svg);
  }

  function stopSimulation() {}

  let _mmResizeTimer = null;
  window.addEventListener('resize', function () {
    if (!isGraphView) return;
    clearTimeout(_mmResizeTimer);
    _mmResizeTimer = setTimeout(function () { initGraph(); }, 200);
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
