import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { useAuth } from '../../providers/AuthProvider.jsx';
import { VOICE_ASSISTANT_ACCESS_ROLES } from '../../constants/roles.js';
import { VoiceAgentProvider } from '../../providers/VoiceAgentProvider.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import MobileBottomNav from './MobileBottomNav.jsx';
import ReadSelectionButton from '../accessibility/ReadSelectionButton.jsx';
import SpeechControlsBar from '../accessibility/SpeechControlsBar.jsx';
import VoiceAssistantOrb from '../voice/VoiceAssistantOrb.jsx';

/**
 * FET-02 — the shared authenticated layout every dashboard route
 * renders inside (mounted around the `/dashboard/*` route tree in
 * `App.jsx`). Sidebar + Topbar + a content `<Outlet/>`; individual
 * pages no longer draw their own header/nav chrome — see
 * `DashboardPage.jsx`, `PatientClinicalPage.jsx`,
 * `MyClinicalRecordsPage.jsx` for the FET-07 pages migrated onto it.
 */
export default function AppShell() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Default open on desktop, remember user preference
    const saved = localStorage.getItem('sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleSidebar = () => {
    if (window.innerWidth < 768) {
      setMobileNavOpen((v) => !v);
    } else {
      setSidebarOpen((v) => {
        const next = !v;
        localStorage.setItem('sidebar_open', String(next));
        return next;
      });
    }
  };

  const closeSidebar = () => {
    if (window.innerWidth < 768) {
      setMobileNavOpen(false);
    } else {
      setSidebarOpen(false);
      localStorage.setItem('sidebar_open', 'false');
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar
        role={user?.role}
        sidebarOpen={sidebarOpen}
        mobileOpen={mobileNavOpen}
        onClose={closeSidebar}
      />
      <div className="flex-1 min-w-0 flex flex-col transition-all duration-300">
        <Topbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
        />
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav role={user?.role} />
      <ReadSelectionButton />
      <SpeechControlsBar />
      {VOICE_ASSISTANT_ACCESS_ROLES.includes(user?.role) && (
        <VoiceAgentProvider>
          <VoiceAssistantOrb />
        </VoiceAgentProvider>
      )}
    </div>
  );
}

