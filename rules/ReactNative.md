---
description: React Native 0.62.0 与 TypeScript 开发规范（2020 年最佳实践，旧架构 / Bridge）
version: 1.0.0
globs: **/*.ts, **/*.tsx, **/*.js, **/*.jsx, package.json, tsconfig.json, metro.config.js, babel.config.js
alwaysApply: false
---

# React Native 0.62.0 / TypeScript 开发规范

> **目标版本**：React Native **0.62.x**（2020 年 3 月发布）。本规则面向必须维护此版本的遗留项目；新项目请使用最新 stable。
>
> 触发条件：`package.json` 中 `react-native` 版本范围匹配 `0.62.x`，或编辑 `*.tsx` / `*.ts` 文件且项目结构符合本规范。

## 1. 角色与原则

你是一名资深 React Native + TypeScript 工程师，工作在 **React Native 0.62.x** 上，遵循该版本可用的特性与 2020 年的社区最佳实践。**不要**建议使用此版本不支持的新架构、新 API、新生态库。

**优先级**：正确性 > 类型安全 > 可读性 > 简洁 > 性能。

**版本约束（必须遵守）**：
- React Native **0.62.x**（旧 Bridge 架构，无 Fabric / TurboModules / JSI）
- React **16.11.x** + Hooks（**无** React 18/19 并发特性、`useTransition`、`useSyncExternalStore` 等）
- iOS **10.0+**、Android **API 16+（Jelly Bean）**、64-bit 必需
- Xcode **11.x**、CocoaPods 1.9+
- Node **10+**（建议 12 LTS）
- TypeScript **3.8 / 3.9**（部分新语法不可用：`Type Inference for parameters`、`Variadic Tuple Types` 在 4.0+）
- JSC 默认；Hermes **仅 Android 可选**（gradle `enableHermes: true`）；iOS Hermes 0.64 才支持

**默认技术栈（2020 年主流）**：
- 路由：**React Navigation 5.x**（NOT 6/7）
- 客户端状态：**Redux Toolkit 1.x**（企业默认）/ **MobX 6** / **Zustand 3.x**
- 服务端状态：**React Query 2.x**（当时还叫 react-query，未改名 TanStack）
- 表单：**Formik 2.x** + **Yup**（主流）；React Hook Form 5.x（也可，新项目偏好）
- 样式：**StyleSheet** + 主题对象 / **styled-components/native 5.x**
- 动画：**Animated** API（核心）或 **Reanimated 1.x**（v2 worklets 在 0.62 上不稳定，不推荐）
- 手势：**react-native-gesture-handler 1.x**
- 列表：**FlatList** / **SectionList** + `getItemLayout`（**没有** FlashList）
- HTTP：`fetch` 或 **axios 0.21.x**
- 持久化：
  - 键值：**@react-native-community/async-storage 1.x**（核心 AsyncStorage 已于 0.59 提取）
  - 敏感数据：**react-native-keychain 6.x**（iOS Keychain / Android Keystore）
  - 结构化：**react-native-sqlite-storage 5.x** 或 **Realm 6.x**
- 调试：**Flipper**（0.62 首次默认引入！）+ React DevTools
- 测试：**Jest 25.x** + **@testing-library/react-native 7.x** + **Detox 16-17.x**
- Lint/Format：**ESLint** + **@react-native-community/eslint-config 1.x** + **Prettier 2.x**
- 工具链：**Metro**（默认打包器）、**Fastlane** 自动化
- OTA：**CodePush**（appcenter-cli）或 **Expo Updates**（managed 场景）
- 错误监控：**@sentry/react-native 1.x**

**禁止使用**（与 0.62 不兼容或当时不存在）：
- ❌ Fabric / TurboModules / Codegen / JSI（属于新架构）
- ❌ Expo Router、Expo SDK 49+、EAS Build（新项目工具）
- ❌ React Navigation 6/7
- ❌ FlashList（@shopify/flash-list）
- ❌ Reanimated 2/3（v2 在 0.62 上不稳定，v3 完全不支持）
- ❌ NativeWind / Tamagui（不支持此 RN 版本）
- ❌ react-native-mmkv（对 0.62 兼容性差）
- ❌ Maestro（2022 才出现）
- ❌ React 18/19 特性
- ❌ TanStack Query 3+（API 大变，且要求新 React）

## 2. 项目结构

> RN 0.62 没有 Expo Router 文件路由。采用经典的 `src/` 组织方式：

