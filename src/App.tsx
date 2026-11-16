import { useEffect, useState, type CSSProperties } from 'react'
import { Settings as SettingsIcon, ChefHat } from 'lucide-react'
import { Settings } from './components/Settings'
import { themes, usePreferences, inkOn } from './services/preferences'
import { useRecipes } from './services/recipeSync'
export default function App() {
  const preferences=usePreferences(), theme=themes.find(t=>t.id===preferences.theme)!, [settings,setSettings]=useState(false)
  const recipes=useRecipes()
  useEffect(()=>{document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.bg)},[theme.bg])
  const style={'--bg':theme.bg,'--text':theme.text,'--accent-primary':theme.primary,'--accent-secondary':theme.secondary,'--on-primary':inkOn(theme.primary),'--on-secondary':inkOn(theme.secondary),colorScheme:theme.dark?'dark':'light'} as CSSProperties
  return <main className="device-frame" data-theme={theme.id} data-tone={theme.dark?'dark':'light'} style={style}>
    <button className="settings-trigger icon-button" aria-label="Réglages" onClick={()=>setSettings(true)}><SettingsIcon size={21}/></button>
    <div className="home-intro"><p className="brand"><ChefHat size={17}/> DECKCHEF</p><h1>À table<span>.</span></h1><p className="intro-caption">Vos recettes, à votre façon.</p></div>
    <div className="initial-note"><ChefHat size={38}/><p>{recipes.recipes.length} recettes à savourer.<br/>Beaucoup de plaisir.</p></div>
    {settings&&<Settings onClose={()=>setSettings(false)}/>}
  </main>
}
