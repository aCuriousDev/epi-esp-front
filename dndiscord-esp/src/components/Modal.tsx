import { Component, JSX, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: JSX.Element;
  footer?: JSX.Element;
}

const Modal: Component<ModalProps> = (props) => {
  return (
    <Portal>
      <Show when={props.isOpen}>
        {/* Overlay */}
        <div
          onClick={props.onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            'z-index': 1000,
          }}
        />

        {/* Modal */}
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          'z-index': 1001,
          background: '#1a1a2e',
          border: '1px solid #333',
          'border-radius': '12px',
          padding: '1.5rem',
          'min-width': '1000px',
          'max-width': '90vw',
          'max-height': '90vh',
          display: 'flex',
          'flex-direction': 'column',
          gap: '1rem',
        }}>

          {/* Header */}
          <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
            <Show when={props.title}>
              <h2 style={{ margin: 0, color: '#fff', 'font-size': '1.1rem' }}>{props.title}</h2>
            </Show>
            <button onClick={props.onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', 'font-size': '1.2rem', 'margin-left': 'auto' }}>
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{ 'overflow-y': 'auto' }}>
            {props.children}
          </div>

          {/* Footer */}
          <Show when={props.footer}>
            <div style={{ 'border-top': '1px solid #333', 'padding-top': '1rem' }}>
              {props.footer}
            </div>
          </Show>

        </div>
      </Show>
    </Portal>
  );
};

export default Modal;