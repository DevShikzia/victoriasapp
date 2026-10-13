import type { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    title: 'Ingresar · Victorias',
  },
  {
    path: 'visitas',
    canActivate: [authGuard],
    loadComponent: () => import('./features/visitas/lista-visitas').then((m) => m.ListaVisitas),
    title: 'Visitas · Victorias',
  },
  {
    path: 'visita/nueva',
    canActivate: [authGuard],
    loadComponent: () => import('./features/visita/nueva-visita').then((m) => m.NuevaVisita),
    title: 'Nueva visita · Victorias',
  },
  {
    path: 'captura',
    canActivate: [authGuard],
    loadComponent: () => import('./features/captura/captura').then((m) => m.Captura),
    title: 'Modo captura · Victorias',
  },
  { path: '', pathMatch: 'full', redirectTo: 'visitas' },
  { path: '**', redirectTo: 'visitas' },
];
