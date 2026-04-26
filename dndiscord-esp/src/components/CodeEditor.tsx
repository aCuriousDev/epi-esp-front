import { onMount, onCleanup } from 'solid-js';

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
  let editor: any;

  const format = async (value: string): Promise<string> => {
    try {
      const prettier = await import('prettier');
      const parserBabel = await import('prettier/parser-babel');
      return await prettier.format(value, {
        parser: 'json',
        plugins: [parserBabel.default ?? parserBabel],
        tabWidth: 2,
      });
    } catch {
      return value;
    }
  };

  onMount(async () => {
    const monaco = await import('monaco-editor');

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
      run: async (ed: any) => {
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
