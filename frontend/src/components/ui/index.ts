// Barrel export для ui primitives
// Использование: import { Button, Card, Input } from '@/components/ui';
//     или (relative): import { Button, Card, Input } from '../components/ui';

export { default as Button } from './Button';
export type { ButtonProps } from './Button';

export { default as Card } from './Card';
export type { CardProps } from './Card';

export { default as Input, Textarea, FieldGroup } from './Input';
export type { InputProps, TextareaProps } from './Input';

export { default as Badge } from './Badge';
export type { BadgeProps } from './Badge';

export { default as ProjectStatusBadge } from './ProjectStatusBadge';
export type { ProjectStatusBadgeProps } from './ProjectStatusBadge';

export { default as DeadlineBadge } from './DeadlineBadge';
export type { DeadlineBadgeProps } from './DeadlineBadge';

export { default as Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';

export { default as EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { default as Stepper } from './Stepper';
export type { StepperItem, StepStatus, StepperProps } from './Stepper';

export { default as Tabs } from './Tabs';
export type { TabsProps } from './Tabs';

export { default as Modal } from './Modal';
export type { ModalProps } from './Modal';

export { default as Breadcrumbs } from './Breadcrumbs';
export type { BreadcrumbsProps } from './Breadcrumbs';

export { default as DiffBlock } from './DiffBlock';
export type { DiffBlockProps } from './DiffBlock';

export { default as SuggestionMark } from './SuggestionMark';
export type { SuggestionMarkProps } from './SuggestionMark';

export { default as Tooltip } from './Tooltip';
export type { TooltipProps, TooltipRichProps } from './Tooltip';

export { default as Dropdown } from './Dropdown';
export type { DropdownProps, DropdownItem } from './Dropdown';

export { default as ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';
