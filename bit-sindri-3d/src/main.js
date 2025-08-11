import App from './core/App.js';

const container = document.getElementById('app');
const app = new App(container);

// Expose for debugging
window.__APP__ = app;
