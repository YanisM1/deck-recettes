import {it,expect,vi} from 'vitest'
import {render,screen,fireEvent,act} from '@testing-library/react'
import {RecipeBook} from './RecipeBook'
import {starterRecipes} from '../data/recipes'
it('tourne une page en 3D, revient et ouvre la recette courante',()=>{
  vi.useFakeTimers();const open=vi.fn();const {container}=render(<RecipeBook recipes={starterRecipes} onOpen={open}/>);expect(screen.getByText('Page 1 sur 4')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Page suivante'}));expect(container.querySelector('.turn-forward')).toBeInTheDocument();act(()=>vi.advanceTimersByTime(680));expect(screen.getByText('Page 2 sur 4')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:`Lire ${starterRecipes[1].title}`}));expect(open).toHaveBeenCalledWith(starterRecipes[1]);fireEvent.click(screen.getByRole('button',{name:'Page précédente'}));expect(container.querySelector('.turn-backward')).toBeInTheDocument();act(()=>vi.advanceTimersByTime(680));expect(screen.getByText('Page 1 sur 4')).toBeInTheDocument();vi.useRealTimers()
})
