// Обратная совместимость: старый путь `components/Tooltip` → новая реализация в `ui/Tooltip`.
// Новому коду использовать `components/ui` barrel.
export { default } from './ui/Tooltip';
export type { TooltipProps, TooltipRichProps } from './ui/Tooltip';
