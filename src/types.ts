export interface ExtractedStyles {
  font: {
    family: string;
    size: string;
    weight: string;
    lineHeight: string;
  };
  color: {
    text: string;
    background: string;
  };
  spacing: {
    margin: string;
    padding: string;
  };
  alignment: {
    textAlign: string;
    display: string;
    alignItems: string;
    justifyContent: string;
  };
}

export interface Annotation {
  id: string;
  element: HTMLElement;
  selector: string;
  styles: ExtractedStyles;
  prompt: string;
  colorSuggestion: string;
  timestamp: number;
}

export type Mode = 'inactive' | 'inspect' | 'annotate' | 'review';
