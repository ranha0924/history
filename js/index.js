/* ===== Index Page ===== */
(function () {
  initPage('index');

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const todayEvents = NEWS_DATA.filter(e => e.month === month && e.day === day);
  const preview = document.getElementById('today-preview');

  let html = `<h3 class="today-preview-title">오늘의 역사 — ${month}월 ${day}일</h3>`;

  if (todayEvents.length > 0) {
    html += todayEvents.map(e => `
      <div class="news-card">
        <div class="news-meta">
          <span class="news-year">${e.year > 0 ? e.year + '년' : '기원전 ' + Math.abs(e.year) + '년'}</span>
          ${getEraBadgeHTML(e.era)}
        </div>
        <h4 class="news-title">${escapeHTML(e.title)}</h4>
        <p class="news-body">${escapeHTML(e.desc)}</p>
      </div>
    `).join('');
    html += `<div style="text-align:center; margin-top:12px;">
      <a href="news.html" class="btn btn-outline btn-sm">더 많은 역사 보기 &rarr;</a>
    </div>`;
  } else {
    html += `
      <div class="today-quiet">
        <p>오늘은 조용한 날이었습니다.</p>
        <a href="news.html" class="btn btn-outline btn-sm" style="margin-top:12px;">다른 날짜 탐색하기 &rarr;</a>
      </div>
    `;
  }

  preview.innerHTML = html;
})();
