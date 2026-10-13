import type { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { requiereRol } from './core/auth/rol.guard';

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
    path: 'panel',
    canActivate: [authGuard],
    loadComponent: () => import('./features/panel/panel').then((m) => m.PanelEnVivo),
    title: 'Panel en vivo · Victorias',
  },
  {
    path: 'captura',
    canActivate: [authGuard],
    loadComponent: () => import('./features/captura/captura').then((m) => m.Captura),
    title: 'Modo captura · Victorias',
  },
  {
    path: 'directorio',
    canActivate: [authGuard, requiereRol('admin', 'supervisor')],
    loadComponent: () => import('./features/directorio/directorio').then((m) => m.Directorio),
    title: 'Directorio · Victorias',
  },
  {
    path: 'usuarios',
    canActivate: [authGuard, requiereRol('admin')],
    loadComponent: () => import('./features/usuarios/usuarios').then((m) => m.Usuarios),
    title: 'Usuarios · Victorias',
  },
  { path: '', pathMatch: 'full', redirectTo: 'visitas' },
  { path: '**', redirectTo: 'visitas' },
];
