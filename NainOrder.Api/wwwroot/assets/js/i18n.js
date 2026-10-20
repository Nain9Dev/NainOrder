/**
 * Internationalisation: Spanish and English, no library. Dictionaries are plain JSON files
 * served as static assets (assets/i18n/*.json), so the static demo host works unchanged and a
 * .NET test can verify both files define the same keys (REQ-094, REQ-095).
 */

const STORAGE_KEY = "nainorder.locale";
const LOCALES = ["es", "en"];
const PARTS = ["", ".views"];
const dictionaries = {};
const reported = new Set();

let locale = "es";

const browserLocale = () => {
  const preferred = (navigator.language || "es").slice(0, 2).toLowerCase();
  return LOCALES.includes(preferred) ? preferred : "en";
};

const savedLocale = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LOCALES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
};

/** Loads both dictionaries once, before the first render. */
export const loadI18n = async () => {
  const read = async (file) => {
    try {
      const response = await fetch(new URL(`../i18n/${file}`, import.meta.url));
      return response.ok ? await response.json() : {};
    } catch {
      return {};
    }
  };

  // Each language is split in parts (shell and drop surfaces, then the back-office views) so
  // they can be maintained separately; the parity test checks the merged result.
  await Promise.all(
    LOCALES.map(async (code) => {
      const parts = await Promise.all(PARTS.map((part) => read(`${code}${part}.json`)));
      dictionaries[code] = Object.assign({}, ...parts);
    })
  );

  locale = savedLocale() ?? browserLocale();
  document.documentElement.lang = locale;
};

export const getLocale = () => locale;

export const locales = () => [...LOCALES];

export const setLocale = (next) => {
  if (!LOCALES.includes(next) || next === locale) return;

  locale = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* Storage may be blocked: the choice then lasts for this visit only. */
  }

  window.dispatchEvent(new CustomEvent("nain:locale", { detail: next }));
};

/** Translates a key, filling `{name}` placeholders. A missing key shows itself, once logged. */
export const t = (key, params) => {
  const text = dictionaries[locale]?.[key] ?? dictionaries.es?.[key];

  if (text === undefined) {
    if (!reported.has(key)) {
      reported.add(key);
      console.warn(`[i18n] missing key: ${key}`);
    }
    return key;
  }

  return params ? text.replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match) : text;
};

/** Applies `data-i18n` (text) and `data-i18n-attr="attribute:key"` (attributes) under a root. */
export const applyStatic = (root = document) => {
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  root.querySelectorAll("[data-i18n-attr]").forEach((node) => {
    node.dataset.i18nAttr.split(";").forEach((pair) => {
      const [attribute, key] = pair.split(":");
      node.setAttribute(attribute.trim(), t(key.trim()));
    });
  });
};

/** Locale-aware number and money formatting for the active language. */
export const intlLocale = () => (locale === "en" ? "en-GB" : "es-ES");
