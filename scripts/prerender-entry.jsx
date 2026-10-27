import React,{Suspense} from 'react';
import {renderToString} from 'react-dom/server';
import Landing from '../src/Landing.jsx';
import PublicPage from '../src/PublicPages.jsx';
export function renderPage(page){return renderToString(<Suspense fallback={null}>{page==='home'?<Landing/>:<PublicPage page={page}/>}</Suspense>)}
