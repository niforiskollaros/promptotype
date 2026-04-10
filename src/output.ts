import { Annotation } from './types';
import { getUIRoot } from './context';

export function generateMarkdown(annotations: Annotation[]): string {
  let md = `## Design Annotations (${annotations.length} element${annotations.length !== 1 ? 's' : ''})\n\n`;

  annotations.forEach((a, i) => {
    const s = a.styles;
    md += `### ${i + 1}. \`${a.selector}\`\n`;
    if (a.source) {
      const loc = `${a.source.fileName}:${a.source.lineNumber}`;
      const comp = a.source.componentName ? ` (${a.source.componentName})` : '';
      md += `**Source:** \`${loc}\`${comp}\n`;
    }
    if (a.textContent) {
      md += `**Text:** "${a.textContent}"\n`;
    }
    if (a.cssClasses.length > 0) {
      md += `**Classes:** \`${a.cssClasses.join(' ')}\`\n`;
    }
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
    getUIRoot().appendChild(textarea);
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
 * Check if the MCP server is reachable (extension mode).
 */
export function isMcpMode(): boolean {
  return !!(window as any).__PT_MCP__;
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

/**
 * Submit annotations to the local MCP server (extension mode).
 * Returns true if successful, false otherwise.
 */
export async function submitToMcp(markdown: string): Promise<boolean> {
  try {
    const port = (window as any).__PT_MCP_PORT__ || 4100;
    const res = await fetch(`http://localhost:${port}/__pt__/api/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
