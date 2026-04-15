/**
 * i18n.js — Lightweight Internationalization for UE Guild Dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
  window.i18n = {
    languages: ['en', 'es', 'fr', 'pt', 'ja', 'vi', 'zh'],
    currentLang: localStorage.getItem('ue_guild_lang') || 'en',
    data: {},

    async init() {
      try {
        const response = await fetch('./js/translations.json?v=' + Date.now());
        this.data = await response.json();
        
        // Auto-detect browser language if no saved preference
        if (!localStorage.getItem('ue_guild_lang')) {
          const browserLang = navigator.language.slice(0, 2).toLowerCase();
          if (this.languages.includes(browserLang)) {
            this.currentLang = browserLang;
          }
        }

        this.applyTranslations();
        this.initSwitcher();
      } catch (err) {
        console.error('Failed to load translations:', err);
      }
    },

    t(key) {
      if (!this.data[this.currentLang]) return key;
      return this.data[this.currentLang][key] || this.data['en'][key] || key;
    },

    applyTranslations() {
      // Update all elements with [data-i18n]
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = this.t(key);
        
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = translation;
        } else {
          el.innerHTML = translation;
        }
      });

      // Special case: Page titles and Meta tags if needed
      const pageTitleKey = document.querySelector('h1[data-i18n]')?.getAttribute('data-i18n');
      if (pageTitleKey) {
        document.title = this.t(pageTitleKey) + ' | UE Guild';
      }

      // Update HTML lang attribute
      document.documentElement.lang = this.currentLang;
    },

    setLanguage(lang) {
      if (this.languages.includes(lang)) {
        this.currentLang = lang;
        localStorage.setItem('ue_guild_lang', lang);
        this.applyTranslations();
        
        // Trigger a custom event for other scripts to re-render dynamic content
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
      }
    },

    initSwitcher() {
      const container = document.querySelector('.lang-switcher-container');
      if (container) {
        container.innerHTML = `
          <select class="lang-select" id="lang-switcher">
            <option value="en">🇬🇧 English</option>
            <option value="es">🇪🇸 Español</option>
            <option value="fr">🇫🇷 Français</option>
            <option value="pt">🇧🇷 Português</option>
            <option value="vi">🇻🇳 Tiếng Việt</option>
            <option value="ja">🇯🇵 日本語</option>
            <option value="zh">🇨🇳 简体中文</option>
          </select>
        `;
        const switcher = document.getElementById('lang-switcher');
        switcher.value = this.currentLang;
        switcher.addEventListener('change', (e) => {
          this.setLanguage(e.target.value);
        });
      }
    }
  };

  // Start initialization
  window.i18n.init();
});

/** Global helper function */
window.t = (key) => window.i18n ? window.i18n.t(key) : key;
