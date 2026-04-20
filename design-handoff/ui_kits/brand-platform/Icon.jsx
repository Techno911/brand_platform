(() => {
const Icon = ({ name, className = 'w-4 h-4', style }) => {
  // Lucide-style icons (1.5 stroke). Subset matching the product.
  const paths = {
    FolderKanban: <><path d="M20 20h-16a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h4l2 2h8a2 2 0 0 1 2 2"/><path d="M8 10v8"/><path d="M12 10v5"/><path d="M16 10v10"/><path d="M2 14h20"/></>,
    Clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    Sparkles: <><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="M5.6 5.6l2.8 2.8"/><path d="M15.6 15.6l2.8 2.8"/><path d="M5.6 18.4l2.8-2.8"/><path d="M15.6 8.4l2.8-2.8"/></>,
    ArrowRight: <><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></>,
    ArrowLeft: <><path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/></>,
    ChevronLeft: <path d="M15 6l-6 6 6 6"/>,
    ChevronRight: <path d="M9 6l6 6-6 6"/>,
    Wallet: <><path d="M20 8V6a2 2 0 0 0 -2 -2H4a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2 -2v-2"/><path d="M22 14h-4a2 2 0 0 1 0 -4h4"/></>,
    CheckCircle2: <><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5 -5"/></>,
    PlayCircle: <><circle cx="12" cy="12" r="9"/><path d="M10 9v6l5 -3z" fill="currentColor" stroke="none"/></>,
    Users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v1"/><path d="M16 3.5a3 3 0 0 1 0 5.5"/><path d="M22 20v-1a4 4 0 0 0 -3 -3.85"/></>,
    Lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
    Bell: <><path d="M6 11a6 6 0 0 1 12 0v5l2 2H4l2 -2z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
    Search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3 -4.3"/></>,
    Plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    LogOut: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-4"/><path d="M10 17l-5 -5 5 -5"/><path d="M15 12H5"/></>,
    MessageSquare: <path d="M21 15a2 2 0 0 1 -2 2H8l-5 4V5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2z"/>,
    Edit3: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1 -4z"/></>,
    Send: <><path d="M22 2L11 13"/><path d="M22 2l-7 20 -4 -9 -9 -4z"/></>,
    ShieldCheck: <><path d="M12 22s8 -4 8 -10V5l-8 -3 -8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4 -4"/></>,
    FileText: <><path d="M14 2H6a2 2 0 0 0 -2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></>,
    AlertCircle: <><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></>,
    AlertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71 -3L13.71 3.86a2 2 0 0 0 -3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    BarChart3: <><path d="M3 3v18h18"/><path d="M7 16v-6"/><path d="M11 16v-10"/><path d="M15 16v-4"/><path d="M19 16v-8"/></>,
    TrendingDown: <><path d="M22 17l-8.5 -8.5 -5 5 -6.5 -6.5"/><path d="M16 17h6v-6"/></>,
    Target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    Shield: <path d="M12 22s8 -4 8 -10V5l-8 -3 -8 3v7c0 6 8 10 8 10z"/>,
    RotateCcw: <><path d="M3 12a9 9 0 1 0 9 -9 9.75 9.75 0 0 0 -6.74 2.74L3 8"/><path d="M3 3v5h5"/></>,
    Menu: <><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></>,
    Filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>,
    X: <><path d="M18 6L6 18"/><path d="M6 6l12 12"/></>,
    Dot: <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
};

window.Icon = Icon;
})();
