import { onMount, onCleanup, createEffect } from 'solid-js';
import * as monaco from 'monaco-editor';
import prettier from 'prettier';
import parserBabel from 'prettier/parser-babel';

interface CodeEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  height?: string;
  format?: boolean;
  onChange?: (value: string) => void;
}

const CodeEditor = (props: CodeEditorProps) => {
  let ref: HTMLDivElement | undefined;
  let editor: monaco.editor.IStandaloneCodeEditor;

  const format = async (value: string): Promise<string> => {
    try {
      return await prettier.format(value, {
        parser: 'json',
        plugins: [parserBabel],
        tabWidth: 2,
      });
    } catch {
      return value;
    }
  };

  onMount(async () => {
    const initialValue = props.format
      ? await format(props.value)
      : props.value;

    editor = monaco.editor.create(ref!, {
      value: initialValue,
      language: props.language ?? 'json',
      theme: 'vs-dark',
      readOnly: props.readOnly ?? false,
      minimap: { enabled: false },
      fontSize: 13,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      formatOnPaste: true,
      formatOnType: true,
    });

    // Raccourci Shift+Alt+F pour formater manuellement
    editor.addAction({
      id: 'format',
      label: 'Format',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      run: async (ed) => {
        const formatted = await format(ed.getValue());
        ed.setValue(formatted);
      },
    });

    editor.onDidChangeModelContent(() => {
      props.onChange?.(editor.getValue());
    });
  });

  onCleanup(() => editor?.dispose());

  return <div ref={ref} style={{ height: props.height ?? '400px', width: '100%' }} />;
};

export default CodeEditor;