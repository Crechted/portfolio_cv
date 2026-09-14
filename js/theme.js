(function () {
  const STORAGE_KEY = 'portfolio-theme';

  const SUN_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  const MOON_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      const next = theme === 'dark' ? 'light' : 'dark';
      btn.innerHTML = next === 'dark' ? MOON_ICON : SUN_ICON;
      btn.setAttribute('aria-label', next === 'dark' ? 'Switch to dark theme' : 'Switch to light theme');
      btn.setAttribute('title', next === 'dark' ? 'Switch to dark theme' : 'Switch to light theme');
    });
  }

  function init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const theme =
      saved === 'dark' || saved === 'light'
        ? saved
        : window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';

    applyTheme(theme);

    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        localStorage.setItem(STORAGE_KEY, next);
        applyTheme(next);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();

  window.theme = { current: currentTheme, apply: applyTheme };
})();