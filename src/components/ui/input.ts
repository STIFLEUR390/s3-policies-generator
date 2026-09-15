---
interface Props {
  class?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  id?: string;
}

const { class: className, type = 'text', value, placeholder, id } = Astro.props;
---

<input
  id={id}
  type={type}
  value={value}
  placeholder={placeholder}
  class:list={[
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    className,
  ]}
/>
