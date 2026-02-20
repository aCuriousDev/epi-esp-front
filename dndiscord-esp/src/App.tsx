import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/im-fell-english-sc";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./lib/jquery-setup";

import MenuComponent from "./pages/MenuComponent";

export default function App() {
  return <MenuComponent />;
}
