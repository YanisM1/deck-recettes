import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
export function Modal({title,onClose,children,className=''}:{title:string;onClose:()=>void;children:ReactNode;className?:string}) {
  const ref=useRef<HTMLDialogElement>(null), id=useId()
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return ()=>{if(dialog.open)dialog.close()}},[])
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===e.currentTarget){const box=e.currentTarget.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)onClose()}}}>
    <div className="modal-heading"><h2 id={id}>{title}</h2><button className="icon-button" aria-label="Fermer" onClick={onClose}><X size={20}/></button></div>{children}
  </dialog>
}
