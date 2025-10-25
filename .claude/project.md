# Neobank Project Guidelines

## Styling Requirements

**IMPORTANT: All styling MUST be done exclusively with Tailwind CSS.**

### What IS Allowed ✅

- **Tailwind CSS utility classes** for all styling
- **Shadcn components** (built with Tailwind)
- **Aceternity components** (built with Tailwind + Framer Motion)
- **Framer Motion** for animations (motion components, animation props, variants, transitions)
- **Framer Motion's `style` prop** when needed for dynamic animations
- **Dynamic inline styles** when absolutely necessary for animations or computed values

### What is NOT Allowed ❌

- CSS-in-JS libraries (styled-components, emotion, etc.)
- Custom CSS files or stylesheets
- Inline styles for static styling (use Tailwind classes instead)
- Any styling approach that doesn't use Tailwind as the foundation

### Examples of Correct Styling:

```tsx
// ✅ Good - Pure Tailwind
<input className="rounded-lg border border-zinc-200 bg-white px-3 py-2" />

// ✅ Good - Tailwind with conditional classes
<button className={cn("px-4 py-2", isActive && "bg-blue-500")} />

// ✅ Good - Framer Motion with Tailwind
<motion.div
  className="rounded-lg bg-white p-4"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
/>

// ✅ Good - Framer Motion with dynamic style prop for animations
<motion.div
  className="rounded-lg p-4"
  style={{ x: scrollProgress }}
/>

// ✅ Good - Shadcn/Aceternity components
<Button variant="outline" className="w-full">Click me</Button>
```

### Examples to Avoid:

```tsx
// ❌ Bad - CSS-in-JS
const StyledDiv = styled.div`background: blue;`

// ❌ Bad - Custom CSS file
import './custom-styles.css'

// ❌ Bad - Inline styles for static styling
<div style={{ padding: '16px', borderRadius: '8px' }} />
```

## Summary

Use Tailwind CSS utility classes as the foundation for all styling. Enhance with Framer Motion for animations, and use Shadcn/Aceternity components which are already built with Tailwind. The goal is to maintain a consistent, utility-first approach while allowing modern animation and component libraries.
