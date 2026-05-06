import { useNavigate } from "@solidjs/router";
import {
  Users,
  Globe,
  Lock,
  Mail,
  BookOpen,
  Plus,
} from "lucide-solid";
import { Component, createSignal, JSX, Show } from "solid-js";
import PageMeta from "../layouts/PageMeta";
import { t } from "../i18n";
import { Button } from "../components/common/Button";
import { CampaignVisibility } from "../types/campaign";
import {
  CampaignService,
  APICampaignStatus,
} from "../services/campaign.service";

/**
 * Single-step campaign creation — only fields the backend actually persists:
 * name, description, imageUrl, maxPlayers, isPublic, status. The old 3-step
 * wizard collected setting/startingLevel/tags that were silently dropped at the
 * API boundary and displayed back as hardcoded placeholders — pure scaffolding.
 */

// ---------------------------------------------------------------------------
// VisChip
// ---------------------------------------------------------------------------

interface VisChipProps {
  icon: JSX.Element;
  label: string;
  active: boolean;
  onClick: () => void;
}

const VisChip: Component<VisChipProps> = (props) => (
  <button
    type="button"
    onClick={props.onClick}
    class={
      "flex-1 flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-ds-md transition-all duration-ds-xs focus-ring-gold " +
      (props.active
        ? "border text-high"
        : "bg-ink-700 border border-ink-500 text-high hover:border-plum-500")
    }
    style={
      props.active
        ? {
            background:
              "linear-gradient(135deg, rgba(75,30,78,0.7), rgba(22,44,68,0.7))",
            "border-color": "rgba(244,197,66,0.45)",
            "box-shadow":
              "0 0 20px rgba(244,197,66,0.35), 0 0 40px rgba(75,30,78,0.4)",
          }
        : undefined
    }
  >
    {props.icon}
    <span class="font-display font-semibold text-[13px] tracking-wide">
      {props.label}
    </span>
  </button>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreateCampaign() {
  const navigate = useNavigate();

  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [imageUrl, setImageUrl] = createSignal("");
  const [visibility, setVisibility] = createSignal<CampaignVisibility>(
    CampaignVisibility.Private,
  );
  const [maxPlayers, setMaxPlayers] = createSignal(5);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const canSubmit = () => title().trim().length >= 3 && !isSubmitting();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!canSubmit()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await CampaignService.createCampaign({
        name: title().trim(),
        description: description().trim() || undefined,
        imageUrl: imageUrl().trim() || undefined,
        maxPlayers: maxPlayers(),
        isPublic: visibility() === CampaignVisibility.Public,
        status: APICampaignStatus.Draft,
      });
      navigate(`/campaigns/${response.id}`);
    } catch (err: any) {
      console.error("Failed to create campaign:", err);
      setError(
        err.response?.data?.message ??
          "Failed to create campaign. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  // Common input class
  const inputCls =
    "w-full px-3.5 py-3 bg-ink-600 border border-ink-500 rounded-ds-sm text-high text-[14px] outline-none focus:border-gold-400 transition-colors placeholder:text-mute";

  return (
    <>
      <PageMeta title={t("page.createCampaign.title")} />

      <div class="max-w-[640px] mx-auto">
        <p class="font-old italic text-mid text-center mb-6 max-w-xl mx-auto">
          {t("createCampaign.subtitle")}
        </p>

        <form
          onSubmit={handleSubmit}
          class="surface-1 rounded-ds-lg shadow-soft p-8"
          style={{ "border-color": "rgba(244,197,66,0.2)" }}
        >
          {/* Eyebrow */}
          <div
            class="flex items-center gap-2.5 mb-6 pb-4.5 border-b"
            style={{ "border-color": "rgba(244,197,66,0.2)" }}
          >
            <BookOpen size={18} class="text-gold-300" aria-hidden="true" />
            <span class="font-display font-semibold text-[16px] tracking-wide text-high">
              {t("page.createCampaign.basicInfo")}
            </span>
          </div>

          {/* Campaign name */}
          <div class="mb-4">
            <label class="block font-inter font-medium text-[13px] text-mid mb-2">
              {t("createCampaign.nameLabel").replace(" *", "")}{" "}
              <span class="text-gold-300">*</span>
            </label>
            <input
              type="text"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              placeholder={t("createCampaign.namePlaceholder")}
              class={inputCls}
              maxLength={100}
            />
            <div class="flex justify-end mt-1 font-mono text-[11px] text-mute">
              {t("page.createCampaign.charCounter", {
                n: title().length,
                max: 100,
              })}
            </div>
          </div>

          {/* Description */}
          <div class="mb-4">
            <label class="block font-inter font-medium text-[13px] text-mid mb-2">
              {t("createCampaign.descriptionLabel")}
            </label>
            <textarea
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder={t("createCampaign.descriptionPlaceholder")}
              class={
                "w-full min-h-[90px] px-3.5 py-3 bg-ink-600 border border-ink-500 rounded-ds-sm text-high text-[14px] outline-none resize-y focus:border-gold-400 transition-colors placeholder:text-mute"
              }
              maxLength={500}
            />
            <div class="flex justify-end mt-1 font-mono text-[11px] text-mute">
              {t("page.createCampaign.charCounter", {
                n: description().length,
                max: 500,
              })}
            </div>
          </div>

          {/* Cover image */}
          <div class="mb-5">
            <label class="block font-inter font-medium text-[13px] text-mid mb-2">
              {t("createCampaign.imageUrlLabel")}
            </label>
            <input
              type="url"
              value={imageUrl()}
              onInput={(e) => setImageUrl(e.currentTarget.value)}
              placeholder="https://…"
              class={inputCls}
            />
          </div>

          {/* Visibility chips */}
          <div class="mb-5">
            <label class="block font-inter font-medium text-[13px] text-mid mb-2">
              {t("createCampaign.visibilityLabel")}
            </label>
            <div class="flex gap-2.5">
              <VisChip
                icon={<Lock size={20} strokeWidth={1.5} />}
                label={t("createCampaign.visibility.private")}
                active={visibility() === CampaignVisibility.Private}
                onClick={() => setVisibility(CampaignVisibility.Private)}
              />
              <VisChip
                icon={<Mail size={20} strokeWidth={1.5} />}
                label={t("createCampaign.visibility.invite")}
                active={visibility() === CampaignVisibility.InviteOnly}
                onClick={() => setVisibility(CampaignVisibility.InviteOnly)}
              />
              <VisChip
                icon={<Globe size={20} strokeWidth={1.5} />}
                label={t("createCampaign.visibility.public")}
                active={visibility() === CampaignVisibility.Public}
                onClick={() => setVisibility(CampaignVisibility.Public)}
              />
            </div>
          </div>

          {/* Max players slider */}
          <div class="mb-6">
            <label class="block font-inter font-medium text-[13px] text-mid mb-2">
              <span class="inline-flex items-center gap-1.5">
                <Users size={13} class="text-gold-300" aria-hidden="true" />
                <span>{t("createCampaign.maxPlayersLabel")}</span>
              </span>
            </label>
            <div class="flex items-center gap-3.5">
              <input
                type="range"
                min="2"
                max="6"
                value={maxPlayers()}
                onInput={(e) =>
                  setMaxPlayers(parseInt(e.currentTarget.value, 10))
                }
                class="flex-1"
                style={{ "accent-color": "#F4C542" }}
              />
              <span
                class="min-w-[42px] text-center px-3 py-2 rounded-ds-md font-mono text-[14px] font-semibold text-gold-300"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(75,30,78,0.6), rgba(22,44,68,0.6))",
                  border: "1px solid rgba(244,197,66,0.35)",
                }}
              >
                {maxPlayers()}
              </span>
            </div>
            <div class="flex justify-between mt-1.5 font-mono text-[11px] text-mute">
              <span>2 {t("page.createCampaign.minPlayers")}</span>
              <span>6 {t("page.createCampaign.maxPlayers")}</span>
            </div>
          </div>

          {/* Error */}
          <Show when={error()}>
            <div class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-ds-md text-danger text-[13px]">
              {error()}
            </div>
          </Show>

          {/* Submit */}
          <Button
            type="submit"
            disabled={!canSubmit()}
            fullWidth
            size="lg"
            leadingIcon={
              <Show when={!isSubmitting()}>
                <Plus size={18} aria-hidden="true" />
              </Show>
            }
          >
            <Show
              when={isSubmitting()}
              fallback={t("createCampaign.submit")}
            >
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t("createCampaign.submitting")}
            </Show>
          </Button>
        </form>
      </div>
    </>
  );
}
