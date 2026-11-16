import { Check } from 'lucide-react'
import { Modal } from './Modal'
import { setPreferences, themes, usePreferences } from '../services/preferences'
export function Settings({onClose}:{onClose:()=>void}) {
  const preferences=usePreferences()
  return <Modal title="À votre goût." onClose={onClose} className="settings">
    <p className="modal-subtitle">Un carnet qui vous ressemble.</p>
    <h3 className="eyebrow">Votre palette</h3>
    <div className="theme-grid">{themes.map(theme=><button key={theme.id} className={`theme-option ${preferences.theme===theme.id?'selected':''}`} aria-pressed={preferences.theme===theme.id} onClick={()=>setPreferences({theme:theme.id})}>
      <span className="theme-swatches" style={{background:theme.bg}}><i style={{background:theme.primary}}/><i style={{background:theme.secondary}}/>{preferences.theme===theme.id&&<Check size={14}/>}</span><span>{theme.name}</span>
    </button>)}</div>
    <div className="connection-status"><span className="status-dot"/>Carnet local</div>
    <p className="fine-print">Vos préférences sont conservées sur cet appareil.</p>
  </Modal>
}
