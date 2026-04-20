import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface BreadcrumbsProps {
  children: ReactNode;
  className?: string;
}

function Breadcrumbs({ children, className = '' }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Хлебные крошки"
      className={['flex items-center flex-wrap gap-1 text-sm', className].join(' ')}
    >
      {children}
    </nav>
  );
}

function Item({ href, children }: { href: string; children: ReactNode }) {
  return (
    <>
      <Link
        to={href}
        className="text-[#78716C] hover:text-[#1A1A1A] transition-colors rounded-md px-1 -mx-1"
      >
        {children}
      </Link>
      <ChevronRight className="w-3.5 h-3.5 text-[#A8A29E]" aria-hidden />
    </>
  );
}

function Current({ children }: { children: ReactNode }) {
  return (
    <span aria-current="page" className="text-[#1A1A1A] font-semibold">
      {children}
    </span>
  );
}

type BC = typeof Breadcrumbs & {
  Item: typeof Item;
  Current: typeof Current;
};

const BCWithSlots = Breadcrumbs as BC;
BCWithSlots.Item = Item;
BCWithSlots.Current = Current;

export default BCWithSlots;
