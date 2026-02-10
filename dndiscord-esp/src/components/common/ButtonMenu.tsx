import { Match, Show, Switch } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";

interface ButtonMenuProps {
	className?: string;
	label?: string;
	icon?: JSX.Element;
	imageUrl?: string;
	onMouseEnter?: () => void;
	onMouseLeave?: () => void;
	onClick?: () => void | undefined;
}

export default function ButtonMenu({
	label,
	icon,
	imageUrl,
	className,
	onClick,
	onMouseEnter,
	onMouseLeave,
}: ButtonMenuProps) {
	return (
		<div class={`${className || ""} menu-row w-full sm:w-auto`}>
			{/* Badge/Avatar shown only when there's a label */}
			<Show when={label}>
				<Switch fallback={<></>}>
					<Match when={icon != undefined}>
						<span class="menu-badge">
							<span class="menu-badge-inner">{icon}</span>
						</span>
					</Match>
					<Match when={imageUrl != undefined}>
						<span class="menu-avatar">
							<img
								src={imageUrl}
								alt=""
								class="w-full h-full object-cover rounded-full"
							/>
						</span>
					</Match>
				</Switch>
			</Show>

			{/* Button - different styles for label vs icon-only */}
			<button
				class={label ? "menu-button" : "menu-button-icon"}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
				onClick={onClick}
			>
				{label ? (
					<span class="font-old text-lg">{label}</span>
				) : (
					<span class="text-white">{icon}</span>
				)}
			</button>
		</div>
	);
}
