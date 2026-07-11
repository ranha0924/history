/* ===== Common Utilities ===== */

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* ===== Navbar ===== */
function renderNavbar(activePage) {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  nav.className = 'navbar';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', '메인 네비게이션');

  const pages = [
    { id: 'index', label: '홈', href: 'index.html' },
    { id: 'wiki', label: '위키', href: 'wiki.html' },
    { id: 'news', label: '오늘의 역사', href: 'news.html' }
  ];

  nav.innerHTML = `
    <a href="index.html" class="navbar-logo" aria-label="한국사 탐험 홈">한국사 탐험</a>
    <div class="navbar-links">
      ${pages.map(p => `
        <a href="${p.href}" ${p.id === activePage ? 'class="active" aria-current="page"' : ''}>${p.label}</a>
      `).join('')}
    </div>
  `;
}

/* ===== Footer ===== */
function renderFooter() {
  const footer = document.getElementById('footer');
  if (!footer) return;
  footer.className = 'footer';
  footer.innerHTML = `
    <p class="footer-sources">참고 자료 &middot; 국사편찬위원회 우리역사넷, 한국학중앙연구원 「한국민족문화대백과사전」, 고등학교 「한국사」 교과서, 그리고 「삼국사기」·「삼국유사」·「고려사」·「조선왕조실록」 등 원 사료를 참고했습니다.</p>
    <p>한국사 탐험 &copy; 2026 &mdash; 역사를 통해 미래를 배우다</p>
  `;
}

/* ===== Badges ===== */
function getEraBadgeHTML(era) {
  return `<span class="badge badge-era badge-${escapeHTML(era)}">${escapeHTML(era)}</span>`;
}

function getCategoryBadgeHTML(cat) {
  return `<span class="badge badge-category badge-cat-${escapeHTML(cat)}">${escapeHTML(cat)}</span>`;
}

/* ===== Stars ===== */
function renderStars(importance) {
  const filled = '★'.repeat(importance);
  const empty = '☆'.repeat(3 - importance);
  return `<span class="stars" aria-label="중요도 ${importance}">${filled}${empty}</span>`;
}

/* ===== Tag Chips ===== */
function renderTagChips(tags) {
  return tags.map(t => `<span class="tag-chip">${escapeHTML(t)}</span>`).join('');
}

/* ===== Modal ===== */
let _previousFocus = null;

function openModal(contentHTML, ariaLabel) {
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    document.body.appendChild(overlay);
  }

  _previousFocus = document.activeElement;
  overlay.setAttribute('aria-label', ariaLabel || '상세 정보');

  overlay.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" aria-label="닫기">&times;</button>
      ${contentHTML}
    </div>
  `;

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  const closeBtn = overlay.querySelector('.modal-close');
  closeBtn.focus();

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });

  overlay.addEventListener('keydown', trapFocus);
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.removeEventListener('keydown', trapFocus);
    document.body.style.overflow = '';
  }
  if (_previousFocus) {
    _previousFocus.focus();
    _previousFocus = null;
  }
}

function trapFocus(e) {
  if (e.key === 'Escape') {
    closeModal();
    return;
  }
  if (e.key !== 'Tab') return;

  const modal = document.querySelector('.modal-content');
  if (!modal) return;

  const focusable = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

/* ===== Init ===== */
function initPage(activePage) {
  renderNavbar(activePage);
  renderFooter();
}