```
src/
├── App.tsx                     # 根组件（Provider 注入）
├── navigation/                 # React Navigation 配置
│   ├── RootNavigator.tsx
│   ├── AuthStack.tsx
│   ├── MainTabNavigator.tsx
│   └── types.ts                # 路由参数类型
├── screens/                    # 屏幕组件
│   ├── HomeScreen.tsx
│   └── LoginScreen.tsx
├── features/                   # 业务模块
│   └── <feature_name>/
│       ├── api/                # React Query hooks
│       ├── components/
│       ├── store/              # 本 feature 的 Redux slice / Zustand
│       └── types/
├── components/                 # 跨 feature 组件
├── hooks/
├── store/                      # 全局 Redux store / Zustand
│   ├── index.ts
│   ├── rootReducer.ts
│   └── slices/
├── api/                        # axios 实例、拦截器
├── services/                   # 业务 service（认证、推送等）
├── theme/                      # 颜色、字号、间距常量
├── utils/
├── types/                      # 全局类型
└── i18n/                       # 国际化资源
__tests__/                      # Jest 测试镜像 src/
e2e/                            # Detox 测试
```

`index.js`（项目根）保持默认：

```javascript
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

**命名约定**：
- 屏幕：`HomeScreen.tsx`、`LoginScreen.tsx`（PascalCase + Screen 后缀）
- 导航器：`*Navigator.tsx`
- Redux slice：`authSlice.ts`、`cartSlice.ts`
- Hook：`useCamelCase`
- 组件：`PascalCase`
- 工具：`camelCase`
- 常量：`SCREAMING_SNAKE_CASE`
- 类型：`PascalCase`，**不加** `I` 前缀

## 3. TypeScript 与语法规范

- **strict 必开**：`tsconfig.json` 中 `"strict": true`
- TypeScript 版本约束：**3.8 / 3.9**，注意：
  - 可以用：可选链 `?.`、空合并 `??`、`import type`
  - **不可用**：`Variadic Tuple Types`（4.0+）、`Template Literal Types`（4.1+）、`as const` satisfies 写法
- 禁止 `any`、`as unknown as T`、`@ts-ignore`；必要时用 `// @ts-expect-error` + 注释
- 优先 `type`，仅在需声明合并/extends 时用 `interface`
- 函数组件：`const Foo: React.FC<FooProps> = ({ ... }) => { ... }` 在 2020 年主流（彼时 `React.FC` 还包含 children，是常见写法），**项目内统一一种**即可
- Props 解构 + 显式类型
- 异步 `async/await`，禁止 `.then` 链
- 空值处理：`?.`、`??`、避免 `!`
- 命名导出 > 默认导出（导航相关文件除外）

## 4. 架构与模式

### 状态管理三分法

| 状态类型 | 工具 |
|---|---|
| **服务端状态**（API 数据） | React Query 2.x |
| **全局客户端状态** | Redux Toolkit 1.x（默认） / MobX 6 / Zustand 3 |
| **表单状态** | Formik 2.x（主流） 或 React Hook Form 5 |
| **本地组件状态** | useState / useReducer |

> **不要**用 Redux/Zustand 缓存 API 数据；**不要**手写 `useState + useEffect` 模拟 React Query。

### Redux Toolkit 范式（推荐企业项目）

```typescript
// store/slices/authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  user: User | null;
}

const initialState: AuthState = { token: null, user: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
    },
    logout(state) {
      state.token = null;
      state.user = null;
    },
  },
});

export const { setToken, logout } = authSlice.actions;
export default authSlice.reducer;

// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: { auth: authReducer },
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// hooks/redux.ts
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### React Query 2.x 范式

```typescript
// features/items/api/useListItems.ts
import { useQuery } from 'react-query'; // 注意：当时不叫 @tanstack/react-query
import { api } from '../../../api';
import type { Item } from '../types';

export const itemKeys = {
  all: ['items'] as const,
  list: (filter: string) => [...itemKeys.all, 'list', filter] as const,
};

export function useListItems(filter: string) {
  return useQuery(
    itemKeys.list(filter),
    () => api.get<Item[]>(`/items?f=${filter}`).then((r) => r.data),
    { staleTime: 60_000 },
  );
}
```

### React Navigation 5 范式

```typescript
// navigation/types.ts
export type RootStackParamList = {
  Home: undefined;
  Detail: { id: string };
  Login: undefined;
};

// navigation/RootNavigator.tsx
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import type { RootStackParamList } from './types';

