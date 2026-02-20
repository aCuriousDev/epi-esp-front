import $ from "jquery";
import "jquery-ui-dist/jquery-ui.min.css";

(window as any).jQuery = $;
(window as any).$ = $;

await import("jquery-ui-dist/jquery-ui.min.js");

export default $;
