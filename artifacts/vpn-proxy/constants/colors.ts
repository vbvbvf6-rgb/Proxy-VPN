/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const palette = {
  text: '#eff5fc',
  tint: '#21bde8',
  background: '#071423',
  foreground: '#eff5fc',
  card: '#0d1f32',
  cardForeground: '#eff5fc',
  primary: '#21bde8',
  primaryForeground: '#061522',
  secondary: '#12283d',
  secondaryForeground: '#d9e6f2',
  muted: '#12283d',
  mutedForeground: '#8ca0b4',
  accent: '#12364c',
  accentForeground: '#8ce8ff',
  destructive: '#ff7581',
  destructiveForeground: '#ffffff',
  border: '#19334c',
  input: '#254058',
};

const colors = {
  light: palette,
  dark: palette,
  radius: 18,
};

export default colors;
