# Offworld Styling Guidelines

## Responsive Breakpoints

We use Tailwind's default breakpoints with a consistent max-width pattern across all routes.

### Default Tailwind Breakpoints
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

### Standard Max-Width Pattern

For most pages and components, use this responsive max-width pattern:

```tsx
className="container mx-auto max-w-7xl px-4 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
```

**Breakdown:**
- **Default/sm/md**: `max-w-7xl` with `px-4` padding (effectively full-width on smaller screens)
- **lg (1024px)**: `max-w-5xl` (1024px container)
- **xl (1280px)**: `max-w-6xl` (1152px container)
- **2xl (1536px+)**: `max-w-7xl` (1280px container)

### Where This Pattern Is Applied

✅ **Landing page components:**
- Header (`apps/web/src/components/layout/header.tsx`)
- Footer (`apps/web/src/components/layout/footer.tsx`)
- Info/How It Works section (`apps/web/src/routes/index.tsx`)

✅ **Route pages:**
- `/explore` (`apps/web/src/routes/explore.tsx`)
- `/$owner` (`apps/web/src/routes/_github/$owner.tsx`)

### Special Cases

#### Recently Indexed Carousel
The carousel component uses a slightly different pattern to accommodate arrow positioning:

```tsx
// Container
className="container mx-auto max-w-7xl px-4 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"

// Carousel wrapper (to prevent arrow overlap on mobile)
className="mx-auto max-w-[calc(100%-5rem)] md:max-w-full"
```

**Carousel item breakpoints:**
- **sm**: 1 column (default)
- **md**: 2 columns (`md:basis-1/2`)
- **lg**: 2 columns (`lg:basis-1/2`)
- **xl**: 3 columns (`xl:basis-1/3`)

#### Repository Detail Pages
Repository detail pages now use the standard max-width pattern for a cleaner two-column layout:

```tsx
className="container mx-auto max-w-7xl px-4 py-6 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
```

This provides better spacing for the two-column layout (navigation sidebar + content).

## Layout Patterns

### Full-Height Pages with Footer
For pages with footers that should stick to the bottom:

```tsx
<div className="relative flex min-h-screen flex-col">
  <div className="container mx-auto max-w-7xl flex-1 px-4 py-24 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
    {/* Page content */}
  </div>
  <Footer />
</div>
```

The `flex min-h-screen flex-col` on the outer div with `flex-1` on the content ensures the footer stays at the bottom.

## Form Elements

### Responsive Input Sizing
Inputs and buttons should be smaller on mobile for better UX:

```tsx
// Input
className="px-4 py-3 text-base sm:px-6 sm:py-4 sm:text-xl"

// Button
className="px-6 py-3 text-base sm:px-10 sm:py-4 sm:text-lg"
```

## General Principles

1. **Mobile-first**: Start with mobile styles, add breakpoint prefixes for larger screens
2. **Consistent spacing**: Use `px-4` for horizontal padding on containers
3. **Gradual scaling**: Content should grow gradually, not dramatically, across breakpoints
4. **Test at breakpoint edges**: Always test at 1024px (lg), 1280px (xl), and 1536px (2xl)
5. **Avoid fixed widths**: Use max-widths and let content flow naturally below breakpoints
