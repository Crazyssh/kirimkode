"use client";

function parseMarkdown(md: string): string {
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="p-4 rounded-xl bg-surface border border-border overflow-x-auto my-4"><code class="text-sm font-[family-name:var(--font-jetbrains-mono)]">$2</code></pre>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold font-[family-name:var(--font-space-grotesk)] mt-8 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold font-[family-name:var(--font-space-grotesk)] mt-10 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] mt-10 mb-4">$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-surface border border-border text-xs font-[family-name:var(--font-jetbrains-mono)] text-primary">$1</code>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl my-4 max-w-full" loading="lazy" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-primary/30 pl-4 py-1 my-4 text-muted italic">$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="border-border my-8" />')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm text-muted leading-relaxed">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm text-muted leading-relaxed">$1</li>');

  // Wrap consecutive <li> in <ul>/<ol>
  html = html.replace(/((?:<li class="ml-4 list-disc[^>]*>.*?<\/li>\n?)+)/g, '<ul class="space-y-1 my-4">$1</ul>');
  html = html.replace(/((?:<li class="ml-4 list-decimal[^>]*>.*?<\/li>\n?)+)/g, '<ol class="space-y-1 my-4">$1</ol>');

  // Paragraphs: wrap lines that aren't already HTML tags
  html = html
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<")) return trimmed;
      return `<p class="text-sm text-muted leading-relaxed mb-4">${trimmed}</p>`;
    })
    .join("\n");

  // Strip <script> tags for safety
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  return html;
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div
      className="prose-custom"
      dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
    />
  );
}
