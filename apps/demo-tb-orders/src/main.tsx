import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-gray-100 p-6 flex items-start justify-center">
      <div className="w-full max-w-lg">
        <App />
      </div>
    </div>
  </React.StrictMode>
);
