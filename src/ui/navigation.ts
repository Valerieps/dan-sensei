// Where each URL belongs in the app's navigation (docs/spec/telas-de-gestao.md, "Navegação").
import type { IconName } from './components/Icon';

export type TabId = 'today' | 'agenda' | 'students';

export interface Tab {
  readonly id: TabId;
  readonly path: string;
  readonly icon: IconName;
}

/** The tabs, in order. Exercícios joins on the iPad in phase 1c (C2). */
export const TABS: readonly Tab[] = [
  { id: 'today', path: '/', icon: 'today' },
  { id: 'agenda', path: '/agenda', icon: 'calendar' },
  { id: 'students', path: '/alunos', icon: 'students' },
];

const AGENDA_VIEW = /^\/agenda(?:\/semana)?(?:\/\d{4}-\d{2}-\d{2})?\/?$/;
const STUDENTS_AREA = /^\/(?:alunos|aulas|pagamentos|mensalidades|pacotes)(?:\/|$)|^\/nota-aluno\/?$/;

/** The tab a URL lives under, or null for the screens outside the tabs (Configurações, Membros, Convites). */
export function tabOf(path: string): TabId | null {
  if (path === '/') return 'today';
  if (path.startsWith('/agenda')) return 'agenda';
  if (STUDENTS_AREA.test(path)) return 'students';
  return null;
}

/** The URLs that are a tab's own screen and open with its large title; forms and details have their own heading. */
export function largeTitleTab(path: string): TabId | null {
  if (path === '/') return 'today';
  if (AGENDA_VIEW.test(path)) return 'agenda';
  if (path === '/alunos' || path === '/alunos/') return 'students';
  return null;
}

export type CreateActionId = 'payment' | 'class' | 'note' | 'student' | 'monthly';

/** The + menu, in the order of the spec. */
export const CREATE_ACTIONS: readonly { readonly id: CreateActionId; readonly path: string }[] = [
  { id: 'payment', path: '/pagamentos/registrar' },
  { id: 'class', path: '/agenda/nova' },
  { id: 'note', path: '/nota-aluno' },
  { id: 'student', path: '/alunos/novo' },
  { id: 'monthly', path: '/mensalidades/registrar' },
];

/** Only the Hoje tab has the Configurações gear in its toolbar. */
export const hasSettingsGear = (path: string): boolean => path === '/';
