import type { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { barrioGuard } from './core/auth/barrio.guard';
import { requiereRol } from './core/auth/rol.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    title: 'Ingresar · MatiApp',
  },
  {
    path: 'barrio',
    canActivate: [authGuard],
    loadComponent: () => import('./features/barrio/barrio').then((m) => m.Barrio),
    title: 'Elegir barrio · MatiApp',
  },
  {
    path: 'buscar',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/buscar/buscar').then((m) => m.Buscar),
    title: 'Buscar · MatiApp',
  },
  {
    path: 'propietarios',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/propietarios/propietarios').then((m) => m.Propietarios),
    title: 'Propietarios · MatiApp',
  },
  {
    path: 'visitas',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/visitas/lista-visitas').then((m) => m.ListaVisitas),
    title: 'Visitas · MatiApp',
  },
  {
    path: 'domesticas',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/domesticas/domesticas').then((m) => m.Domesticas),
    title: 'Domésticas - MatiApp',
  },
  {
    path: 'visita/nueva',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/visita/nueva-visita').then((m) => m.NuevaVisita),
    title: 'Nueva visita · MatiApp',
  },
  {
    path: 'panel',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/panel/panel').then((m) => m.PanelEnVivo),
    title: 'Panel en vivo · MatiApp',
  },
  {
    path: 'captura',
    canActivate: [authGuard, barrioGuard],
    loadComponent: () => import('./features/captura/captura').then((m) => m.Captura),
    title: 'Modo captura · MatiApp',
  },
  {
    path: 'directorio',
    canActivate: [authGuard, barrioGuard, requiereRol('admin', 'supervisor')],
    loadComponent: () => import('./features/directorio/directorio').then((m) => m.Directorio),
    title: 'Directorio · MatiApp',
  },
  {
    path: 'usuarios',
    canActivate: [authGuard, barrioGuard, requiereRol('admin')],
    loadComponent: () => import('./features/usuarios/usuarios').then((m) => m.Usuarios),
    title: 'Usuarios · MatiApp',
  },
  { path: '', pathMatch: 'full', redirectTo: 'buscar' },
  { path: '**', redirectTo: 'buscar' },
];
