import React,{useSyncExternalStore} from 'react';
import {Sun,Moon} from 'lucide-react';
import {getTheme,toggleTheme,subscribeTheme,themeLabel} from './theme.js';
export default function ThemeToggle(){const theme=useSyncExternalStore(subscribeTheme,getTheme,()=> 'light');return <button type="button" className="theme-toggle" onClick={()=>toggleTheme()} aria-label={themeLabel()} aria-pressed={theme==='dark'} title={themeLabel()}><Sun className="theme-sun" size={20} aria-hidden="true"/><Moon className="theme-moon" size={20} aria-hidden="true"/></button>}
