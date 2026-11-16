import { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { tags } from '@lezer/highlight';

const latexLanguage = StreamLanguage.define(stex);

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#7c3aed' },
  { tag: tags.tagName, color: '#7c3aed' },
  { tag: tags.string, color: '#b45309' },
  { tag: tags.comment, color: '#6b7280', fontStyle: 'italic' },
  { tag: tags.number, color: '#0f766e' },
  { tag: tags.operator, color: '#9ca3af' },
  { tag: tags.punctuation, color: '#9ca3af' },
  { tag: tags.bracket, color: '#9ca3af' },
  { tag: tags.attributeName, color: '#0f766e' },
]);

const editorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: '#ffffff',
      color: '#000000',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: '13px',
      lineHeight: '1.6',
    },
    '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit' },
    '.cm-content': { padding: '12px 0', caretColor: '#000000' },
    '.cm-gutters': {
      backgroundColor: '#f5f5f5',
      color: '#999999',
      borderRight: '1px solid #e3e3e3',
      padding: '12px 0',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 14px', minWidth: '40px' },
    '.cm-activeLine': { backgroundColor: '#f5f5f5' },
    '.cm-activeLineGutter': { backgroundColor: '#e5e5e5', color: '#000000' },
    '&.cm-focused': { outline: 'none' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: '#ffe800 !important',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#000000' },
    '.cm-matchingBracket': { backgroundColor: '#ffe800', color: '#000000' },
    '.cm-searchMatch': { backgroundColor: '#ffe800', color: '#000000' },
    '.cm-searchMatch-selected': { backgroundColor: '#f5d90a' },
    '.cm-panels': {
      backgroundColor: '#f5f5f5',
      color: '#000000',
      borderColor: '#e3e3e3',
    },
    '.cm-textfield': {
      backgroundColor: '#ffffff',
      border: '1px solid #c9c9c9',
      borderRadius: '8px',
      padding: '4px 8px',
    },
    '.cm-button': {
      backgroundImage: 'none',
      backgroundColor: '#ffffff',
      border: '1px solid #c9c9c9',
      borderRadius: '8px',
      color: '#000000',
    },
    '.cm-tooltip': {
      backgroundColor: '#ffffff',
      border: '1px solid #e3e3e3',
      borderRadius: '10px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    },
  },
  { dark: false },
);

interface LatexEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  errorMessage?: string | null;
}

export function LatexEditor({ value, onChange, onSave, errorMessage }: LatexEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });

  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  useEffect(() => {
    if (!containerRef.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        keymap.of([
          {
            key: 'Mod-s',
            run: () => {
              onSaveRef.current?.();
              return true;
            },
          },
        ]),
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
        syntaxHighlighting(highlightStyle),
        latexLanguage,
        editorTheme,
        EditorView.contentAttributes.of({ 'aria-label': 'Código LaTeX do currículo' }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            setCursor({ line: line.number, col: head - line.from + 1 });
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" data-testid="latex-editor" />
      <div
        className="flex h-8 shrink-0 items-center justify-between border-t border-line bg-wash px-3 text-2xs text-muted"
        data-testid="latex-status"
      >
        <span>
          Ln {cursor.line}, Col {cursor.col}
        </span>
        <span className="flex items-center gap-3">
          <span>LaTeX</span>
          <span>UTF-8</span>
          <span>Spaces: 2</span>
        </span>
      </div>
      {errorMessage && (
        <div className="max-h-32 shrink-0 overflow-y-auto border-t border-danger/30 bg-danger-wash px-3 py-2 text-2xs text-danger">
          {errorMessage}
        </div>
      )}
    </div>
  );
}