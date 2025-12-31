import { useColorScheme } from 'react-native';
import { darkThemeColors, lightThemeColors } from '../app/theme/colors';

type ThemeMode = 'light' | 'dark';

// Design system color tokens – shared across components
export type ThemeColorToken = keyof typeof lightThemeColors | keyof typeof darkThemeColors;

export type SemanticColorToken =
    | 'semantic-success'
    | 'semantic-text-on-success'
    | 'semantic-error'
    | 'semantic-text-on-error'
    | 'semantic-info'
    | 'semantic-text-on-info'
    | 'semantic-warning'
    | 'semantic-text-on-warning';

export type ThemeColors = Record<ThemeColorToken, string>;
export type SemanticColors = Record<SemanticColorToken, string>;

export interface Theme {
    mode: ThemeMode;
    isDark: boolean;
    colors: ThemeColors;
    semanticColors: SemanticColors;
}

const darkColors: ThemeColors = darkThemeColors;
// Semantic colors
const semanticColors: SemanticColors = {
    'semantic-success': '#27ae60',
    'semantic-text-on-success': '#000000',
    'semantic-error': '#e34b44',
    'semantic-text-on-error': '#000000',
    'semantic-info': '#2980b9',
    'semantic-text-on-info': '#000000',
    'semantic-warning': '#f39c12',
    'semantic-text-on-warning': '#000000',
};

const lightColors: ThemeColors = lightThemeColors;

export function useTheme(): Theme {
    const colorScheme = useColorScheme();

    // Legacy behaviour: default to dark if scheme is null
    const isDark = colorScheme === 'dark' || colorScheme === null;
    const mode: ThemeMode = isDark ? 'dark' : 'light';

    return {
        mode,
        isDark,
        colors: isDark ? darkColors : lightColors,
        semanticColors,
    };
}



