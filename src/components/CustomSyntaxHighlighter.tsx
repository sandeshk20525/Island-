import React, { useMemo } from 'react';

interface HighlighterProps {
  code: string;
  language: 'kotlin' | 'xml' | 'plaintext' | 'gradle' | 'markdown';
}

export const CustomSyntaxHighlighter: React.FC<HighlighterProps> = ({ code, language }) => {
  const highlighted = useMemo(() => {
    const lines = code.split('\n');

    return lines.map((line, index) => {
      let content = line;

      // Handle simple syntax highlighters based on language
      if (language === 'kotlin' || language === 'gradle') {
        // Escaped HTML entities first
        content = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        // Highlight single line comments
        if (content.includes('//')) {
          const parts = content.split('//');
          const before = parts[0];
          const comment = parts.slice(1).join('//');
          content = `${before}<span class="text-emerald-500 opacity-80">//${comment}</span>`;
        } else if (content.includes('/*') || content.trim().startsWith('*')) {
          // Multiline comments rough highlighting
          content = `<span class="text-emerald-500 opacity-80">${content}</span>`;
        } else {
          // Keywords
          const keywords = [
            'package', 'import', 'class', 'interface', 'object', 'fun', 'val', 'var',
            'private', 'public', 'const', 'override', 'try', 'catch', 'throw', 'return',
            'if', 'else', 'return', 'plugins', 'id', 'implementation', 'compileOnly',
            'repositories', 'google', 'mavenCentral'
          ];
          
          keywords.forEach(kw => {
            const regex = new RegExp(`\\b${kw}\\b`, 'g');
            content = content.replace(regex, `<span class="text-rose-400 font-semibold">${kw}</span>`);
          });

          // Common Android & LSPosed Types
          const types = [
            'IXposedHookLoadPackage', 'XC_LoadPackage', 'LoadPackageParam', 'XC_MethodHook',
            'MethodHookParam', 'Logger', 'XposedHelpers', 'XposedBridge', 'Log', 'Throwable',
            'Exception', 'Int', 'String', 'Boolean'
          ];
          types.forEach(t => {
            const regex = new RegExp(`\\b${t}\\b`, 'g');
            content = content.replace(regex, `<span class="text-sky-400 font-medium">${t}</span>`);
          });

          // Strings (quotes)
          content = content.replace(/(["'])(.*?)\1/g, '<span class="text-amber-300">"$2"</span>');
          
          // Annotations
          content = content.replace(/(@\w+)/g, '<span class="text-violet-400 font-semibold">$1</span>');
        }
      } else if (language === 'xml') {
        content = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        // Highlight XML comments
        if (content.includes('&lt;!--')) {
          content = `<span class="text-emerald-500 opacity-80">${content}</span>`;
        } else {
          // XML tags
          content = content.replace(/(&lt;\/?[\w:-]+)/g, '<span class="text-rose-400 font-medium">$1</span>');
          content = content.replace(/(\/?&gt;)/g, '<span class="text-rose-400 font-medium">$1</span>');
          
          // XML attributes
          content = content.replace(/([\w:-]+)(=)/g, '<span class="text-sky-400">$1</span>$2');
          
          // Strings (quotes)
          content = content.replace(/(["'])(.*?)\1/g, '<span class="text-amber-300">"$2"</span>');
        }
      } else if (language === 'markdown') {
        content = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        // Headers
        if (content.startsWith('#')) {
          content = `<span class="text-rose-400 font-bold text-base">${content}</span>`;
        }
        // Bold
        content = content.replace(/\*\*(.*?)\*\*/g, '<span class="font-bold text-gray-100">$1</span>');
        // Backticks code inline
        content = content.replace(/`(.*?)`/g, '<span class="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-amber-200 text-xs font-medium">$1</span>');
      } else {
        // Plaintext or generic
        content = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      return (
        <div key={index} className="table-row group hover:bg-zinc-800/40 select-text leading-6">
          <span className="table-cell text-right pr-4 select-none opacity-25 text-[11px] font-mono w-10 border-r border-zinc-800 text-zinc-400 align-top pt-0.5">
            {index + 1}
          </span>
          <span 
            className="table-cell pl-4 font-mono text-[13px] text-zinc-300 whitespace-pre break-all align-top"
            dangerouslySetInnerHTML={{ __html: content || ' ' }}
          />
        </div>
      );
    });
  }, [code, language]);

  return (
    <div className="w-full overflow-x-auto select-text">
      <div className="table w-full border-collapse">
        {highlighted}
      </div>
    </div>
  );
};