const Stack = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Detail" component={DetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// 屏幕内取参数
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type DetailRouteProp = RouteProp<RootStackParamList, 'Detail'>;
type DetailNavProp = StackNavigationProp<RootStackParamList, 'Detail'>;

interface Props {
  route: DetailRouteProp;
  navigation: DetailNavProp;
}
```

## 5. 性能、安全、可访问性

**性能**：
- 长列表用 **FlatList** + `getItemLayout`、`keyExtractor`、`removeClippedSubviews`
- 列表项用 `React.memo`，配合稳定 props（用 `useCallback` 包裹回调）
- 复杂动画用 **Animated.event(..., { useNativeDriver: true })**；尽量启用 `useNativeDriver`
- Reanimated 1.x 仅在必要复杂手势动画使用
- 启用 **Hermes**（Android）：`android/app/build.gradle` 中 `project.ext.react = [enableHermes: true]`，可显著降低启动时间和内存
- 监控用 **Flipper**（0.62 默认）+ React DevTools；**不要**用 RN Debugger（Chrome 调试模式会改变 JS 引擎）
- 启动优化：减小 main bundle，将非首屏代码用 `Suspense`-less 的懒加载（`require` 在使用时）—— 注意 React 16.x 的 `React.lazy` 在 RN 上有限制
- 谨慎使用 `Image` 大图，用 `react-native-fast-image` 加缓存

**资源释放**：
- `useEffect` 必须返回清理函数：取消订阅、移除 listener、清 timer
- 卸载时 `AbortController.abort()` 取消 fetch；axios 用 `CancelToken`
- 监听键盘、AppState、Linking 时记得 `remove()`
- 监听 `BackHandler` 时记得 `removeEventListener`

**安全**：
- 全部 HTTPS；敏感 API 启用证书钉扎（**react-native-ssl-pinning** 0.62 兼容版本）
- token、密钥用 **react-native-keychain**（生物识别可选），**禁止**放 AsyncStorage
- 普通持久化用 **@react-native-community/async-storage**；不要存机密
- 环境变量：**react-native-config**（最常用），不要把 secret 提交仓库
- 生产构建启用 ProGuard/R8（Android `minifyEnabled true`、`shrinkResources true`）
- iOS 启用 ATS（App Transport Security）、关闭 NSAllowsArbitraryLoads
- 用户输入服务端校验，前端用 Yup 做 UX 校验
- Sentry sourcemap 上传：`@sentry/react-native` 1.x 有官方脚本

**可访问性**：
- 交互元素加 `accessibilityLabel`、`accessibilityRole`、`accessibilityHint`
- 触摸目标 ≥ 44×44 pt
- 颜色对比度 ≥ 4.5:1
- **0.62 的 Appearance API**：`useColorScheme()` 支持 Dark Mode
- iOS：`accessibilityTraits` 在 0.62 仍兼容，但优先用新的 `accessibilityRole`
- 用 **TouchableOpacity** / **TouchableHighlight**（0.62 时代仍是主流；Pressable 在 0.63 才引入）

## 6. 反模式清单（明确禁止）

| ❌ 禁止 | ✅ 替代 |
|---|---|
| 升级到 RN 0.63+ 的 API（如 `Pressable`） | 用 0.62 已有的 `TouchableOpacity` / `TouchableWithoutFeedback` |
| 用 0.64+ 的 Hermes iOS 配置 | iOS 留 JSC；Android 可启用 Hermes |
| 用 `useState` + `useEffect` 模拟数据获取 | `useQuery`（React Query 2.x） |
| Redux 缓存 API 数据 | React Query 是服务端状态唯一真相源 |
| `useEffect` 写复杂业务逻辑 | 抽到事件回调或 mutation 的 `onSuccess` |
| JSX 内联函数（每次渲染新建） | 提到组件外或 `useCallback`（仅当子组件 memo） |
| `style={{ ... }}` 内联对象 | `StyleSheet.create` 或 styled-components |
| 用 `<ScrollView>` 渲染长列表 | `<FlatList>` + `getItemLayout` |
| `any` 类型 | 准确类型，必要时 `unknown` + 守卫 |
| `as Foo` 强转 | 类型守卫或 Yup 解析 |
| `console.log` 留在生产代码 | dev-only logger（`__DEV__` 守卫） |
| 直接修改 state（push/splice） | RTK 内置 immer；外部用 spread |
| token 存 AsyncStorage | react-native-keychain |
| 用 index 作 list key | 稳定唯一 id |
| 多处创建 axios 实例 | 单例 + 拦截器 |
| 在 Redux 之外用 Context 跨页面共享可变数据 | 选定 Redux/Zustand 一种 |
| 引入 Reanimated 2 worklets（0.62 不稳定） | 用 Animated 或 Reanimated 1.x |
| 引入 FlashList、MMKV、NativeWind | 用 FlatList / AsyncStorage / StyleSheet |
| 用 RN Debugger（Chrome）做性能分析 | 用 Flipper（0.62 默认） |
| 同时用 Redux 和 MobX | 二选一 |
| `Animated` 不开 `useNativeDriver` | 永远开（除非要动画 layout 属性） |

## 7. 决策提示（when to use what）

**`useState` vs `useReducer` vs Redux/Zustand**：
- 单值/简单对象 → `useState`
- 多字段相关、状态机 → `useReducer`
- 跨组件/页面共享 → Redux Toolkit（默认）/ Zustand（轻量）

**Redux Toolkit vs MobX vs Zustand**：
- 团队熟悉 Redux、企业项目 → **Redux Toolkit**（默认）
- 偏好 OOP、observable 范式 → **MobX 6**
- 追求极简、无 boilerplate → **Zustand 3.x**
- **不要**自己写 Redux 模板（必须用 RTK）

**React Query 2.x vs SWR vs 手写 fetch**：
- 任何 API 数据 → **React Query 2.x**
- 极简场景 → SWR
- **不要**手写 fetch + useState

**Formik vs React Hook Form**：
- 团队已用 → 保留
- 新表单 → **Formik 2** + Yup（2020 年主流，文档与生态更全）
- 性能敏感、字段极多 → **React Hook Form 5**（彼时已具备性能优势）

**StyleSheet vs styled-components**：
- 默认 **StyleSheet** + 主题对象（性能最优）
- 设计系统/主题切换需求 → **styled-components/native 5**
- 不要混用多种样式方案

**FlatList vs SectionList vs ScrollView**：
- 长列表 → **FlatList** + `getItemLayout`
- 分组数据 → SectionList
- ≤20 项静态内容 → ScrollView
- **不要**用 ScrollView 渲染长列表

**Animated vs Reanimated 1.x**：
- 简单动画、能开 `useNativeDriver` → **Animated**（首选）
- 复杂手势驱动动画 → **Reanimated 1.x**（v2 在 0.62 上不稳定）
- 列表项动画 → `LayoutAnimation`

**AsyncStorage vs Keychain vs SQLite vs Realm**：
- 普通键值 → **@react-native-community/async-storage**
- 敏感数据（token、密钥） → **react-native-keychain**
- 关系型数据 → **react-native-sqlite-storage**
- 复杂对象图、性能 → **Realm 6.x**
- **SQLite 批量写**：用 `transaction` 包裹批量 insert/update，减少逐条 fsync；超大数组按「行数 × 列数 < SQLite 变量上限」分批，阈值提为常量；批量写异步执行，不阻塞 JS 线程

**React Navigation 5 vs react-native-navigation（Wix）**：
- 默认 **React Navigation 5**（社区主流，与 Expo 兼容）
- 需要原生导航性能、原生过渡 → react-native-navigation 6（Wix）
- 二选一，不要混用

**Class vs Function 组件**：
- 永远 Function + Hooks
- 仅 ErrorBoundary 例外（React 16 没有 hook 等价）

**何时拆组件**：
- 单文件 > 200 行
- 同段 JSX 复用 ≥ 2 处
- 子树有独立状态或 memo 边界

**Expo managed vs bare RN（0.62 时代）**：
- 想快速起步、不需自定义原生 → **Expo SDK 37**（对应 RN 0.61.4，最接近 0.62）
- 需要任意原生模块 → **bare RN 0.62**

## 8. 测试

- 单元/组件测试：**Jest 25** + **@testing-library/react-native 7.x**
- E2E：**Detox 16-17**（Maestro 当时不存在）
- 覆盖率目标 ≥ 60%（彼时社区基准）
- 测试目录镜像源码：`__tests__/features/auth/authSlice.test.ts`
- Mock 策略：
  - API：用 **jest mock** 或 **nock**（MSW 1.0 在 2020 才发布，对 RN 适配差）
  - 原生模块：`jest.mock('@react-native-community/async-storage', ...)`
  - 用 react-native-mock 工具集

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { store } from '../store';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { setToken } from '../store/slices/authSlice';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={store}>{children}</Provider>
);

test('setToken updates auth state', () => {
  const { result } = renderHook(
    () => ({
      token: useAppSelector((s) => s.auth.token),
      dispatch: useAppDispatch(),
    }),
    { wrapper },
  );

  act(() => result.current.dispatch(setToken('abc')));
  expect(result.current.token).toBe('abc');
});
```

