import type { HTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'elevated' | 'interactive';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  as?: 'div' | 'section' | 'article';
  children?: ReactNode;
}

const VARIANT_CLS: Record<Variant, string> = {
  default: 'bg-white border border-[#E7E5E4]',
  elevated: 'bg-white border border-[#E7E5E4] shadow-[0_4px_12px_0_rgba(0,0,0,0.06)]',
  interactive:
    'bg-white border border-[#E7E5E4] cursor-pointer ' +
    'hover:border-[#A5B4FC] hover:shadow-[0_4px_12px_0_rgba(79,70,229,0.08)] ' +
    'transition-[border-color,box-shadow] duration-200',
};

function Card({ variant = 'default', as: Tag = 'div', className = '', children, ...rest }: CardProps) {
  return (
    <Tag
      className={['rounded-[20px] min-w-0', VARIANT_CLS[variant], className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function CardHeader({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['px-6 pt-5 pb-0 flex items-center justify-between gap-3', className].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardTitle({ className = '', children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={[
        'text-base font-semibold text-[#1A1A1A] leading-tight m-0 min-w-0',
        'whitespace-nowrap overflow-hidden text-ellipsis',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </h3>
  );
}

function CardDescription({ className = '', children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={['text-[13px] text-[#78716C] mt-1', className].join(' ')} {...rest}>
      {children}
    </p>
  );
}

function CardBody({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['px-6 py-5', className].join(' ')} {...rest}>
      {children}
    </div>
  );
}

function CardFooter({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['px-6 py-4 border-t border-[#E7E5E4] flex items-center gap-3', className].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

// Compound export: <Card.Header />, <Card.Body />, etc.
type CardCompound = typeof Card & {
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Description: typeof CardDescription;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
};

const CardWithSlots = Card as CardCompound;
CardWithSlots.Header = CardHeader;
CardWithSlots.Title = CardTitle;
CardWithSlots.Description = CardDescription;
CardWithSlots.Body = CardBody;
CardWithSlots.Footer = CardFooter;

export default CardWithSlots;
