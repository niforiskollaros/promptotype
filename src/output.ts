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
    md += `**Prompt:** ${a.prompt}\n`;
    if (a.colorSuggestion) {
      md += `\n**Suggested color:** ${a.colorSuggestion}\n`;
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
