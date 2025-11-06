import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // A simple regex-based markdown to HTML converter for this PoC
  const toHtml = (text: string): string => {
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Line breaks
      .replace(/\n/gim, '<br />');

    // Lists (handle multiline lists)
    html = html.replace(/(\<br \/\>)?- (.*)/gim, '<li>$2</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
    html = html.replace(/<\/ul\>\<br \/\><ul>/gim, '');

    return html;
  };

  return (
    <div
      className="markdown-content whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: toHtml(content || '') }}
    />
  );
};

export default MarkdownRenderer;