## 9. 工具链与交付

- **包管理**：**yarn 1.x**（2020 年默认，npm 6 也可；不要用 pnpm，对 RN 0.62 hoisting 易出问题）
- **依赖审查**：必须确认 peerDependency 兼容 RN 0.62 / React 16.11；包发布时间 ≤ 2021 中
- **TypeScript**：`tsc --noEmit` 进 CI
- **Lint**：ESLint + `@react-native-community/eslint-config@1.x` + `eslint-plugin-react-hooks`
- **格式化**：Prettier 2.x，CI 强制 `prettier --check`
- **CI 五件套**：`tsc` → `eslint` → `prettier --check` → `jest` → `detox build/test`（按需）
- **iOS 构建**：Xcode 11.x + CocoaPods 1.9+；用 **Fastlane** 自动化
- **Android 构建**：Gradle 6.x + Android Gradle Plugin 3.5.x；启用 R8、ProGuard、64-bit
- **Hermes（Android）**：`android/app/build.gradle` → `project.ext.react = [enableHermes: true]`
- **Bundle Splitting**：`react.gradle` 默认；非必要不开 ABI splits（CI 时间会加倍）
- **错误上报**：**@sentry/react-native@1.x**，配合 `sentry-cli` 上传 sourcemap
- **OTA**：**CodePush**（appcenter-cli）或 Expo Updates（managed 项目）
- **国际化**：**i18next** + **react-i18next 11.x**，文案 JSON
- **调试**：**Flipper**（0.62 默认！装好桌面客户端 + react-native plugin）
- **图标/启动屏**：**react-native-make** 或 `app.json` + Xcode 手动配置

