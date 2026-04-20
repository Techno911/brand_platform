import { createContext, useContext, useId } from 'react';
import type { ReactNode } from 'react';

interface TabsCtx {
  value: string;
  onValueChange: (v: string) => void;
  idBase: string;
}

const Ctx = createContext<TabsCtx | null>(null);

function useTabs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('Tabs.* must be used inside <Tabs>');
  return ctx;
}

export interface TabsProps {
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}

function Tabs({ value, onValueChange, children, className = '' }: TabsProps) {
  const idBase = useId();
  return (
    <Ctx.Provider value={{ value, onValueChange, idBase }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

function TabList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={[
        'flex items-center gap-1 border-b border-[#E7E5E4]',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function Tab({
  value,
  children,
  disabled = false,
}: {
  value: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const { value: selected, onValueChange, idBase } = useTabs();
  const active = selected === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${idBase}-tab-${value}`}
      aria-controls={`${idBase}-panel-${value}`}
      aria-selected={active}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={[
        'relative px-4 h-10 inline-flex items-center gap-2',
        'text-sm font-medium transition-colors duration-200',
        '-mb-px border-b-2',
        active
          ? 'text-[#1A1A1A] border-[#4F46E5]'
          : 'text-[#78716C] border-transparent hover:text-[#1A1A1A] hover:border-[#D6D3D1]',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

function TabPanel({
  value,
  children,
  className = '',
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: selected, idBase } = useTabs();
  if (selected !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      className={className}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

type TabsCompound = typeof Tabs & {
  List: typeof TabList;
  Tab: typeof Tab;
  Panel: typeof TabPanel;
};

const TabsWithSlots = Tabs as TabsCompound;
TabsWithSlots.List = TabList;
TabsWithSlots.Tab = Tab;
TabsWithSlots.Panel = TabPanel;

export default TabsWithSlots;
