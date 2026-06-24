import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Minus,
} from 'lucide-react';

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const ToolbarButton: React.FC<{
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1.5 rounded-lg transition-all text-sm ${
      active
        ? 'bg-brand text-white shadow-sm'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    } disabled:opacity-30 disabled:cursor-not-allowed`}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-5 bg-slate-200 mx-1 self-center" />;

export const RichTextEditor: React.FC<Props> = ({ content, onChange, placeholder }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[200px] p-6 outline-none focus:outline-none',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border-2 border-slate-100 rounded-2xl overflow-hidden focus-within:border-brand transition-all bg-white">
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-100 bg-slate-50">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo"><Undo size={15} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo"><Redo size={15} /></ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1"><Heading1 size={15} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 size={15} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 size={15} /></ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold size={15} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic size={15} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><UnderlineIcon size={15} /></ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List"><List size={15} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List"><ListOrdered size={15} /></ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left"><AlignLeft size={15} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center"><AlignCenter size={15} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right"><AlignRight size={15} /></ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule"><Minus size={15} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <span className="text-[11px] font-black px-0.5">"</span>
        </ToolbarButton>
      </div>
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <p className="absolute top-6 left-6 text-slate-400 text-sm pointer-events-none italic">{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

// Convert legacy markdown to HTML for backwards compatibility
export function markdownToHtml(md: string): string {
  if (!md || md.trim().startsWith('<')) return md; // already HTML
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, (_, item) => `<li>${item}</li>`)
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/^(\d+)\. (.+)$/gm, (_, __, item) => `<li>${item}</li>`)
    .split('\n\n')
    .map(block => block.startsWith('<') ? block : `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
    .trim();
}
