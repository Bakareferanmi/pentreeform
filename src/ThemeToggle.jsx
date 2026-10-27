import React,{useSyncExternalStore} from 'react';
import {Sun,Moon} from 'lucide-react';
import {getTheme,toggleTheme,subscribeTheme} from './theme.js';
export default function ThemeToggle(){const theme=useSyncExternalStore(subscribeTheme,getTheme,()=> 'light'),label=theme==='dark'?'Switch to light mode':'Switch to dark mode';return <button type="button" className="theme-toggle" onClick={()=>toggleTheme()} aria-label={label} aria-pressed={theme==='dark'} title={label}><Sun className="theme-sun" size={20} aria-hidden="true"/><Moon className="theme-moon" size={20} aria-hidden="true"/></button>}
