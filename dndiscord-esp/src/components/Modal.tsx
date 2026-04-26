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
            background: 'rgba(7,8,18,0.75)',
            'backdrop-filter': 'blur(4px)',
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
          background: 'var(--ink-800)',
          border: '1px solid rgba(255,255,255,0.08)',
          'border-radius': '20px',
          padding: '1.5rem',
          width: 'min(90vw, 720px)',
          'max-height': 'min(90dvh, 800px)',
          display: 'flex',
          'flex-direction': 'column',
          gap: '1rem',
          'box-shadow': '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
          overflow: 'auto',
        }}>

          {/* Header */}
          <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
            <Show when={props.title}>
              <h2 style={{ margin: 0, color: 'var(--text-high)', 'font-size': '1.1rem' }}>{props.title}</h2>
            </Show>
            <button onClick={props.onClose} style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', 'font-size': '1.2rem', 'margin-left': 'auto' }}>
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{ 'overflow-y': 'auto' }}>
            {props.children}
          </div>

          {/* Footer */}
          <Show when={props.footer}>
            <div style={{ 'border-top': '1px solid rgba(255,255,255,0.08)', 'padding-top': '1rem' }}>
              {props.footer}
            </div>
          </Show>

        </div>
      </Show>
    </Portal>
  );
};

export default Modal;