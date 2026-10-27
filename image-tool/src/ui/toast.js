import { el } from '../utils/dom.js';
import { icon } from './icons.js';

export function createToast(container) {
  return function toast(message, type = 'info', duration = 3000) {
    const node = el(
      'div',
      {
        class: `toast toast--${type}`,
        role: 'status',
        'aria-live': 'polite',
      },
      el('span', { html: icon(type === 'error' ? 'info' : type === 'warn' ? 'info' : 'check', 16) }),
      el('span', { text: message }),
    );
    container.append(node);
    while (container.children.length > 3) {
      container.firstElementChild.remove();
    }
    const remove = () => {
      node.style.opacity = '0';
      node.style.transform = 'translateY(6px)';
      window.setTimeout(() => node.remove(), 180);
    };
    window.setTimeout(remove, duration);
    return node;
  };
}
