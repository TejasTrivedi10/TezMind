import {
  validateDesignSystem,
  compileTokens,
  compileUtilities,
  scanClasses,
  DesignSystem,
} from '../designSystem';
import { autofix } from '../html/autofix';

const validDs: DesignSystem = {
  version: 1,
  mode: 'light',
  name: 'Modern Clean',
  vibe: 'Modern and accessible',
  colors: {
    primary: '#2563eb',
    onPrimary: '#ffffff',
    secondary: '#475569',
    onSecondary: '#ffffff',
    accent: '#f59e0b',
    background: '#ffffff',
    surface: '#f8fafc',
    surfaceAlt: '#f1f5f9',
    border: '#e2e8f0',
    divider: '#f1f5f9',
    text: '#0f172a',
    textMuted: '#64748b',
    textInverse: '#ffffff',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
  },
  typography: {
    fontFamily: {
      heading: 'Inter',
      body: 'Inter',
      mono: 'IBM Plex Mono',
    },
    scale: {
      xs: 11,
      sm: 13,
      base: 15,
      lg: 18,
      xl: 22,
      '2xl': 26,
      '3xl': 32,
      '4xl': 40,
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    base: 4,
    scale: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  },
  radius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
    card: 12,
    button: 8,
    input: 8,
    sheet: 16,
    chip: 9999,
    avatar: 9999,
  },
  elevation: {
    none: 'none',
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px rgba(0,0,0,0.1)',
    lg: '0 10px 15px rgba(0,0,0,0.15)',
  },
  borders: {
    width: 1,
    style: 'solid',
  },
  icons: {
    library: 'material-symbols',
    style: 'outline',
    tintCircle: true,
    strokeWidth: 2,
    size: {
      sm: 16,
      md: 24,
      lg: 32,
    },
  },
  motion: {
    durationFast: '150ms',
    durationBase: '250ms',
    durationSlow: '400ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  density: 'comfortable',
  rules: ['Use rounded-card for elevated card surfaces'],
};

describe('DesignSystem Core Validation & Compilation', () => {
  test('validates a correct DesignSystem', () => {
    const result = validateDesignSystem(validDs);
    expect(result.ok).toBe(true);
  });

  test('fails validation when text/background contrast is too low', () => {
    const badDs = {
      ...validDs,
      colors: {
        ...validDs.colors,
        text: '#d1d5db', // very light gray on white background
      },
    };
    const result = validateDesignSystem(badDs);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('text/background'))).toBe(true);
    }
  });

  test('fails validation when textMuted/background contrast is < 3:1', () => {
    const badDs = {
      ...validDs,
      colors: {
        ...validDs.colors,
        textMuted: '#e2e8f0', // ~1.2:1 contrast on white
      },
    };
    const result = validateDesignSystem(badDs);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('textMuted/background'))).toBe(true);
    }
  });

  test('fails validation when mode is light but background is darker than text', () => {
    const badDs = {
      ...validDs,
      mode: 'light' as const,
      colors: {
        ...validDs.colors,
        background: '#0f172a', // dark bg in light mode
        text: '#ffffff',
      },
    };
    const result = validateDesignSystem(badDs);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('Mode is "light" but background'))).toBe(true);
    }
  });

  test('fails validation for non-allowlisted font', () => {
    const badDs = {
      ...validDs,
      typography: {
        ...validDs.typography,
        fontFamily: {
          ...validDs.typography.fontFamily,
          heading: 'Comic Sans MS',
        },
      },
    };
    const result = validateDesignSystem(badDs);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('Comic Sans MS'))).toBe(true);
    }
  });

  test('compileTokens outputs border and new radius tokens', () => {
    const css = compileTokens(validDs);
    expect(css).toContain('--bw: 1px;');
    expect(css).toContain('--bs: solid;');
    expect(css).toContain('--r-chip: 9999px;');
    expect(css).toContain('--r-avatar: 9999px;');
    expect(css).toContain('--icon-sm: 16px;');
  });

  test('compileUtilities includes rounded-chip, rounded-avatar, icon-wrap and border', () => {
    const css = compileUtilities(validDs);
    expect(css).toContain('.rounded-chip { border-radius:var(--r-chip); }');
    expect(css).toContain('.rounded-avatar { border-radius:var(--r-avatar); }');
    expect(css).toContain('.icon-wrap {');
    expect(css).toContain('.border { border:var(--bw) var(--bs) var(--c-border); }');
  });

  test('tree shaking in compileUtilities with scanClasses', () => {
    const html = '<div class="screen col p-16 rounded-card"><span class="icon-wrap">A</span></div>';
    const classes = scanClasses(html);
    const css = compileUtilities(validDs, classes);

    expect(css).toContain('.rounded-card');
    expect(css).toContain('.icon-wrap');
    expect(css).toContain('.p-16');
    expect(css).not.toContain('.rounded-chip');
  });

  test('autofix snaps off-grid spacing values', () => {
    const input = '<div class="screen"><div style="padding: 15px; margin-top: 7px;">Content</div></div>';
    const output = autofix(input);
    expect(output).toContain('padding: 16px');
  });

  test('autofix snaps raw colors when designSystem is provided', () => {
    const input = '<div class="screen"><div style="color: #2563eb;">Text</div></div>';
    const output = autofix(input, { required: [], designSystem: validDs });
    expect(output).toContain('color: var(--c-primary)');
  });

  test('autofix unwraps empty role-less wrapper divs', () => {
    const input = '<div class="screen"><div><p class="px-4 py-3">Nested</p></div></div>';
    const output = autofix(input);
    // The empty <div> wrapping <p> should be unwrapped
    expect(output).not.toContain('<div><p');
  });
});
