// src/ui/App.tsx
import { useState } from 'react';
import { StoreProvider, useDispatch, useGame } from './store';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Board } from './components/Board';
import { TicketModal } from './components/TicketModal';
import { WeeklyReportModal } from './components/WeeklyReportModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import { GameOverScreen } from './components/GameOverScreen';
import { ReleasesScreen } from './screens/ReleasesScreen';
import { TeamScreen } from './screens/TeamScreen';
import { MarketScreen } from './screens/MarketScreen';
import { InboxScreen } from './screens/InboxScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { CelebrationModal } from './components/CelebrationModal';

export type Screen = 'board' | 'releases' | 'team' | 'market' | 'inbox' | 'reports';
const HELP_KEY = 'full-rollout-help-seen';

function Shell() {
  const s = useGame();
  const d = useDispatch();
  const [screen, setScreen] = useState<Screen>('board');
  const [gameFilter, setGameFilter] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showHelp, setShowHelp] = useState(() => !localStorage.getItem(HELP_KEY));

  const disruptions = [
    ...s.games.filter((g) => (g.outageWeeks ?? 0) > 0).map((g) => `🔌 ${g.name} outage (${g.outageWeeks}w)`),
    ...s.team.filter((m) => (m.outWeeks ?? 0) > 0).map((m) => `🌴 ${m.name} out (${m.outWeeks}w)`),
  ];

  return (
    <div className="app">
      <TopBar onEndWeek={() => { d.week(); setShowReport(true); }} />
      {disruptions.length > 0 && (
        <div className="disruption-banner">🚨 {disruptions.join('  ·  ')}</div>
      )}
      <div className="body">
        <Sidebar
          screen={screen} setScreen={setScreen}
          gameFilter={gameFilter} setGameFilter={setGameFilter}
        />
        <main className="content">
          {screen === 'board' && <Board gameFilter={gameFilter} onOpen={setOpenTicket} />}
          {screen === 'releases' && <ReleasesScreen />}
          {screen === 'team' && <TeamScreen />}
          {screen === 'market' && <MarketScreen />}
          {screen === 'inbox' && <InboxScreen />}
          {screen === 'reports' && <ReportsScreen />}
        </main>
      </div>
      {openTicket && <TicketModal ticketKey={openTicket} onClose={() => setOpenTicket(null)} />}
      {showReport && <WeeklyReportModal onClose={() => setShowReport(false)} />}
      {showHelp && (
        <HowToPlayModal
          onClose={() => { localStorage.setItem(HELP_KEY, '1'); setShowHelp(false); }}
        />
      )}
      {s.status === 'bankrupt' && !showReport && <GameOverScreen />}
      {s.celebration && (
        <CelebrationModal
          title={s.celebration.title}
          body={s.celebration.body}
          onClose={() => d.act({ type: 'dismissCelebration' })}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
