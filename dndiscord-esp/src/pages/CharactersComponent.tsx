import { Navigate } from "@solidjs/router";
import { Plus, PlusIcon, Settings } from "lucide-solid";
import { createSignal, For, Show } from "solid-js"
import ButtonMenu from "../components/common/ButtonMenu";

export default function CharactersComponent() {
    const [characters, setCharacters] = createSignal<Array<any>>([
        {
            first_name:"Aria",last_name:"SombreLame",campagn : {title:"La quête d'Asteria"},profil_picture_url:"https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
        }]);
    return (
        <div class="relative min-h-full w-full overflow-hidden bg-brand-gradient">
            <div class="vignette absolute inset-0"></div>
            <header class="text-center">
                <button class="settings-btn" aria-label="Paramètres" onClick={() => (location.hash = '#parametres')}>
                    <Settings class="settings-icon h-5 w-5" />
                </button>
                <h1 class="title-shine title-gradient font-display text-white text-5xl sm:text-6xl md:text-7xl tracking-wide bg-clip-text text-transparent drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">
                    Mes Personnages
                </h1>
                <p class="mt-3 text-slate-100/90 max-w-xl mx-auto">
                    L'ensemble de vos héros créés apparaîtront ici.
                </p>
            </header>
            <main class="relative z-10 mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center gap-10 p-6 sm:p-10">
                <For each={characters()}>
                    {(character,index)=> (
                        <ButtonMenu label={character.first_name + " " + character.last_name}
                                    imageUrl={character.profil_picture_url}/>
                          
                    )}
                </For>
                <ButtonMenu className={"m-4"} icon={<Plus class=""/>}></ButtonMenu>
            </main>
            <footer>

            </footer>

        </div>
    )

}