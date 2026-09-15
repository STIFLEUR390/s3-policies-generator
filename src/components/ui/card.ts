import { cn } from '@/lib/utils';

function cardClassName(className?: string) {
  return cn('rounded-xl border bg-card text-card-foreground shadow', className);
}

function cardHeaderClassName(className?: string) {
  return cn('flex flex-col space-y-1.5 p-6', className);
}

function cardTitleClassName(className?: string) {
  return cn('font-semibold leading-none tracking-tight', className);
}

function cardDescriptionClassName(className?: string) {
  return cn('text-sm text-muted-foreground', className);
}

function cardContentClassName(className?: string) {
  return cn('p-6 pt-0', className);
}

function cardFooterClassName(className?: string) {
  return cn('flex items-center p-6 pt-0', className);
}

export { cardClassName, cardHeaderClassName, cardTitleClassName, cardDescriptionClassName, cardContentClassName, cardFooterClassName };
