import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LiveStatus } from '../application/ports';
import { strings } from '../domain/strings';
import { useLiveStatus } from './backend-context';
import { IconButton } from './components/Button';
import { Field } from './components/Field';
import { GroupedList, ListRow } from './components/GroupedList';
import { Icon } from './components/Icon';
import { Sheet } from './components/Sheet';
import { CREATE_ACTIONS, TABS, hasSettingsGear, largeTitleTab, tabOf, type CreateActionId, type TabId } from './navigation';
import { Link, navigate, usePath } from './router';
import { useQuery } from './use-query';

const SIDEBAR_KEY = 'dan-sensei.sidebar';

function readSidebar(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

function saveSidebar(open: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, open ? '1' : '0');
  } catch {
    // Private window or blocked storage: the choice just lasts until the page closes.
  }
}

const TAB_LABEL: Record<TabId, string> = {
  today: strings.nav.home,
  agenda: strings.nav.agenda,
  students: strings.nav.students,
};

const CREATE_LABEL: Record<CreateActionId, string> = {
  payment: strings.nav.addPayment,
  class: strings.nav.addClass,
  note: strings.nav.addNote,
  student: strings.nav.addStudent,
  monthly: strings.nav.addMonthlyPayment,
};

/**
 * The app's frame (docs/spec/telas-de-gestao.md, "Navegação"). On the iPad, a glass tab bar at the
 * top that a button turns into a sidebar; on the phone, a floating glass tab bar at the bottom.
 * The toolbar (+, search and, in Hoje, the gear) and the large title belong to every tab.
 */
export function Shell({ children }: { children: ReactNode }) {
  const path = usePath();
  const [sidebar, setSidebar] = useState(readSidebar);
  const [searching, setSearching] = useState(false);
  const [titleHidden, setTitleHidden] = useState(false);
  const titleTab = largeTitleTab(path);
  const onTitleVisible = useCallback((visible: boolean) => setTitleHidden(!visible), []);

  useEffect(() => {
    setSearching(false);
  }, [path]);

  function toggleSidebar() {
    saveSidebar(!sidebar);
    setSidebar(!sidebar);
  }

  return (
    <div className={sidebar ? 'shell with-sidebar' : 'shell'}>
      <Sidebar />
      <div className="shell-main">
        <header className="top-bar">
          <IconButton
            className="sidebar-toggle"
            icon="sidebar"
            label={sidebar ? strings.nav.hideSidebar : strings.nav.showSidebar}
            aria-expanded={sidebar}
            onClick={toggleSidebar}
          />
          <TabBar placement="top" />
          {titleTab && titleHidden && <span className="compact-title">{TAB_LABEL[titleTab]}</span>}
          <Toolbar onSearch={() => setSearching(true)} />
        </header>
        <main className="content">
          {titleTab && <LargeTitle key={titleTab} title={TAB_LABEL[titleTab]} onVisible={onTitleVisible} />}
          {children}
        </main>
      </div>
      <TabBar placement="bottom" />
      {searching && <SearchSheet onClose={() => setSearching(false)} />}
    </div>
  );
}

/** The title of a tab, large; once it scrolls away the toolbar shows it small. */
function LargeTitle({ title, onVisible }: { title: string; onVisible: (visible: boolean) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = heading.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => onVisible(entry.isIntersecting));
    observer.observe(element);
    return () => {
      observer.disconnect();
      onVisible(true);
    };
  }, [onVisible]);
  return (
    <h1 ref={heading} className="large-title">
      {title}
    </h1>
  );
}

function TabBar({ placement }: { placement: 'top' | 'bottom' }) {
  const current = tabOf(usePath());
  return (
    <nav className={`tab-bar glass ${placement}`} aria-label={strings.nav.main}>
      {TABS.map((tab) => (
        <Link key={tab.id} to={tab.path} aria-current={tab.id === current ? 'page' : undefined}>
          <Icon name={tab.icon} filled={tab.id === current} />
          <span>{TAB_LABEL[tab.id]}</span>
        </Link>
      ))}
    </nav>
  );
}

/** The sidebar the tab bar turns into: the tabs, Configurações and the state of the sync. */
function Sidebar() {
  const path = usePath();
  const current = tabOf(path);
  return (
    <aside className="sidebar" aria-label={strings.nav.main}>
      <nav className="sidebar-nav" aria-label={strings.nav.tabs}>
        {TABS.map((tab) => (
          <Link key={tab.id} to={tab.path} aria-current={tab.id === current ? 'page' : undefined}>
            <Icon name={tab.icon} filled={tab.id === current} />
            {TAB_LABEL[tab.id]}
          </Link>
        ))}
        <Link to="/configuracoes" aria-current={path === '/configuracoes' ? 'page' : undefined}>
          <Icon name="settings" />
          {strings.nav.settings}
        </Link>
      </nav>
      <SyncState />
    </aside>
  );
}

const SYNC_TEXT: Record<LiveStatus, string> = {
  online: strings.nav.sync.online,
  connecting: strings.nav.sync.connecting,
  offline: strings.nav.sync.offline,
};

function SyncState() {
  const status = useLiveStatus();
  return (
    <p className="sync-state" data-status={status} role="status">
      <span className="sync-dot" aria-hidden="true" />
      {SYNC_TEXT[status]}
    </p>
  );
}

function Toolbar({ onSearch }: { onSearch: () => void }) {
  const path = usePath();
  return (
    <div className="toolbar">
      <IconButton icon="search" label={strings.nav.search} onClick={onSearch} />
      {hasSettingsGear(path) && (
        <Link className="icon-button glass" to="/configuracoes" aria-label={strings.nav.settings}>
          <Icon name="settings" />
        </Link>
      )}
      <CreateMenu />
    </div>
  );
}

/** The + menu: creating things lives in the toolbar, never in the tab bar. */
function CreateMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const path = usePath();

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="create-menu">
      <IconButton icon="plus" label={strings.nav.add} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)} />
      {open && (
        <div className="create-menu-items" role="menu">
          <GroupedList label={strings.nav.add}>
            {CREATE_ACTIONS.map((action) => (
              <ListRow
                key={action.id}
                title={CREATE_LABEL[action.id]}
                chevron={false}
                onClick={() => {
                  setOpen(false);
                  navigate(action.path);
                }}
              />
            ))}
          </GroupedList>
        </div>
      )}
    </div>
  );
}

/** Search by student name, in a panel; a result opens the student's profile. */
function SearchSheet({ onClose }: { onClose: () => void }) {
  const students = useQuery('students', {}, ['students']);
  const [text, setText] = useState('');
  const needle = text.trim().toLocaleLowerCase('pt-BR');
  const found = (students.data ?? []).filter((s) => needle !== '' && s.name.toLocaleLowerCase('pt-BR').includes(needle));
  return (
    <Sheet title={strings.nav.searchTitle} onClose={onClose}>
      <div className="stack">
        <Field label={strings.nav.searchLabel} type="search" value={text} onChange={(event) => setText(event.target.value)} />
        {needle !== '' && found.length === 0 && <p className="muted">{strings.nav.searchEmpty}</p>}
        {found.length > 0 && (
          <GroupedList>
            {found.map((student) => (
              <ListRow
                key={student.id}
                title={student.name}
                onClick={() => {
                  onClose();
                  navigate(`/alunos/${student.id}`);
                }}
              />
            ))}
          </GroupedList>
        )}
      </div>
    </Sheet>
  );
}
