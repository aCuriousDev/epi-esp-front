import type { JSX, Component } from "solid-js";
import {
  Swords,
  Shield,
  Skull,
  Crown,
  Sparkles,
  Wand2,
  Target,
  User,
  Map,
  Dices,
  Trophy,
  Timer,
  Hourglass,
  Zap,
  Check,
  Castle,
  Hand,
  MousePointer,
  Move,
  RotateCcw,
  Flag,
  Users,
  Link,
  Heart,
  X,
  ArrowLeft,
  ScrollText,
  Drama,
  Moon,
  BookOpen,
  Plus,
} from "lucide-solid";

interface IconProps {
  class?: string;
}

type IconComponent = Component<IconProps>;

const iconClass = (base: string, extra?: string) =>
  extra ? `${base} ${extra}` : base;

export function getUnitIcon(type: string, props?: IconProps): JSX.Element {
  const cls = iconClass("w-5 h-5", props?.class);
  switch (type) {
    case "warrior":
      return <Swords class={cls} />;
    case "barbarian":
      return <Swords class={cls} />;
    case "mage":
      return <Wand2 class={cls} />;
    case "archer":
      return <Target class={cls} />;
    case "rogue":
      return <Swords class={cls} />;
    case "enemy_skeleton":
      return <Skull class={cls} />;
    case "enemy_skeleton_rogue":
      return <Skull class={cls} />;
    case "enemy_skeleton_minion":
      return <Skull class={cls} />;
    case "enemy_mage":
      return <Wand2 class={cls} />;
    default:
      return <User class={cls} />;
  }
}

export function getPhaseIcon(phase: string, props?: IconProps): JSX.Element {
  const cls = iconClass("w-4 h-4 inline-block mr-1.5", props?.class);
  switch (phase) {
    case "setup":
      return <Hourglass class={cls} />;
    case "combat_preparation":
      return <Swords class={cls} />;
    case "player_turn":
      return <Shield class={cls} />;
    case "enemy_turn":
      return <Skull class={cls} />;
    case "animation":
      return <Timer class={cls} />;
    case "game_over":
      return <Flag class={cls} />;
    case "free_roam":
      return <Map class={cls} />;
    default:
      return <Hourglass class={cls} />;
  }
}

export function getModeIcon(mode: string, props?: IconProps): JSX.Element {
  const cls = iconClass("w-10 h-10", props?.class);
  switch (mode) {
    case "free_roam":
      return <Map class={cls} />;
    case "combat":
      return <Swords class={cls} />;
    case "dungeon":
      return <Castle class={cls} />;
    case "multiplayer":
      return <Users class={cls} />;
    default:
      return <Dices class={cls} />;
  }
}

export const CheckIcon: IconComponent = (props) => (
  <Check class={iconClass("w-4 h-4", props.class)} />
);

export const ZapIcon: IconComponent = (props) => (
  <Zap class={iconClass("w-4 h-4", props.class)} />
);

export const CastleIcon: IconComponent = (props) => (
  <Castle class={iconClass("w-4 h-4", props.class)} />
);

export const TrophyIcon: IconComponent = (props) => (
  <Trophy class={iconClass("w-8 h-8", props.class)} />
);

export const SkullIcon: IconComponent = (props) => (
  <Skull class={iconClass("w-8 h-8", props.class)} />
);

export const MapIcon: IconComponent = (props) => (
  <Map class={iconClass("w-6 h-6", props.class)} />
);

export const DicesIcon: IconComponent = (props) => (
  <Dices class={iconClass("w-5 h-5", props.class)} />
);

export const LinkIcon: IconComponent = (props) => (
  <Link class={iconClass("w-10 h-10", props.class)} />
);

export const PlusIcon: IconComponent = (props) => (
  <Plus class={iconClass("w-10 h-10", props.class)} />
);

export const HeartIcon: IconComponent = (props) => (
  <Heart class={iconClass("w-4 h-4", props.class)} />
);

export const XIcon: IconComponent = (props) => (
  <X class={iconClass("w-4 h-4", props.class)} />
);

export const SwordsIcon: IconComponent = (props) => (
  <Swords class={iconClass("w-5 h-5", props.class)} />
);

export const ScrollTextIcon: IconComponent = (props) => (
  <ScrollText class={iconClass("w-4 h-4", props.class)} />
);

export const ArrowLeftIcon: IconComponent = (props) => (
  <ArrowLeft class={iconClass("w-4 h-4", props.class)} />
);

export const HandIcon: IconComponent = (props) => (
  <Hand class={iconClass("w-4 h-4", props.class)} />
);

export const MousePointerIcon: IconComponent = (props) => (
  <MousePointer class={iconClass("w-4 h-4", props.class)} />
);

export const MoveIcon: IconComponent = (props) => (
  <Move class={iconClass("w-4 h-4", props.class)} />
);

export const RotateCcwIcon: IconComponent = (props) => (
  <RotateCcw class={iconClass("w-4 h-4", props.class)} />
);

export const DramaIcon: IconComponent = (props) => (
  <Drama class={iconClass("w-4 h-4", props.class)} />
);

export const MoonIcon: IconComponent = (props) => (
  <Moon class={iconClass("w-4 h-4", props.class)} />
);

export const BookOpenIcon: IconComponent = (props) => (
  <BookOpen class={iconClass("w-4 h-4", props.class)} />
);

export const SparklesIcon: IconComponent = (props) => (
  <Sparkles class={iconClass("w-4 h-4", props.class)} />
);

export {
  Swords,
  Shield,
  Skull,
  Crown,
  Sparkles,
  Wand2,
  Target,
  User,
  Map as MapLucide,
  Dices,
  Trophy,
  Timer,
  Hourglass,
  Zap,
  Check,
  Castle,
  Hand,
  MousePointer,
  Move,
  RotateCcw,
  Flag,
  Users,
  Link,
  Heart,
  X,
  ArrowLeft,
  ScrollText,
  Drama,
  Moon,
  BookOpen,
  Plus,
};
