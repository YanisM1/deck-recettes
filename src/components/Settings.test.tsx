import { it,expect } from 'vitest'
import { render,screen,fireEvent } from '@testing-library/react'
import App from '../App'
import { PREFERENCES_KEY } from '../services/preferences'
it('ouvre les réglages et applique une des dix palettes',()=>{
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Réglages'}))
  expect(screen.getByRole('dialog')).toBeVisible()
  fireEvent.click(screen.getByRole('button',{name:'Dracula'}))
  expect(screen.getByRole('main')).toHaveAttribute('data-theme','dracula')
  expect(screen.getByRole('button',{name:'Dracula'})).toHaveAttribute('aria-pressed','true')
  fireEvent.click(screen.getByRole('button',{name:'Fermer'}))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('bascule Cartes/Livre dans les réglages et persiste le choix',()=>{
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Réglages'}));fireEvent.click(screen.getByRole('button',{name:'Livre de recettes'}));expect(screen.getByRole('main')).toHaveAttribute('data-layout','book');expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).layoutMode).toBe('book');fireEvent.click(screen.getByRole('button',{name:'Paquet de cartes'}));expect(screen.getByRole('main')).toHaveAttribute('data-layout','cards')
})
