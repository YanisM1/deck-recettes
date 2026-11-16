import { it,expect } from 'vitest'
import { render,screen,fireEvent } from '@testing-library/react'
import App from '../App'
it('ouvre les réglages et applique une des dix palettes',()=>{
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Réglages'}))
  expect(screen.getByRole('dialog')).toBeVisible()
  fireEvent.click(screen.getByRole('button',{name:'Dracula'}))
  expect(screen.getByRole('main')).toHaveAttribute('data-theme','dracula')
  expect(screen.getByRole('button',{name:'Dracula'})).toHaveAttribute('aria-pressed','true')
  fireEvent.click(screen.getByRole('button',{name:'Fermer'}))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
