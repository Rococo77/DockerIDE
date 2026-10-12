import React from 'react';
import { createRoot } from 'react-dom/client';
// Before any editor is created: use the bundled Monaco, not the CDN
import './monaco';
import App from './App';
import { ToastProvider } from './components/ide/ToastContainer';
import '../index.css';

const container = document.getElementById('root');
if (container) {
	const root = createRoot(container);
	root.render(
		<React.StrictMode>
			<ToastProvider>
				<App />
			</ToastProvider>
		</React.StrictMode>
	);
}