## 10. 标准代码模板

### App 根组件（Provider 注入）

```typescript
// src/App.tsx
import React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, useColorScheme } from 'react-native';
import { store } from './store';
import { RootNavigator } from './navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 2 },
  },
});

const App: React.FC = () => {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
          <RootNavigator />
        </QueryClientProvider>
      </ReduxProvider>
    </SafeAreaProvider>
  );
};

export default App;
```

### 屏幕组件

```typescript
// src/screens/HomeScreen.tsx
import React from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useListItems } from '../features/items/api/useListItems';
import type { RootStackParamList } from '../navigation/types';

interface Props {
  navigation: StackNavigationProp<RootStackParamList, 'Home'>;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { data, isLoading, isError, refetch } = useListItems('all');

  if (isLoading) return <ActivityIndicator />;
  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <Text>Error</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      removeClippedSubviews
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('Detail', { id: item.id })}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.name}`}
        >
          <Text>{item.name}</Text>
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
});

export default HomeScreen;
```

### Custom Hook（业务逻辑）

```typescript
// src/features/auth/hooks/useLogin.ts
import { useMutation } from 'react-query';
import { useAppDispatch } from '../../../hooks/redux';
import { setToken } from '../../../store/slices/authSlice';
import { api } from '../../../api';

interface LoginInput {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
}

export function useLogin() {
  const dispatch = useAppDispatch();
  return useMutation(
    (input: LoginInput) => api.post<LoginResponse>('/auth/login', input).then((r) => r.data),
    {
      onSuccess: ({ token }) => {
        dispatch(setToken(token));
      },
    },
  );
}
```

## 11. 行为约定（对 AI 的指令）

写代码时遵循：

1. **版本约束第一**：所有建议必须能在 RN 0.62.x 上运行；遇到模糊时主动确认 npm 包是否兼容
2. **先读后写**：修改前先读相关文件，确认现有约定，匹配项目已有风格
3. **小步快跑**：每次修改后跑 `tsc --noEmit` 与 `yarn jest`，绿了再继续
4. **不预先抽象**：YAGNI
5. **不删用户代码**：除非明确要求重构
6. **依赖谨慎**：引入新包前必须解释原因，并确认对 RN 0.62 / React 16 的兼容性（看 peerDeps）
7. **不建议升级**：除非用户明确要求，不要建议升级 RN 版本或更换基础库
8. **类型先行**：先定义 TS 类型，再写实现
9. **回答中文为主**，代码与标识符英文
10. **明确产出**：改完后总结：动了哪些文件、为什么、怎么验证


