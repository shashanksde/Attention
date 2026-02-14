/**
 * Ad Attention Score Tracker - Content Script
 * Detects ad-like elements, tracks viewport visibility and interaction time,
 * and reports attention scores to the background script.
 */

(function () {
  'use strict';

  const AD_SELECTORS = [
    '[id*="ad-"][id*="-container"], [id*="ad_container"]',
    '[class*="ad-container"], [class*="ad_container"]',
    '[data-ad], [data-ad-unit], [data-ad-slot]',
    'iframe[src*="doubleclick"], iframe[src*="googlesyndication"], iframe[src*="ads."]',
    '[id*="google_ads"], [class*="google-ad"]',
    '[class*="sponsored"], [data-testid*="ad"], [data-testid*="sponsored"]',
    'ins.adsbygoogle',
    '[class*="Advertisement"], [id*="advertisement"]',
    'aside[class*="ad"], div[class*="sidebar-ad"]',
  ].join(', ');

  const VIEW_THRESHOLD = 0.5; // 50% visible = "in view"
  const MIN_SIZE = 50; // ignore tiny elements (px)
  const DEBOUNCE_MS = 200;
  const REPORT_INTERVAL_MS = 2000;

  const state = new Map(); // elementId -> { viewStart, totalViewMs, hoverMs, clickCount, lastReported }

  function generateId(el) {
    if (el.dataset.attentionId) return el.dataset.attentionId;
    const id = 'att_' + Math.random().toString(36).slice(2, 11);
    el.dataset.attentionId = id;
    return id;
  }

  function getRect(el) {
    try {
      return el.getBoundingClientRect();
    } catch {
      return null;
    }
  }

  function isBigEnough(rect) {
    return rect && rect.width >= MIN_SIZE && rect.height >= MIN_SIZE;
  }

  function findAdCandidates() {
    const nodes = document.querySelectorAll(AD_SELECTORS);
    const candidates = [];
    nodes.forEach((el) => {
      if (el.offsetParent === null) return; // hidden
      const rect = getRect(el);
      if (!isBigEnough(rect)) return;
      candidates.push({ el, rect, id: generateId(el) });
    });
    return candidates;
  }

  function getVisibleRatio(el) {
    const rect = getRect(el);
    if (!rect || !isBigEnough(rect)) return 0;
    const vw = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const vh = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    const area = vw * vh;
    const total = rect.width * rect.height;
    return total > 0 ? area / total : 0;
  }

  function getOrCreateState(id) {
    if (!state.has(id)) {
      state.set(id, {
        viewStart: null,
        totalViewMs: 0,
        hoverStart: null,
        hoverMs: 0,
        clickCount: 0,
        lastReported: 0,
        url: window.location.href,
        title: document.title || '',
      });
    }
    return state.get(id);
  }

  function tick(s) {
    const now = Date.now();
    for (const [id, data] of state.entries()) {
      if (data.viewStart !== null) {
        data.totalViewMs += now - data.viewStart;
        data.viewStart = now;
      }
      if (data.hoverStart !== null) {
        data.hoverMs += now - data.hoverStart;
        data.hoverStart = now;
      }
    }
  }

  function reportToBackground() {
    const payload = [];
    const now = Date.now();
    for (const [id, data] of state.entries()) {
      let totalViewMs = data.totalViewMs;
      if (data.viewStart !== null) totalViewMs += now - data.viewStart;
      const totalHover = data.hoverMs + (data.hoverStart ? now - data.hoverStart : 0);
      // Send only deltas since last report to avoid double-counting
      const deltaView = Math.round(totalViewMs - (data.reportedViewMs || 0));
      const deltaHover = Math.round(totalHover - (data.reportedHoverMs || 0));
      const deltaClicks = (data.clickCount || 0) - (data.reportedClicks || 0);
      data.reportedViewMs = totalViewMs;
      data.reportedHoverMs = totalHover;
      data.reportedClicks = data.clickCount || 0;
      data.lastReported = now;
      if (deltaView > 0 || deltaHover > 0 || deltaClicks > 0) {
        payload.push({
          id,
          url: data.url,
          title: data.title,
          viewMs: deltaView,
          hoverMs: deltaHover,
          clicks: deltaClicks,
          ts: now,
        });
      }
    }
    if (payload.length) {
      chrome.runtime.sendMessage({ type: 'ATTENTION_REPORT', payload }).catch(() => {});
    }
  }

  function startViewTracking(id) {
    const data = getOrCreateState(id);
    if (data.viewStart === null) data.viewStart = Date.now();
  }

  function stopViewTracking(id) {
    const data = state.get(id);
    if (!data) return;
    const now = Date.now();
    if (data.viewStart !== null) {
      data.totalViewMs += now - data.viewStart;
      data.viewStart = null;
    }
    if (data.hoverStart !== null) {
      data.hoverMs += now - data.hoverStart;
      data.hoverStart = null;
    }
  }

  function addHover(id) {
    const data = getOrCreateState(id);
    if (data.hoverStart === null) data.hoverStart = Date.now();
  }

  function removeHover(id) {
    const data = state.get(id);
    if (!data) return;
    const now = Date.now();
    if (data.hoverStart !== null) {
      data.hoverMs += now - data.hoverStart;
      data.hoverStart = null;
    }
  }

  function addClick(id) {
    const data = getOrCreateState(id);
    data.clickCount = (data.clickCount || 0) + 1;
  }

  function observeVisibility() {
    const candidates = findAdCandidates();
    const now = Date.now();
    const visibleIds = new Set();

    candidates.forEach(({ el, id }) => {
      const ratio = getVisibleRatio(el);
      if (ratio >= VIEW_THRESHOLD) {
        visibleIds.add(id);
        startViewTracking(id);
      } else {
        stopViewTracking(id);
      }
    });

    // stop tracking for elements no longer in candidate list or not visible
    state.forEach((_, id) => {
      if (!visibleIds.has(id)) stopViewTracking(id);
    });
  }

  function attachInteractionListeners() {
    document.querySelectorAll(AD_SELECTORS).forEach((el) => {
      if (el.dataset.attentionListeners) return;
      el.dataset.attentionListeners = '1';
      const id = generateId(el);

      el.addEventListener('mouseenter', () => addHover(id), { passive: true });
      el.addEventListener('mouseleave', () => removeHover(id), { passive: true });
      el.addEventListener('click', () => addClick(id), { passive: true });
    });
  }

  let visibilityInterval;
  let reportInterval;
  let mutationObserver;

  function startTracking() {
    observeVisibility();
    attachInteractionListeners();
    if (!visibilityInterval) {
      visibilityInterval = setInterval(observeVisibility, DEBOUNCE_MS);
    }
    if (!reportInterval) {
      reportInterval = setInterval(reportToBackground, REPORT_INTERVAL_MS);
    }
  }

  function cleanup() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (visibilityInterval) {
      clearInterval(visibilityInterval);
      visibilityInterval = null;
    }
    if (reportInterval) {
      clearInterval(reportInterval);
      reportInterval = null;
    }
  }

  function init() {
    startTracking();
    // Re-scan for new ads (e.g. dynamic content)
    mutationObserver = new MutationObserver(() => {
      attachInteractionListeners();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('beforeunload', () => {
    tick();
    reportToBackground();
    cleanup();
  });
})();
