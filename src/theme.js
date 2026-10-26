export const THEME_KEY='pentreeform:theme';
export const THEME_EVENT='pentreeform-theme-change';
const records=new WeakMap();
function stored(win){try{const value=win.localStorage.getItem(THEME_KEY);return ['light','dark','system'].includes(value)?value:'system'}catch{return 'system'}}
function resolved(win,preference){return preference==='system'?(win.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'):preference}
function apply(win,preference){const theme=resolved(win,preference),doc=win.document;doc.documentElement.dataset.theme=theme;doc.documentElement.style.colorScheme=theme;doc.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#000000':'#ffffff');win.dispatchEvent(new win.Event(THEME_EVENT));return theme}
export function initTheme(win=window){if(records.has(win))return;const record={preference:stored(win)};records.set(win,record);apply(win,record.preference);const media=win.matchMedia?.('(prefers-color-scheme: dark)');media?.addEventListener?.('change',()=>{if(record.preference==='system')apply(win,'system')});win.addEventListener('storage',event=>{if(event.key===THEME_KEY||event.key===null){record.preference=stored(win);apply(win,record.preference)}})}
export function getTheme(win=window){const value=win.document.documentElement.dataset.theme;return value==='dark'||value==='light'?value:resolved(win,stored(win))}
export function setTheme(preference,win=window){if(!['light','dark','system'].includes(preference))return;initTheme(win);records.get(win).preference=preference;try{win.localStorage.setItem(THEME_KEY,preference)}catch{}return apply(win,preference)}
export function toggleTheme(win=window){return setTheme(getTheme(win)==='dark'?'light':'dark',win)}
export function subscribeTheme(callback,win=window){initTheme(win);win.addEventListener(THEME_EVENT,callback);return()=>win.removeEventListener(THEME_EVENT,callback)}
export function themeLabel(win=window){return getTheme(win)==='dark'?'Switch to light mode':'Switch to dark mode'}
