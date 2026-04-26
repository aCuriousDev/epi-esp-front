import { Component, lazy, Suspense } from "solid-js";
import Modal from "../Modal";
import { t } from "../../i18n";

const RulesContent = lazy(() => import("../../pages/Rules"));

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: Component<RulesModalProps> = (props) => {
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title={t("page.rules.title")}>
      <Suspense fallback={<p class="text-mid">{t("common.loading")}</p>}>
        <RulesContent />
      </Suspense>
    </Modal>
  );
};

export default RulesModal;
