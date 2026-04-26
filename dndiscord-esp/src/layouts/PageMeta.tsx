import {
  Accessor,
  Component,
  JSX,
  createContext,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";

export interface PageMetaState {
  title: string;
  rightSlot?: JSX.Element;
  hideBackButton?: boolean;
}

interface PageMetaContextValue {
  meta: Accessor<PageMetaState>;
  setMeta: (next: PageMetaState) => void;
  resetMeta: () => void;
}

const defaultMeta: PageMetaState = { title: "" };

const PageMetaContext = createContext<PageMetaContextValue>();

export function PageMetaProvider(props: { children: JSX.Element }) {
  const [meta, setMetaSignal] = createSignal<PageMetaState>(defaultMeta);

  const value: PageMetaContextValue = {
    meta,
    setMeta: (next) => setMetaSignal(next),
    resetMeta: () => setMetaSignal(defaultMeta),
  };

  return (
    <PageMetaContext.Provider value={value}>
      {props.children}
    </PageMetaContext.Provider>
  );
}

export function usePageMeta(): PageMetaContextValue {
  const ctx = useContext(PageMetaContext);
  if (!ctx) {
    // Fallback: noop accessor — happens only outside a shell (e.g. legal pages
    // or the Rules modal mounted from TopBarHelpButton).
    const [meta] = createSignal(defaultMeta);
    return { meta, setMeta: () => {}, resetMeta: () => {} };
  }
  return ctx;
}

interface PageMetaProps extends PageMetaState {}

/**
 * Declarative title + right-slot setter. Render once near the top of any
 * page that lives inside MenuShell.
 */
export const PageMeta: Component<PageMetaProps> = (props) => {
  const ctx = usePageMeta();
  onMount(() =>
    ctx.setMeta({
      title: props.title,
      rightSlot: props.rightSlot,
      hideBackButton: props.hideBackButton,
    }),
  );
  onCleanup(() => ctx.resetMeta());
  return null;
};

export default PageMeta;
