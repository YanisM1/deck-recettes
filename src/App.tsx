import { useEffect, useState, type CSSProperties } from 'react'
import { Settings as SettingsIcon, ChefHat } from 'lucide-react'
import { Settings } from './components/Settings'
import { themes, usePreferences, inkOn } from './services/preferences'
import { getRecipeStore, useRecipes } from './services/recipeSync'
import { Sidebar } from './components/Sidebar'
import { CardDeck } from './components/CardDeck'
import { RecipeBook } from './components/RecipeBook'
import { RecipeReader } from './components/RecipeReader'
import { RecipeForm } from './components/RecipeForm'
import { filterRecipes, type Filters, type Recipe } from './types'
export default function App() {
  const preferences=usePreferences(), theme=themes.find(t=>t.id===preferences.theme)!, [settings,setSettings]=useState(false)
  const recipes=useRecipes()
  const [filters,setFilters]=useState<Filters>({sale:true,sucre:true}),[selectedId,setSelectedId]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('recipe')),[editing,setEditing]=useState<Recipe|'new'|null>(null)
  const selected=recipes.recipes.find(recipe=>recipe.id===selectedId)
  const visible=filterRecipes(recipes.recipes,filters)
  useEffect(()=>{document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.bg)},[theme.bg])
  const style={'--bg':theme.bg,'--text':theme.text,'--accent-primary':theme.primary,'--accent-secondary':theme.secondary,'--on-primary':inkOn(theme.primary),'--on-secondary':inkOn(theme.secondary),colorScheme:theme.dark?'dark':'light'} as CSSProperties
  return <main className="device-frame" data-layout={preferences.layoutMode} data-theme={theme.id} data-tone={theme.dark?'dark':'light'} style={style}>
    <button className="settings-trigger icon-button" aria-label="Réglages" onClick={()=>setSettings(true)}><SettingsIcon size={21}/></button>
    <div className="home-intro"><p className="brand"><ChefHat size={17}/> DECKCHEF</p><h1>{preferences.layoutMode==='book'?'À feu doux':'À table'}<span>.</span></h1><p className="intro-caption">{preferences.layoutMode==='book'?'De belles pages à cuisiner.':'Vos recettes, à votre façon.'}</p></div>
    <Sidebar filters={filters} onToggle={category=>setFilters(value=>({...value,[category]:!value[category]}))} onAdd={()=>setEditing('new')}/>
    {visible.length?(preferences.layoutMode==='book'?<RecipeBook key={visible.map(r=>r.id).join('|')} recipes={visible} onOpen={recipe=>setSelectedId(recipe.id)}/>:<CardDeck key={visible.map(r=>r.id).join('|')} recipes={visible} onOpen={recipe=>setSelectedId(recipe.id)}/>):<div className="empty-state"><ChefHat size={34}/><h2>{recipes.recipes.length?'Un peu plus de choix ?':'Votre prochaine découverte.'}</h2><p>{recipes.recipes.length?'Activez Salé ou Sucré pour retrouver vos recettes.':'Chaque belle recette commence par une idée.'}</p>{recipes.recipes.length?<button className="secondary-button" onClick={()=>setFilters({sale:true,sucre:true})}>Tout afficher</button>:<button className="primary-button" onClick={()=>setEditing('new')}>Ajouter ma première recette</button>}</div>}
    {selected&&<RecipeReader key={selected.id} recipe={selected} onClose={()=>setSelectedId(null)} onEdit={()=>setEditing(selected)} onDelete={()=>{getRecipeStore().remove(selected.id);setSelectedId(null)}}/>}
    {editing&&<RecipeForm recipe={editing==='new'?undefined:editing} onClose={()=>setEditing(null)} onSave={(input,id)=>{const saved=getRecipeStore().save(input,id);setEditing(null);setSelectedId(saved.id)}}/>}
    {settings&&<Settings onClose={()=>setSettings(false)}/>}
  </main>
}
