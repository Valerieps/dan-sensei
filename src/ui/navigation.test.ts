import { describe, expect, it } from 'vitest';
import { CREATE_ACTIONS, TABS, hasSettingsGear, largeTitleTab, tabOf } from './navigation';

describe('tabOf', () => {
  it.each([
    ['/', 'today'],
    ['/teste-ipad', 'test'],
    ['/teste-ipad/', 'test'],
    ['/agenda', 'agenda'],
    ['/agenda/semana/2026-11-16', 'agenda'],
    ['/agenda/nova/2026-11-16/09:00', 'agenda'],
    ['/alunos', 'students'],
    ['/alunos/abc/pacotes', 'students'],
    ['/aulas/registrar', 'students'],
    ['/pagamentos/registrar', 'students'],
    ['/mensalidades/registrar/abc', 'students'],
    ['/pacotes/abc/pausar', 'students'],
    ['/nota-aluno', 'students'],
    ['/exercicios', 'exercises'],
    ['/exercicios/abc', 'exercises'],
    ['/exercicios/novo', 'exercises'],
  ])('%s is under %s', (path, tab) => expect(tabOf(path)).toBe(tab));

  it.each(['/configuracoes', '/membros', '/convites', '/qualquer-coisa'])('%s is under no tab', (path) => expect(tabOf(path)).toBeNull());
});

describe('largeTitleTab', () => {
  it.each([
    ['/', 'today'],
    ['/agenda', 'agenda'],
    ['/agenda/2026-11-16', 'agenda'],
    ['/agenda/semana', 'agenda'],
    ['/agenda/semana/2026-11-16', 'agenda'],
    ['/alunos', 'students'],
    ['/exercicios', 'exercises'],
  ])('%s opens with the large title of %s', (path, tab) => expect(largeTitleTab(path)).toBe(tab));

  it.each(['/agenda/nova', '/agenda/nova/2026-11-16', '/alunos/novo', '/alunos/abc', '/pagamentos/registrar', '/configuracoes'])(
    '%s keeps its own heading',
    (path) => expect(largeTitleTab(path)).toBeNull(),
  );
});

describe('the toolbar', () => {
  it('has the tabs of the spec, in order (Teste first, the temporary iPad test), with Exercícios only on the iPad', () => {
    expect(TABS.map((t) => t.id)).toEqual(['test', 'today', 'agenda', 'students', 'exercises']);
    expect(TABS.filter((t) => t.padOnly).map((t) => t.id)).toEqual(['exercises']);
  });

  it('shows Teste on the iPad and on the phone', () => {
    expect(TABS[0]).toMatchObject({ id: 'test', path: '/teste-ipad' });
    expect(TABS[0]!.padOnly).toBeUndefined();
  });

  it('lists the + menu in the order of the spec', () =>
    expect(CREATE_ACTIONS.map((a) => a.id)).toEqual(['payment', 'class', 'note', 'student', 'monthly']));

  it('shows the Configurações gear only in Hoje', () => {
    expect(hasSettingsGear('/')).toBe(true);
    expect(hasSettingsGear('/agenda')).toBe(false);
    expect(hasSettingsGear('/alunos')).toBe(false);
  });
});
