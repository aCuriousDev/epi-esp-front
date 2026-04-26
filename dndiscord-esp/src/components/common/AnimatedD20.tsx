/**
 * Back-compat shim.
 *
 * The original `AnimatedD20` was a flat SVG component. It has been replaced by
 * a real 3D d20 — see `./DiceD20/Dice3D.tsx`. This file re-exports the new
 * component under the historical name so that existing callers
 * (MenuComponent, LoginPage, etc.) work unchanged.
 */

import { Dice3D, type Dice3DProps } from "./DiceD20/Dice3D";

export type AnimatedD20Props = Dice3DProps;

export function AnimatedD20(props: Dice3DProps) {
	return <Dice3D {...props} />;
}

export default AnimatedD20;
