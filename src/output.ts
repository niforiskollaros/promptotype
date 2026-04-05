import { Annotation } from './types';

export function generateMarkdown(annotations: Annotation[]): string {
  let md = `## Design Annotations (${annotations.length} element${annotations.length !== 1 ? 's' : ''})\n\n`;

  annotations.forEach((a, i) => {
    const s = a.styles;
    md += `### ${i + 1}. \`${a.selector}\`\n`;
    md += `**Current styles:**\n`;
    md += `- Font: ${s.font.family}, ${s.font.size}, weight ${s.font.weight}, line-height ${s.font.lineHeight}\n`;
    md += `- Color: ${s.color.text} (on background ${s.color.background})\n`;
    md += `- Margin: ${s.spacing.margin}\n`;
    md += `- Padding: ${s.spacing.padding}\n`;
    md += `- Alignment: ${s.alignment.textAlign}, ${s.alignment.display}, align-items: ${s.alignment.alignItems}\n`;
    md += `\n`;
    if (a.prompt) {
      md += `**Prompt:** ${a.prompt}\n`;
    }
    if (a.colorSuggestion) {
      md += `\n**Suggested color:** ${a.colorSuggestion}\n`;
    }
    if (!a.prompt && !a.colorSuggestion) {
      md += `**Prompt:** Review this element\n`;
    }
    md += `\n---\n\n`;
  });

  return md.trim();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    textarea.remove();
    return success;
  }
}

/**
 * Check if we're running through the Promptotype proxy.
 */
export function isProxyMode(): boolean {
  return !!(window as any).__PT_PROXY__;
}

/**
 * Submit annotations to the proxy server's API endpoint.
 * Returns true if successful, false otherwise.
 */
export async function submitToProxy(markdown: string): Promise<boolean> {
  try {
    const origin = (window as any).__PT_PROXY_ORIGIN__ || window.location.origin;
    const token = (window as any).__PT_SESSION_TOKEN__ || '';
    const res = await fetch(`${origin}/__pt__/api/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown, token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
