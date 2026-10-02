# Code Generation Mapping — TezDSL → Flutter + React Native

## Overview

The code generators (`packages/codegen-flutter` and `packages/codegen-rn`) are:
- **Deterministic**: same input → byte-identical output
- **Pure functions**: `generate(screens, tokens, options) => { files, report }`
- **AI-free**: no AI is used to write code; AI only designs the tree
- **Lint-clean**: output passes `flutter analyze` and `tsc + ESLint`

## Auto Layout Mapping

| TezDSL | React Native | Flutter |
|---|---|---|
| `frame direction=row` | `View` + `flexDirection: 'row'` | `Row` |
| `frame direction=column` | `View` + `flexDirection: 'column'` | `Column` |
| `layout.gap` | `gap: N` (RN 0.71+) | `spacing: N` (Flutter 3.27+) or `SizedBox` |
| `layout.padding` | `padding*` style props | `Padding(EdgeInsets.only(...))` |
| `layout.mainAxis: start` | `justifyContent: 'flex-start'` | `MainAxisAlignment.start` |
| `layout.mainAxis: center` | `justifyContent: 'center'` | `MainAxisAlignment.center` |
| `layout.mainAxis: spaceBetween` | `justifyContent: 'space-between'` | `MainAxisAlignment.spaceBetween` |
| `layout.crossAxis: center` | `alignItems: 'center'` | `CrossAxisAlignment.center` |
| `layout.crossAxis: stretch` | `alignItems: 'stretch'` | `CrossAxisAlignment.stretch` |
| `sizing: {mode: fill}` | `flex: 1` / `alignSelf: 'stretch'` | `Expanded(child: ...)` |
| `sizing: {mode: hug}` | (no explicit size) | (shrink-wrap default) |
| `sizing: {mode: fixed, value: N}` | `width: N` / `height: N` | `SizedBox(width: N, height: N)` |
| `sizing: {mode: percent, value: P}` | `width: '${P}%'` | `FractionallySizedBox(widthFactor: P/100)` |
| `constraints.minWidth` | `minWidth: N` | `ConstrainedBox(constraints: BoxConstraints(minWidth: N))` |
| `layout.wrap: true` | `flexWrap: 'wrap'` | `Wrap(children: [...])` |
| `layout.scroll: vertical` | `ScrollView` or `FlatList` | `SingleChildScrollView` or `ListView` |
| `layout.scroll: horizontal` | `ScrollView horizontal` | `SingleChildScrollView(scrollDirection: Axis.horizontal)` |
| `overlay` + anchored child | `View position:absolute` + edge insets | `Stack` + `Positioned` |
| `text` node | `Text` component | `Text` widget |
| `button` node | `Pressable` | `FilledButton` / `TextButton` / `OutlinedButton` |
| `input` node | `TextInput` | `TextField` |
| `image` node | `Image` | `Image` widget |
| `icon` node | Lucide icon component | `Icon` widget (via icon font) |
| `list` node | `FlatList` | `ListView.builder` |
| `header` node | `View` (styled as app bar) | `AppBar` |
| `footer` node | `View` (styled as tab bar) | `BottomNavigationBar` |
| `style.borderRadius` | `borderRadius` | `BoxDecoration(borderRadius: ...)` |
| `style.shadow` | `shadow*` props (iOS) / `elevation` (Android) | `BoxDecoration(boxShadow: [...])` |
| `style.backgroundColor` | `backgroundColor` | `color` in `BoxDecoration` |
| `breakpoints` | `useWindowDimensions` helper | `LayoutBuilder` / `MediaQuery` |

## Flutter Output Structure

```
lib/
  main.dart
  theme/
    app_theme.dart      # ThemeData generated from design tokens
    token_extensions.dart
  screens/
    ScreenName.dart     # StatelessWidget per screen
  widgets/
    ComponentName.dart  # Extracted reusable widgets
```

## React Native Output Structure

```
src/
  theme.ts              # theme object generated from design tokens
  screens/
    ScreenName.tsx      # function component + StyleSheet.create
  components/
    ComponentName.tsx   # extracted reusable components
```

## Implementation Status

| Feature | Phase |
|---|---|
| Frame → Row/Column | Phase 5 |
| Sizing modes | Phase 5 |
| Text, Button, Input, Image, Icon | Phase 5 |
| Design tokens → ThemeData / theme.ts | Phase 5 |
| Overlay → Stack/Positioned | Phase 5 |
| List → FlatList / ListView.builder | Phase 5 |
| Component extraction | Phase 5 |
| Breakpoints → LayoutBuilder / useWindowDimensions | Phase 5 |
| Snapshot tests | Phase 5 |
| CI: flutter analyze + tsc | Phase 5 |
