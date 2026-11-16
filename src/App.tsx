import { useEffect, useState, type CSSProperties } from 'react'
import { Settings as SettingsIcon, ChefHat } from 'lucide-react'
import { Settings } from './components/Settings'
import { themes, usePreferences, inkOn } from './services/preferences'
import { useRecipes } from './services/recipeSync'
import { Sidebar } from './components/Sidebar'
import { CardDeck } from './components/CardDeck'
import { Modal } from './components/Modal'
import { filterRecipes, type Filters, type Recipe } from './types'
export default function App() {
  const preferences=usePreferences(), theme=themes.find(t=>t.id===preferences.theme)!, [settings,setSettings]=useState(false)
  const recipes=useRecipes()
  const [filters,setFilters]=useState<Filters>({sale:true,sucre:true}),[selected,setSelected]=useState<Recipe|null>(null),[adding,setAdding]=useState(false)
  const visible=filterRecipes(recipes.recipes,filters)
  useEffect(()=>{document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.bg)},[theme.bg])
  const style={'--bg':theme.bg,'--text':theme.text,'--accent-primary':theme.primary,'--accent-secondary':theme.secondary,'--on-primary':inkOn(theme.primary),'--on-secondary':inkOn(theme.secondary),colorScheme:theme.dark?'dark':'light'} as CSSProperties
  return <main className="device-frame" data-theme={theme.id} data-tone={theme.dark?'dark':'light'} style={style}>
    <button className="settings-trigger icon-button" aria-label="Réglages" onClick={()=>setSettings(true)}><SettingsIcon size={21}/></button>
    <div className="home-intro"><p className="brand"><ChefHat size={17}/> DECKCHEF</p><h1>À table<span>.</span></h1><p className="intro-caption">Vos recettes, à votre façon.</p></div>
    <Sidebar filters={filters} onToggle={category=>setFilters(value=>({...value,[category]:!value[category]}))} onAdd={()=>setAdding(true)}/>
    {visible.length?<CardDeck key={visible.map(r=>r.id).join('|')} recipes={visible} onOpen={setSelected}/>:<div className="empty-state"><ChefHat size={34}/><h2>{recipes.recipes.length?'Un peu plus de choix ?':'Votre prochaine découverte.'}</h2><p>{recipes.recipes.length?'Activez Salé ou Sucré pour retrouver vos recettes.':'Chaque belle recette commence par une idée.'}</p>{recipes.recipes.length?<button className="secondary-button" onClick={()=>setFilters({sale:true,sucre:true})}>Tout afficher</button>:<button className="primary-button" onClick={()=>setAdding(true)}>Ajouter ma première recette</button>}</div>}
    {(selected||adding)&&<Modal title={selected?.title||'À vous de jouer.'} onClose={()=>{setSelected(null);setAdding(false)}}><p className="confirmation-copy">Une pincée d’inspiration, une recette à partager.</p></Modal>}
    {settings&&<Settings onClose={()=>setSettings(false)}/>}
  </main>
}
