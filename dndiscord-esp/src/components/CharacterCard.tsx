import { Component } from "solid-js";
import { ChevronRight } from "lucide-solid";
import { CharacterDto } from "../services/character.service";
import { getClassHex } from "../utils/classColor";
import { t } from "../i18n";

interface CharacterCardProps {
  character: CharacterDto;
  onClick?: () => void;
}

const CharacterCard: Component<CharacterCardProps> = (props) => {
  const c = () => props.character;
  const initial = () => (c().name?.charAt(0) || "?").toUpperCase();
  const color = () => getClassHex(c().class);

  return (
    <button
      type="button"
      onClick={props.onClick}
      class="menu-card !p-[18px] block w-full text-left"
    >
      <div class="grid items-center gap-[18px]" style={{ "grid-template-columns": "88px 1fr auto" }}>
        <div
          class="w-[88px] h-[88px] rounded-ds-md flex items-center justify-center font-display font-bold text-[32px] shrink-0"
          style={{
            background: `linear-gradient(135deg, ${color()} 0%, rgba(0,0,0,0.5) 120%)`,
            border: "1px solid rgba(244,197,66,0.3)",
            color: "rgba(255,224,138,0.9)",
            "text-shadow": "0 2px 6px rgba(0,0,0,0.5)",
          }}
          aria-hidden="true"
        >
          {initial()}
        </div>

        <div class="min-w-0">
          <h3 class="font-display font-semibold text-[20px] text-high tracking-wide mb-2 truncate">
            {c().name}
          </h3>
          <div class="flex flex-wrap gap-1.5">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold tracking-wide"
              style={{
                background: "rgba(75,30,78,0.7)",
                border: "1px solid rgba(244,197,66,0.35)",
                color: "var(--gold-200)",
              }}
            >
              {t("page.characters.level", { n: c().level })}
            </span>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold tracking-wide"
              style={{
                background: "rgba(22,44,68,0.7)",
                border: "1px solid rgba(106,144,192,0.4)",
                color: "#a4c0e0",
              }}
            >
              {String(c().class)}
            </span>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold tracking-wide"
              style={{
                background: "rgba(20,22,43,0.8)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "var(--text-mid)",
              }}
            >
              {String(c().race)}
            </span>
          </div>
        </div>

        <ChevronRight size={18} class="text-mid" aria-hidden="true" />
      </div>
    </button>
  );
};

export default CharacterCard;
