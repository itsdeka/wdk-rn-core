import { useMemo } from 'react';
import { useTheme, type Theme } from './useTheme';

/**
 * useThemedStyles
 *
 * Small helper to avoid repeating:
 *   const theme = useTheme();
 *   const styles = createStyles(theme);
 */
export function useThemedStyles<T>(createStyles: (theme: Theme) => T): T {
    const theme = useTheme();

    const styles = useMemo(() => createStyles(theme), [theme]);

    return styles;
}



