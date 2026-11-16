import { useState } from 'react'
import { Check, Copy, Trash2, RefreshCw } from 'lucide-react'
import { Modal } from './Modal'
import { setPreferences, themes, usePreferences } from '../services/preferences'
import { getCollectionKey, getRecipeStore, openCollection, useRecipes } from '../services/recipeSync'
import { buildWidgetScript } from '../services/widgetScript'
export function Settings({onClose}:{onClose:()=>void}) {
  const preferences=usePreferences()
  const data=useRecipes(),[resetStage,setResetStage]=useState(0),[code,setCode]=useState(''),[notice,setNotice]=useState('')
  async function copyCode(){try{await navigator.clipboard.writeText(getCollectionKey());setNotice('Code du carnet copié.')}catch{setNotice('Copie indisponible. Sélectionnez le code ci-dessous.')}}
  async function copyWidget(){try{await navigator.clipboard.writeText(buildWidgetScript('https://deck-recettes.vercel.app',getCollectionKey(),import.meta.env.VITE_SUPABASE_URL||'',import.meta.env.VITE_SUPABASE_ANON_KEY||''));setNotice('Script copié. Collez-le dans un nouveau script Scriptable, puis ajoutez le widget à votre écran d’accueil.')}catch{setNotice('La copie est indisponible dans ce navigateur. Réessayez dans Safari.')}}
  if(resetStage)return <Modal title={resetStage===1?'Repartir de zéro ?':'Dernière confirmation'} onClose={()=>setResetStage(0)}><p className="confirmation-copy">{resetStage===1?'Toutes les recettes et photos de ce carnet seront effacées, sur tous les appareils qui partagent son code.':'Cette suppression est définitive. Les autres carnets et applications ne seront pas affectés.'}</p><div className="confirmation-actions"><button className="secondary-button" onClick={()=>setResetStage(0)}>Annuler</button><button className="danger-button" onClick={()=>{if(resetStage===1){setResetStage(2);return}try{getRecipeStore().reset();setResetStage(0);setNotice('Le carnet est vide.')}catch(error){setNotice((error as Error).message);setResetStage(0)}}}>{resetStage===1?'Continuer':'Oui, effacer mon carnet'}</button></div></Modal>
  return <Modal title="À votre goût." onClose={onClose} className="settings">
    <p className="modal-subtitle">Un carnet qui vous ressemble.</p>
    <h3 className="eyebrow">Votre palette</h3>
    <div className="theme-grid">{themes.map(theme=><button key={theme.id} className={`theme-option ${preferences.theme===theme.id?'selected':''}`} aria-pressed={preferences.theme===theme.id} onClick={()=>setPreferences({theme:theme.id})}>
      <span className="theme-swatches" style={{background:theme.bg}}><i style={{background:theme.primary}}/><i style={{background:theme.secondary}}/>{preferences.theme===theme.id&&<Check size={14}/>}</span><span>{theme.name}</span>
    </button>)}</div>
    <div className="connection-status" role="status"><span className={`status-dot ${data.status==='offline'?'offline':''}`}/>{data.status==='local'?'Sauvegarde sur cet appareil':data.status==='syncing'?'Synchronisation…':data.status==='offline'?'Hors ligne · sauvegarde locale':data.realtime?'Supabase · temps réel connecté':'Supabase · carnet synchronisé'}<button className="small-icon" aria-label="Synchroniser maintenant" onClick={()=>void getRecipeStore().sync()}><RefreshCw size={14}/></button></div>
    {data.pending>0&&<p className="fine-print">{data.pending} modification{data.pending>1?'s':''} en attente.</p>}
    <details className="sync-details"><summary>Retrouver mon carnet sur un autre appareil</summary><p className="fine-print">Copiez ce code privé, puis ouvrez ce carnet dans les réglages de votre autre appareil. Toute personne qui possède le code peut modifier ses recettes.</p><div className="code-row"><input aria-label="Code privé de ce carnet" readOnly value={getCollectionKey()}/><button className="small-icon" onClick={()=>void copyCode()} aria-label="Copier le code du carnet"><Copy size={16}/></button></div><label className="field-label" htmlFor="collection-code">Ouvrir un carnet existant</label><input id="collection-code" className="text-input" value={code} onChange={e=>setCode(e.target.value)} placeholder="Collez votre code privé" autoComplete="off" spellCheck={false}/><button className="secondary-button full-width" onClick={()=>{try{openCollection(code)}catch(error){setNotice((error as Error).message)}}}>Ouvrir ce carnet</button></details>
    <details className="sync-details widget-help"><summary>Une recette sur l’écran d’accueil</summary><p className="fine-print">Dans Scriptable, créez un script et collez le texte copié. Ajoutez ensuite le widget Scriptable à votre écran d’accueil et choisissez ce script.</p><button className="secondary-button full-width" disabled={!import.meta.env.VITE_SUPABASE_URL} onClick={()=>void copyWidget()}><Copy size={14}/> Copier le script Scriptable</button></details>
    <button className="reset-button" onClick={()=>setResetStage(1)}><Trash2 size={15}/> Reset Total · repartir de zéro</button>
    {notice&&<p className="notice" role="status">{notice}</p>}
    <p className="fine-print">Fait pour les petites et les grandes faims.</p>
  </Modal>
}
