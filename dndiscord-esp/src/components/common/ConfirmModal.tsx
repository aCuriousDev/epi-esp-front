import { Show } from "solid-js";
import { AlertTriangle, X } from "lucide-solid";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal(props: ConfirmModalProps) {
  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={props.onCancel}
      >
        <div
          class="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1d2e] shadow-2xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={props.onCancel}
            class="absolute top-4 right-4 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X class="w-4 h-4" />
          </button>

          {/* Icon + title */}
          <div class="flex items-center gap-3 mb-4">
            <div class={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              props.danger
                ? "bg-red-500/20 border border-red-500/30"
                : "bg-amber-500/20 border border-amber-500/30"
            }`}>
              <AlertTriangle class={`w-5 h-5 ${props.danger ? "text-red-400" : "text-amber-400"}`} />
            </div>
            <h2 class="text-white font-semibold text-base leading-tight pr-6">
              {props.title}
            </h2>
          </div>

          {/* Message */}
          <p class="text-slate-400 text-sm leading-relaxed mb-6">
            {props.message}
          </p>

          {/* Actions */}
          <div class="flex gap-3 justify-end">
            <button
              onClick={props.onCancel}
              class="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
            >
              {props.cancelLabel ?? "Cancel"}
            </button>
            <button
              onClick={props.onConfirm}
              class={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                props.danger
                  ? "bg-red-600 hover:bg-red-500 border border-red-500/50 text-white"
                  : "bg-amber-600 hover:bg-amber-500 border border-amber-500/50 text-white"
              }`}
            >
              {props.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
