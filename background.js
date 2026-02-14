/**
 * Ad Attention Score Tracker - Background Service Worker
 * Aggregates attention reports from content scripts and persists scores.
 */

const STORAGE_KEY = 'adAttentionScores';
const DEFAULT_STATE = {
  totalScore: 0,
  sessions: [],
  byUrl: {},
  lastUpdated: 0,
};

// Weights for attention score: view time (ms), hover time (ms), clicks
const VIEW_WEIGHT = 0.001;   // 1 sec view = 1 point
const HOVER_WEIGHT = 0.002;  // 1 sec hover = 2 points (more intentional)
const CLICK_WEIGHT = 10;     // 1 click = 10 points

function computeScoreFromReport({ viewMs = 0, hoverMs = 0, clicks = 0 }) {
  return (
    viewMs * VIEW_WEIGHT +
    hoverMs * HOVER_WEIGHT +
    (clicks || 0) * CLICK_WEIGHT
  );
}

function getState() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const state = result[STORAGE_KEY]
        ? { ...DEFAULT_STATE, ...result[STORAGE_KEY] }
        : { ...DEFAULT_STATE };
      resolve(state);
    });
  });
}

function setState(state) {
  state.lastUpdated = Date.now();
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: state }, resolve);
  });
}

function mergeReportIntoState(state, report) {
  const score = computeScoreFromReport(report);
  state.totalScore = (state.totalScore || 0) + score;
  state.sessions = state.sessions || [];
  state.sessions.push({
    url: report.url,
    title: report.title,
    viewMs: report.viewMs,
    hoverMs: report.hoverMs,
    clicks: report.clicks,
    score,
    ts: report.ts,
  });
  // Keep last 500 sessions to avoid unbounded growth
  if (state.sessions.length > 500) {
    state.sessions = state.sessions.slice(-500);
  }
  const host = report.url ? new URL(report.url).hostname : 'unknown';
  state.byUrl = state.byUrl || {};
  state.byUrl[host] = (state.byUrl[host] || 0) + score;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SCORE') {
    getState().then(sendResponse);
    return true;
  }

  if (message.type !== 'ATTENTION_REPORT' || !Array.isArray(message.payload)) {
    sendResponse({ ok: false });
    return false;
  }

  getState()
    .then((state) => {
      message.payload.forEach((report) => mergeReportIntoState(state, report));
      return setState(state);
    })
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));

  return true; // keep channel open for async sendResponse
});
