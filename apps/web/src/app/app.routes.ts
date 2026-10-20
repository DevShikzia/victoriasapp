import type { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { barrioGuard } from './core/auth/barrio.guard';
import { requiereRol } from './core/auth/rol.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    title: 'Ingresar · Victorias',
  },
  {
    path: 'barrio',
    canActivate: [authGuard],
    loadComponent: () => import('./features/barrio/barrio').then((m) => m.Barrio),
    title: 'Elegir barrio · Victorias',
  },
  {
    path: 'buscar',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/buscar/buscar').then((m) => m.Buscar),
    title: 'Buscar · Victorias',
  },
  {
    path: 'propietarios',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/propietarios/propietarios').then((m) => m.Propietarios),
    title: 'Propietarios · Victorias',
  },
  {
    path: 'visitas',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/visitas/lista-visitas').then((m) => m.ListaVisitas),
    title: 'Visitas · Victorias',
  },
  {
    path: 'visita/nueva',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/visita/nueva-visita').then((m) => m.NuevaVisita),
    title: 'Nueva visita · Victorias',
  },
  {
    path: 'panel',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/panel/panel').then((m) => m.PanelEnVivo),
    title: 'Panel en vivo · Victorias',
  },
  {
    path: 'captura',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/captura/captura').then((m) => m.Captura),
    title: 'Modo captura · Victorias',
  },
  {
    path: 'directorio',
    canActivate: [authGuard, barrioGuard, requiereRol('admin', 'supervisor')],
    loadComponent: () => import('./features/directorio/directorio').then((m) => m.Directorio),
    title: 'Directorio · Victorias',
  },
  {
    path: 'usuarios',
    canActivate: [authGuard, barrioGuard, requiereRol('admin')],
    loadComponent: () => import('./features/usuarios/usuarios').then((m) => m.Usuarios),
    title: 'Usuarios · Victorias',
  },
  { path: '', pathMatch: 'full', redirectTo: 'buscar' },
  { path: '**', redirectTo: 'buscar' },
];
