import { Annotation } from './types';
import { tokens } from './styles';

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
    left: ${rect.right - 12}px;
    top: ${rect.top - 12}px;
    width: 24px;
    height: 24px;
    background: ${tokens.color.primary[600]};
    color: white;
    border-radius: ${tokens.radius.full};
    font: ${tokens.font.weight.bold} ${tokens.font.size.xs}/${tokens.font.lineHeight.tight} ${tokens.font.family};
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: ${tokens.z.pins};
    pointer-events: auto;
    cursor: pointer;
    box-shadow: ${tokens.shadow.md}, 0 0 0 2px ${tokens.color.surface.base};
    transition: transform ${tokens.transition.spring}, box-shadow ${tokens.transition.normal};
    animation: da-scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
  pin.textContent = String(index + 1);
  pin.title = annotation.prompt
    ? annotation.prompt.slice(0, 60) + (annotation.prompt.length > 60 ? '...' : '')
    : annotation.colorSuggestion ? `Color: ${annotation.colorSuggestion}` : 'Properties captured';

  pin.addEventListener('mouseenter', () => {
    pin.style.transform = 'scale(1.15)';
    pin.style.boxShadow = `${tokens.shadow.lg}, ${tokens.shadow.glow}, 0 0 0 2px ${tokens.color.surface.base}`;
  });
  pin.addEventListener('mouseleave', () => {
    pin.style.transform = 'scale(1)';
    pin.style.boxShadow = `${tokens.shadow.md}, 0 0 0 2px ${tokens.color.surface.base}`;
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
