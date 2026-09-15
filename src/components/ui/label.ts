---
interface Props {
  for?: string;
  class?: string;
}

const { for: htmlFor, class: className } = Astro.props;
---

<label
  for={htmlFor}
  class:list={[
    'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    className,
  ]}
>
  <slot />
</label>
