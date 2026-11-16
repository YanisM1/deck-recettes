import { useSyncExternalStore } from 'react'
import type { LayoutMode } from '../types'
export const themes = [
  {id:'oled',name:'OLED Black & Gold',bg:'#000000',primary:'#d4af37',secondary:'#b79557',text:'#f7f0df',dark:true},
  {id:'dracula',name:'Dracula',bg:'#282a36',primary:'#bd93f9',secondary:'#ff79c6',text:'#f8f8f2',dark:true},
  {id:'tokyo',name:'Tokyo Night',bg:'#1a1b26',primary:'#7aa2f7',secondary:'#bb9af7',text:'#d8def2',dark:true},
  {id:'nord',name:'Nord Polar',bg:'#2e3440',primary:'#88c0d0',secondary:'#81a1c1',text:'#eceff4',dark:true},
  {id:'monokai',name:'Monokai Pro',bg:'#2d2a2e',primary:'#ffd866',secondary:'#ff6188',text:'#fcfcfa',dark:true},
  {id:'catppuccin',name:'Catppuccin Mocha',bg:'#1e1e2e',primary:'#cba6f7',secondary:'#f38ba8',text:'#cdd6f4',dark:true},
  {id:'solarized',name:'Solarized Light',bg:'#fdf6e3',primary:'#268bd2',secondary:'#cb4b16',text:'#34494f',dark:false},
  {id:'creme',name:'Chef Crème',bg:'#faf6f0',primary:'#e07a5f',secondary:'#3d405b',text:'#36342f',dark:false},
  {id:'matcha',name:'Matcha & Lin',bg:'#f4f7f2',primary:'#52796f',secondary:'#2f3e46',text:'#2f3e46',dark:false},
  {id:'rose',name:'Rose Macaron',bg:'#fff8fa',primary:'#ff8fa3',secondary:'#590d22',text:'#590d22',dark:false},
] as const
export interface Preferences { layoutMode: LayoutMode; theme: string }
export const PREFERENCES_KEY = 'deckchef.preferences.v1'
export const parsePreferences = (raw: string | null): Preferences => {
  try { const value = JSON.parse(raw || '{}'); return {layoutMode:value?.layoutMode === 'book' ? 'book' : 'cards',theme:themes.some(t=>t.id===value?.theme) ? value.theme : 'creme'} } catch { return {layoutMode:'cards',theme:'creme'} }
}
function read() { try { return parsePreferences(localStorage.getItem(PREFERENCES_KEY)) } catch { return parsePreferences(null) } }
let state = read()
const listeners = new Set<() => void>()
function emit() { listeners.forEach(fn=>fn()) }
export function setPreferences(value: Partial<Preferences>) { const next = {...state,...value}; localStorage.setItem(PREFERENCES_KEY,JSON.stringify(next)); state=next; emit() }
if (typeof window !== 'undefined') window.addEventListener('storage',event=>{if(event.key===PREFERENCES_KEY || event.key===null){state=read();emit()}})
export function usePreferences() { return useSyncExternalStore(fn=>{listeners.add(fn);return ()=>listeners.delete(fn)},()=>state) }
export function inkOn(hex: string) { const n = parseInt(hex.slice(1),16); const l = [n>>16,(n>>8)&255,n&255].map(v=>{const c=v/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4}); return .2126*l[0]+.7152*l[1]+.0722*l[2] > .179 ? '#191919' : '#ffffff' }
