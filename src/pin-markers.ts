import { Annotation } from './types';

const PIN_CLASS = 'da-pin-marker';
const pins = new Map<string, HTMLDivElement>();

export function addPin(annotation: Annotation, index: number): void {
  removePin(annotation.id);

  const rect = annotation.element.getBoundingClientRect();
  const pin = document.createElement('div');
  pin.className = PIN_CLASS;
  pin.dataset.annotationId = annotation.id;

  pin.style.cssText = `
    position: fixed;
    left: ${rect.right - 10}px;
    top: ${rect.top - 10}px;
    width: 22px;
    height: 22px;
    background: #7C3AED;
    color: white;
    border-radius: 50%;
    font: 600 11px/22px -apple-system, BlinkMacSystemFont, sans-serif;
    text-align: center;
    z-index: 2147483642;
    pointer-events: auto;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    transition: transform 0.15s ease;
  `;
  pin.textContent = String(index + 1);

  // Tooltip on hover
  pin.title = annotation.prompt.slice(0, 60) + (annotation.prompt.length > 60 ? '...' : '');

  pin.addEventListener('mouseenter', () => {
    pin.style.transform = 'scale(1.2)';
  });
  pin.addEventListener('mouseleave', () => {
    pin.style.transform = 'scale(1)';
  });

  document.body.appendChild(pin);
  pins.set(annotation.id, pin);
}

export function removePin(id: string): void {
  const pin = pins.get(id);
  if (pin) {
    pin.remove();
    pins.delete(id);
  }
}

export function updateAllPins(annotations: Annotation[]): void {
  clearAllPins();
  annotations.forEach((a, i) => addPin(a, i));
}

export function clearAllPins(): void {
  pins.forEach(pin => pin.remove());
  pins.clear();
}

export function onPinClick(handler: (id: string) => void): void {
  document.addEventListener('click', (e) => {
    const pin = (e.target as HTMLElement).closest(`.${PIN_CLASS}`) as HTMLDivElement | null;
    if (pin?.dataset.annotationId) {
      e.stopPropagation();
      handler(pin.dataset.annotationId);
    }
  }, true);
}
