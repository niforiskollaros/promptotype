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

export interface SourceLocation {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
  componentName?: string;
}

export interface DesignChanges {
  text?: string;           // New text content (if changed)
  textColor?: string;      // New text color hex
  bgColor?: string;        // New background color hex
  fontSize?: string;       // New font size
  fontWeight?: string;     // New font weight
  lineHeight?: string;     // New line height
  margin?: string;         // New margin
  padding?: string;        // New padding
  addClasses?: string[];   // Tailwind classes to add
  removeClasses?: string[]; // Tailwind classes to remove
}

export interface Annotation {
  id: string;
  element: HTMLElement;
  selector: string;
  styles: ExtractedStyles;
  source: SourceLocation | null;
  cssClasses: string[];
  textContent: string;
  screenshotDataUrl: string | null;
  changes: DesignChanges;
  prompt: string;
  colorSuggestion: string;
  timestamp: number;
}

export type Mode = 'inactive' | 'inspect' | 'annotate' | 'review';
