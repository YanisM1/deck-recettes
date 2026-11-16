import { describe,it,expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { parsePreferences, themes, inkOn, setPreferences, usePreferences, PREFERENCES_KEY } from './preferences'
describe('préférences',()=>{
  it('utilise cards et crème par défaut',()=>expect(parsePreferences(null)).toEqual({layoutMode:'cards',theme:'creme'}))
  it('restaure livre et thème',()=>expect(parsePreferences('{"layoutMode":"book","theme":"oled"}')).toEqual({layoutMode:'book',theme:'oled'}))
  it('ignore données corrompues et modes inconnus',()=>{ expect(parsePreferences('{')).toEqual(parsePreferences(null));expect(parsePreferences('{"layoutMode":"other"}').layoutMode).toBe('cards');expect(parsePreferences('null')).toEqual(parsePreferences(null)) })
  it('possède dix palettes uniques et des encres contrastées',()=>{expect(new Set(themes.map(t=>t.id)).size).toBe(10);expect(inkOn('#000000')).toBe('#ffffff');expect(inkOn('#ffffff')).toBe('#191919')})
  it('bascule les deux modes et sauvegarde le choix',()=>{
    const {result,unmount}=renderHook(()=>usePreferences())
    act(()=>setPreferences({layoutMode:'book'}))
    expect(result.current.layoutMode).toBe('book')
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).layoutMode).toBe('book')
    act(()=>setPreferences({layoutMode:'cards'}))
    expect(result.current.layoutMode).toBe('cards')
    unmount()
  })
  it('réagit aux préférences modifiées dans un autre onglet',()=>{
    const {result,unmount}=renderHook(()=>usePreferences())
    act(()=>{localStorage.setItem(PREFERENCES_KEY,JSON.stringify({layoutMode:'book',theme:'rose'}));window.dispatchEvent(new StorageEvent('storage',{key:PREFERENCES_KEY}))})
    expect(result.current).toEqual({layoutMode:'book',theme:'rose'})
    act(()=>{localStorage.removeItem(PREFERENCES_KEY);window.dispatchEvent(new StorageEvent('storage',{key:null}))})
    expect(result.current.layoutMode).toBe('cards')
    unmount()
  })
})
