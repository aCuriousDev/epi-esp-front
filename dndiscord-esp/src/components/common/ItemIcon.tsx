import { Icon } from "@iconify-icon/solid";
import "../../services/iconSetup";
import { getItemIcon } from "../../services/itemVisuals";

interface ItemIconProps {
  iconKey: string;
  class?: string;
  size?: string;
}

export default function ItemIcon(props: ItemIconProps) {
  return (
    <Icon
      icon={getItemIcon(props.iconKey)}
      {...(props.size ? { width: props.size, height: props.size } : {})}
      class={props.class ?? ""}
    />
  );
}
