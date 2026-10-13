import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'visitas',
    loadComponent: () => import('./features/visitas/lista-visitas').then((m) => m.ListaVisitas),
    title: 'Visitas · Victorias',
  },
  {
    path: 'visita/nueva',
    loadComponent: () => import('./features/visita/nueva-visita').then((m) => m.NuevaVisita),
    title: 'Nueva visita · Victorias',
  },
  {
    path: 'captura',
    loadComponent: () => import('./features/captura/captura').then((m) => m.Captura),
    title: 'Modo captura · Victorias',
  },
  { path: '', pathMatch: 'full', redirectTo: 'visitas' },
  { path: '**', redirectTo: 'visitas' },
];
