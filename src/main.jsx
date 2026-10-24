import React from 'react';
import {createRoot} from 'react-dom/client';
import LiveRoot from './LiveRoot.jsx';
import './styles.css';
import './support.css';
import './landing.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><LiveRoot/></React.StrictMode>);
