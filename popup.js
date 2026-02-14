(function () {
  'use strict';

  const totalScoreEl = document.getElementById('totalScore');
  const activityListEl = document.getElementById('activityList');
  const emptyStateEl = document.getElementById('emptyState');
  const resetBtn = document.getElementById('resetBtn');

  function formatScore(n) {
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  }

  function render(state) {
    const score = state?.totalScore ?? 0;
    const sessions = state?.sessions ?? [];
    const recent = sessions.slice(-15).reverse();

    totalScoreEl.textContent = formatScore(score);

    if (recent.length === 0) {
      emptyStateEl.classList.remove('hidden');
      activityListEl.innerHTML = '';
    } else {
      emptyStateEl.classList.add('hidden');
      activityListEl.textContent = '';
      recent.forEach((s) => {
        const host = s.url ? new URL(s.url).hostname : '—';
        const title = (s.title || host).slice(0, 40);
        const li = document.createElement('li');
        const siteSpan = document.createElement('span');
        siteSpan.className = 'site';
        siteSpan.title = title;
        siteSpan.textContent = host;
        const pointsSpan = document.createElement('span');
        pointsSpan.className = 'points';
        pointsSpan.textContent = '+' + formatScore(s.score);
        li.appendChild(siteSpan);
        li.appendChild(pointsSpan);
        activityListEl.appendChild(li);
      });
    }
  }

  function load() {
    chrome.runtime.sendMessage({ type: 'GET_SCORE' }, (state) => {
      if (chrome.runtime.lastError) return;
      render(state);
    });
  }

  resetBtn.addEventListener('click', () => {
    chrome.storage.local.set({ adAttentionScores: { totalScore: 0, sessions: [], byUrl: {}, lastUpdated: Date.now() } }, () => {
      load();
    });
  });

  load();
})();
