import { Match, Switch } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";

interface ButtonMenuProps {
    className?:string;
    label?:string;
    icon?:JSX.Element;
    imageUrl?:string;
    onMouseEnter?:()=>void;
    onMouseLeave?:()=>void;
    onClick?:()=>void;
}

export default function ButtonMenu({label,icon,imageUrl,className,onClick,onMouseEnter,onMouseLeave}:ButtonMenuProps) {
    return (
        <div class={`${className} menu-row w-full sm:w-auto`}>
            <Switch fallback={<></>}>
                <Match when={label && icon != undefined}>
                    <span class="menu-badge"><span class="menu-badge-inner">{icon}</span></span>
                </Match>
                <Match when={label && icon == undefined && imageUrl != undefined}>
                    <span class="menu-badge"><span class="menu-badge-inner"><img src={imageUrl} alt={""} /></span></span>
                </Match>
            </Switch>
            <button
                class={label?"menu-button":""}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onClick={onClick}
            >
                {label ? <span class="font-old text-lg">{label}</span> :  <span class="menu-badge"><span class="menu-badge-inner">{icon}</span></span>}
            </button>
        </div>
    )
}