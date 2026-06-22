import { render } from 'preact';
import { App } from './app';
import { config } from './config';
import './styles.css';

const initialTheme = localStorage.getItem('bullpen-theme') ?? config.theme;
document.documentElement.setAttribute('data-theme', initialTheme);
document.title = config.title;

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}
