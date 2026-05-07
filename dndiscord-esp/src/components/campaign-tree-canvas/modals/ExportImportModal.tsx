import Modal from '@/components/Modal';
import draw2d from "draw2d"
import { Accessor, Component, createEffect, createSignal } from 'solid-js';
import { CampaignNode } from '../nodes/CampaignNode';
import { CampaignTreeCanvasRef } from '../CampagnTreeCanvas';
import CodeEditor from '@/components/CodeEditor';

interface ExportImportModalProps {
  isOpen: boolean;
  canvasRef :Accessor<CampaignTreeCanvasRef | undefined>;
  onClose: () => void;
  onExport: () => void;
  onImport: (data: any) => void;
}

const ExportImportModal: Component<ExportImportModalProps> = (props) => {
  const [jsonDefinition,setJsonDefinition] = createSignal<string>("[]")

  const handleExport = () => {
    props.onExport();
    props.onClose();
  };

  const handleImport = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        props.onImport(data);
        props.onClose();
      } catch {
        alert('Invalid file');
      }
    };
    reader.readAsText(file);
  };
  createEffect(async () => {
    if (props.isOpen && props.canvasRef()) {
      const json = props.canvasRef()?.exportData();
      setJsonDefinition(json ?? "[]");
    }
  });

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Export / Import"
      footer={
        <div class='flex flex-row justify-end'>
            <div class='flex flex-row'>
                <button
                 class="mr-1 flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-white-500 hover:text-gray-100 rounded-xl transition-all shadow-lg shadow-gray-500/20"
                 onClick={props.onClose}>Close</button>
                <button
                 class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20"
                 onClick={() => {
                   try {
                     const data = JSON.parse(jsonDefinition());
                     props.onImport(data);
                     props.onClose();
                   } catch {
                     // invalid JSON -- keep modal open
                   }
                 }}>Save</button>
            </div>
        </div>
        }
    >
     <div>
        <CodeEditor value={jsonDefinition()} language="json" onChange={setJsonDefinition} />
     </div>
    </Modal>
  );
};

export default ExportImportModal;