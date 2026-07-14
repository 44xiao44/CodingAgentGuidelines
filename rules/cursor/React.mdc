---
description: React 17 Web 端开发规范（2021-2022 主流栈，无并发特性）
version: 1.0.0
globs: **/*.ts, **/*.tsx, **/*.js, **/*.jsx, package.json, tsconfig.json, vite.config.*, webpack.config.*, next.config.*
alwaysApply: false
---

# React 17 / TypeScript Web 开发规范

> **目标版本**：React **17.0.2**（2020 年 10 月发布的过渡版本）。本规则面向必须维护此版本的项目。新项目应使用 React 19。
>
> 触发条件：`package.json` 中 `react` 版本范围匹配 `^17` 或 `17.x`，或编辑 `*.tsx` / `*.ts` 文件且项目结构符合 React Web 应用。

## 1. 角色与原则

你是一名资深 React + TypeScript Web 工程师，工作在 **React 17.0.2** 上，遵循该版本可用的特性与 2021-2022 年的社区最佳实践。**不要**建议使用 React 18/19 才有的并发特性、新 hook、Server Components 等。

**优先级**：正确性 > 类型安全 > 可读性 > 简洁 > 性能。

**版本约束（必须遵守）**：
- React **17.0.2**（最终补丁版）+ ReactDOM 17.0.2
- TypeScript **4.4 - 4.6**（4.5 是 2021.11 发布）
- Node **14 LTS**（最低）/ 16 LTS（推荐）
- 浏览器目标：ES2017+；IE11 已不再支持
- 启用 React 17 的**新 JSX transform**：`tsconfig.json` 中 `"jsx": "react-jsx"`，文件顶部不再需要 `import React from 'react'`

**默认技术栈（2021-2022 主流）**：
- 路由：**React Router 6.x**（6.0-6.3 与 React 17 完全兼容）；遗留项目可保留 **React Router 5.x**
- 客户端状态：**Redux Toolkit 1.x**（企业默认） / **Zustand 3.x** / **Recoil** / **Jotai 1.x**
- 服务端状态：**react-query 3.x**（彼时未改名 TanStack；v4 在 2022.7 才发布）
- 表单：**React Hook Form 7.x**（默认） / Formik 2
- 数据校验：**Yup** 或 **Zod**（Zod 1.x/2.x 期间快速增长）
- 样式：**Tailwind CSS 3** / **CSS Modules** / **styled-components 5** / **Emotion 11**
- HTTP：**axios 0.27.x** + 拦截器，或 fetch + 自封装
- 测试：**Jest 27/28** + **React Testing Library 12.x**（13+ 要求 React 18） + **MSW 0.x**
- E2E：**Cypress 9-10** 或 **Playwright 1.20+**
- Lint：**ESLint** + `eslint-config-react-app` 或 **airbnb** + **eslint-plugin-react-hooks** + **Prettier 2.x**
- 构建工具（按场景选）：**Vite 2/3**（首选）/ **Create React App 5**（CRA，遗留）/ **Webpack 5**（自定义）/ **Next.js 12**（Pages Router）
- 错误监控：**@sentry/react 6/7**

**禁止使用**（与 React 17 不兼容或当时不存在）：
- ❌ React 18 hooks：`useTransition`、`useDeferredValue`、`useId`、`useSyncExternalStore`、`useInsertionEffect`
- ❌ React 19 hooks：`use`、`useActionState`、`useFormStatus`、`useOptimistic`、`useFormState`
- ❌ React 18 的 `createRoot` API（17 用 `ReactDOM.render`）
- ❌ React 18 自动批处理（17 仅在事件处理函数内批处理）
- ❌ React Server Components / Suspense for data fetching
- ❌ React 19 的 `<form action={fn}>`、`<title>` 等增强
- ❌ React Compiler（2024+，要求 React 19）
- ❌ Next.js 13+ App Router（需要 React 18）—— 用 **Pages Router**
- ❌ React Testing Library **13+**（需要 React 18）—— 锁定 **12.x**
- ❌ TanStack Query 4+ 名称（彼时叫 `react-query`；v4 也支持 17 但导入路径变了）
- ❌ Tailwind CSS 4（2024 末发布，与 PostCSS 链有破坏性变更）

## 2. 项目结构（feature-first）

```
src/
├── main.tsx                    # 入口（Vite）/ index.tsx（CRA）
├── App.tsx                     # 根组件（路由 + 全局 Provider）
├── routes/                     # 路由配置（React Router 6）
│   ├── index.tsx
│   └── PrivateRoute.tsx
├── pages/                      # 页面组件（与路由一一对应）
│   ├── HomePage.tsx
│   └── LoginPage.tsx
├── features/                   # 业务模块（feature-first）
│   └── <feature_name>/
│       ├── api/                # react-query hooks
│       │   ├── useListItems.ts
│       │   └── itemKeys.ts
│       ├── components/
│       ├── hooks/
│       ├── store/              # 本 feature 的 Redux slice / Zustand
│       ├── types/
│       └── utils/
├── components/                 # 跨 feature 组件
│   ├── ui/                     # 设计系统基础组件
│   └── <ComponentName>/
├── hooks/                      # 跨 feature hooks
├── store/                      # 全局 Redux store
│   ├── index.ts
│   ├── rootReducer.ts
│   └── slices/
├── lib/                        # 框架级工具
│   ├── api/                    # axios 实例 + 拦截器
│   ├── auth/
│   └── i18n/
├── styles/                     # 全局样式 / Tailwind 入口
│   └── index.css
├── theme/                      # 设计令牌（如不用 Tailwind）
├── types/                      # 全局类型
├── utils/
└── constants/
public/                         # 静态资源
__tests__/ 或 src/**/*.test.tsx # 测试
e2e/                            # Cypress / Playwright
```

**命名约定**：
- 组件：`PascalCase.tsx`（页面用 `XxxPage.tsx` 后缀）
- Hook：`useCamelCase.ts`
- Redux slice：`authSlice.ts`
- 工具：`camelCase.ts`
- 常量：`SCREAMING_SNAKE_CASE`
- 类型：`PascalCase`，**不加** `I` 前缀（用 `User` 而非 `IUser`）

## 3. TypeScript 与语法规范

- **strict 必开**：`"strict": true`、`"noUncheckedIndexedAccess": true`（4.1+）、`"exactOptionalPropertyTypes": true`（4.4+）
- TS 版本约束 **4.4-4.6**：
  - 可用：`?.`、`??`、`import type`、`as const` satisfies（4.9+ 不可用）、Template Literal Types（4.1+）
  - **不可用**：`satisfies` 操作符（4.9+）、`const` 类型参数（5.0+）、`accessor` 关键字（5.0+）
- 禁止 `any`、`as unknown as T`、`@ts-ignore`；必要时用 `// @ts-expect-error` + 注释
- 优先 `type`，仅在需要声明合并/extends 时用 `interface`
- **不要写 `React.FC`**（隐式 children 已被社区放弃）；用 `function Comp(props: Props)` 或 `const Comp: (p: Props) => JSX.Element`
- Props 解构 + 显式类型：`function Foo({ id, name }: FooProps)`
- 使用新 JSX transform：文件顶部**不需要** `import React`（除非要用 React.xxx 命名空间）
- 异步 `async/await`，禁止 `.then` 链
- 空值 `?.` / `??`，避免 `!`
- 命名导出 > 默认导出（路由文件除外）
- ES Modules：`import`/`export`，不用 CommonJS

## 4. 架构与模式

### 状态管理三分法（必须遵守）

| 状态类型 | 工具 |
|---|---|
| **服务端状态**（API 数据） | react-query 3.x |
| **全局客户端状态** | Redux Toolkit 1.x / Zustand 3 / Recoil / Jotai 1 |
| **表单状态** | React Hook Form 7 |
| **本地组件状态** | useState / useReducer |
| **URL 状态**（筛选、分页） | `useSearchParams`（React Router 6） |

> **不要**用 Redux/Zustand 缓存 API 数据；**不要**手写 `useState + useEffect` 模拟 react-query。

### Redux Toolkit 范式

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

// hooks/redux.ts —— 类型化 hooks
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### react-query 3.x 范式

```typescript
// features/items/api/useListItems.ts
import { useQuery } from 'react-query'; // 注意：v3 包名是 react-query，不是 @tanstack/react-query
import { api } from '../../../lib/api';
import type { Item } from '../types';

export const itemKeys = {
  all: ['items'] as const,
  list: (filter: string) => [...itemKeys.all, 'list', filter] as const,
  detail: (id: string) => [...itemKeys.all, 'detail', id] as const,
};

export function useListItems(filter: string) {
  return useQuery(
    itemKeys.list(filter),
    ({ signal }) => api.get<Item[]>(`/items?f=${filter}`, { signal }).then((r) => r.data),
    { staleTime: 60_000 },
  );
}
```

### React Router 6 范式

```typescript
// routes/index.tsx
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const HomePage = lazy(() => import('../pages/HomePage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<div>Loading...</div>}>
        <HomePage />
      </Suspense>
    ),
  },
  { path: '/login', element: <LoginPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export const AppRouter = () => <RouterProvider router={router} />;
```

> ⚠️ React Router 6.4+ 引入了 `loader` / `action` 数据 API，与 React 17 在大多数场景仍兼容，但 `<Await>` + Suspense 数据获取需要谨慎使用（无并发特性）。建议在 React 17 项目仍用 react-query 处理数据。

### 入口（17 的写法）

```typescript
// main.tsx (Vite) 或 index.tsx (CRA)
import { StrictMode } from 'react';
import ReactDOM from 'react-dom'; // 注意：是 react-dom，不是 react-dom/client
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClient, QueryClientProvider } from 'react-query';
import { store } from './store';
import { AppRouter } from './routes';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 2 } },
});

// React 17 用 ReactDOM.render，不要用 createRoot（那是 18）
ReactDOM.render(
  <StrictMode>
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>
    </ReduxProvider>
  </StrictMode>,
  document.getElementById('root'),
);
```

## 5. 性能、安全、可访问性

**性能（React 17 特定注意）**：
- **没有自动批处理**：`setTimeout`、`Promise.then`、原生事件回调中多次 `setState` 不会自动合并；如需合并用 `unstable_batchedUpdates(() => { ... })`（社区规避方案）
- **没有 useTransition**：高耗渲染只能依赖 `useMemo`、`useDeferredValue` 替代——而 `useDeferredValue` 是 18 才有，17 用 `debounce`/`throttle`（lodash 或自写）替代
- 仅在必要时用 `useMemo`/`useCallback`（依赖稳定 + 子组件 memo 才有意义；过度优化反而增加成本）
- 列表用 **react-window** 或 **react-virtualized** 做虚拟滚动（彼时主流）
- 路由级懒加载：`React.lazy` + `Suspense`（17 已支持，仅限组件级，不能用于数据）
- 图片懒加载：原生 `loading="lazy"` 或 **react-lazyload**
- 代码分割：Webpack 5 / Vite 自动 chunk + 动态 `import()`
- 监控：**React DevTools Profiler** + Lighthouse + Web Vitals

**资源释放**：
- `useEffect` 必须返回清理函数：取消订阅、移除 listener、清 timer
- fetch 用 `AbortController`（react-query 3.x 自动）
- 监听 `resize`、`scroll`、`keydown` 时记得 `removeEventListener`
- 注意 17 的 `useEffect` 清理函数是**异步**执行（在 paint 之后），与 16 不同

**安全**：
- 全部 HTTPS；CSP 头部配置严格
- token 存储：**HttpOnly Cookie** 优先（防 XSS）；如必须前端存储用 `sessionStorage`，**避免** `localStorage`
- XSS 防护：永远不要用 `dangerouslySetInnerHTML`，万不得已用 **DOMPurify** 清洗
- CSRF：API 接口 SameSite Cookie + CSRF token
- 依赖审计：CI 中跑 `npm audit` / `yarn audit`
- 环境变量：Vite 用 `VITE_*` 前缀，CRA 用 `REACT_APP_*`；**不要**把 secret 提交仓库
- 用户输入服务端校验，前端用 Zod/Yup 做 UX 校验
- 生产构建启用 sourcemap 上传 Sentry，但不要部署 sourcemap

**可访问性（a11y）**：
- 语义化 HTML：`<button>` 不写成 `<div onClick>`；表单 `<label>` 关联 `htmlFor`
- 键盘导航：所有交互可 Tab；自定义控件实现 `role` + `aria-*`
- 焦点管理：路由切换、模态框打开后聚焦正确元素
- 颜色对比度 ≥ 4.5:1
- 用 **eslint-plugin-jsx-a11y**（react-app config 自带）

## 6. 反模式清单（明确禁止）

| ❌ 禁止 | ✅ 替代 |
|---|---|
| `import React from 'react'` 仅为了用 JSX | 使用新 JSX transform（`"jsx": "react-jsx"`），不需要 import |
| `ReactDOM.createRoot`（React 18 API） | 用 `ReactDOM.render`（17） |
| `useTransition`、`useDeferredValue`、`useId`、`useSyncExternalStore` | 17 不可用；用 debounce、稳定 ref 替代 |
| `useState` + `useEffect` 模拟数据获取 | `useQuery`（react-query 3.x） |
| Redux 缓存 API 数据 | react-query 是服务端状态唯一真相源 |
| `useEffect` 写复杂业务逻辑 | 抽到事件回调或 mutation 的 `onSuccess` |
| JSX 内联函数（每次渲染新建） | 提到组件外或 `useCallback`（仅当子组件 memo） |
| `style={{ ... }}` 内联对象 | CSS Modules / Tailwind class / styled-components |
| `<div onClick>` 当按钮用 | `<button type="button">` |
| `dangerouslySetInnerHTML` | DOMPurify 清洗或重构数据 |
| `any` 类型 | 准确类型，必要时 `unknown` + 类型守卫 |
| `as Foo` 强转 | 类型守卫或 Zod 解析 |
| `console.log` 留生产 | dev-only logger（`process.env.NODE_ENV === 'development'`） |
| 直接修改 state（push/splice） | RTK 内置 immer；外部用 spread |
| token 存 localStorage | HttpOnly Cookie 或 sessionStorage |
| 用 index 作 list key | 稳定唯一 id |
| 多处创建 axios 实例 | 单例 + 拦截器 |
| 同时用 Redux 和 MobX | 二选一 |
| `useEffect` 缺依赖被 lint 警告时直接禁用规则 | 修正依赖；用 `useEvent`-like 模式（手写 ref） |
| Class 组件（除 ErrorBoundary） | 永远函数组件 + Hooks |
| `componentWillMount` / `componentWillReceiveProps` 等已废弃生命周期 | 用 hooks |
| 把所有逻辑塞进一个组件 | 拆 custom hooks + 子组件 |
| 三层以上 ternary | 早返回或子组件抽出 |

## 7. 决策提示（when to use what）

**`useState` vs `useReducer` vs Redux/Zustand**：
- 单值/简单对象 → `useState`
- 多字段相关、状态机 → `useReducer`
- 跨组件共享 → Redux Toolkit（默认） / Zustand（轻量）

**Redux Toolkit vs Zustand vs Recoil vs Jotai**：
- 团队熟悉 Redux、企业项目 → **Redux Toolkit 1.x**
- 追求极简、无 boilerplate → **Zustand 3.x**
- 状态像图、依赖关系复杂 → **Jotai 1.x** 或 **Recoil**（注意 Recoil 已停止积极维护，新项目慎用）
- **不要**自写 Redux 模板（必须用 RTK）

**react-query 3 vs SWR vs 手写 fetch**：
- 任何 API 数据 → **react-query 3.x**
- 极简场景、Vercel 生态 → **SWR 1.x**
- **不要**手写 fetch + useState

**React Hook Form vs Formik**：
- 性能、字段多、新项目 → **React Hook Form 7**（默认）
- 已有项目用 Formik → 保留
- 复杂校验 → 配合 **Zod** 或 **Yup**

**Tailwind vs CSS Modules vs styled-components**：
- 团队接受原子化、追求开发速度 → **Tailwind CSS 3**
- 组件库、设计系统 → **CSS Modules** 或 **styled-components 5**
- 不要混用多种样式方案

**Vite vs CRA vs Webpack vs Next.js**：
- 新项目、纯 SPA → **Vite 2/3**（最快 HMR）
- 已有 CRA → 保留或迁移到 Vite
- 需要细粒度配置 → **Webpack 5**
- SSR / 文件路由 → **Next.js 12 Pages Router**（不要用 App Router，需要 18）

**React Router 6 vs Reach Router vs TanStack Router**：
- 默认 **React Router 6.x**（社区主流）
- 遗留项目 → React Router 5
- 不要用 Reach Router（已合并到 RR6）；TanStack Router 当时还未稳定

**何时用 `useMemo` / `useCallback`**：
- 默认**不加**
- 只在以下场景加：
  1. 子组件 `React.memo` 且依赖此 prop
  2. 计算成本明显高（毫秒级以上）
  3. 作为其他 hook 的依赖项需要稳定引用
- 滥用反而拖慢渲染

**何时拆组件 / Custom Hook**：
- 单文件 > 200 行
- 同段 JSX 复用 ≥ 2 处
- 多个 useState/useEffect 关联同一逻辑 → 抽 custom hook
- 子树有独立 memo 边界

**Class vs Function 组件**：
- 永远 Function + Hooks
- 仅 ErrorBoundary 例外（17 没有 hook 等价；18+ 有 `useErrorBoundary` 第三方库）

## 8. 测试

- 单元/组件测试：**Jest 27/28** + **@testing-library/react 12.x**（注意：13+ 要求 React 18，**不要升级**）
- 用户事件用 `@testing-library/user-event 13.x`（更接近真实交互）
- API mock：**MSW 0.x**（拦截网络层）
- E2E：**Cypress 9-10** 或 **Playwright 1.20+**
- 覆盖率目标 ≥ 70%（核心业务）
- 测试目录策略：旁置 `*.test.tsx` 或集中 `__tests__/`（项目内统一）

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import ItemsPage from './ItemsPage';

const server = setupServer(
  rest.get('/api/items', (_req, res, ctx) =>
    res(ctx.json([{ id: '1', name: 'Apple' }])),
  ),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('renders items list', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ItemsPage />
    </QueryClientProvider>,
  );

  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Apple')).toBeInTheDocument());
});
```

## 9. 工具链与交付

- **包管理**：**yarn 1.x** 或 **npm 8+**；**pnpm** 也可（注意 hoisting 问题对老依赖少见）
- **依赖审查**：peerDeps 兼容 React 17；不引入要求 React 18+ 的包
- **TypeScript**：`tsc --noEmit` 进 CI
- **Lint**：ESLint + `eslint-config-react-app`（CRA）或 airbnb + `eslint-plugin-react-hooks` + `eslint-plugin-jsx-a11y`
- **Format**：Prettier 2.x，CI 强制 `prettier --check`
- **Bundler 构建**：Vite `vite build` / CRA `react-scripts build` / Webpack `webpack --mode production`
- **Source maps**：生产上传 Sentry，**不要**部署到 CDN
- **Polyfills**：通过 **core-js** + Babel preset-env，目标在 `browserslist` 配置
- **CI 五件套**：`tsc` → `eslint` → `prettier --check` → `jest` → 构建（按需 e2e）
- **错误监控**：**@sentry/react 6/7**，配合 `@sentry/tracing` 做性能监控
- **Web Vitals**：CRA 自带 `reportWebVitals`，Vite 用 `web-vitals` 包
- **国际化**：**react-i18next 11** + i18next 21，文案 JSON

## 10. 标准代码模板

### 页面组件（react-query + RR6）

```tsx
// pages/ItemsPage.tsx
import { useNavigate } from 'react-router-dom';
import { useListItems } from '../features/items/api/useListItems';

export function ItemsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useListItems('all');

  if (isLoading) return <div>Loading...</div>;
  if (isError) {
    return (
      <div role="alert">
        Failed to load.
        <button type="button" onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-200">
      {data?.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="px-4 py-3 w-full text-left hover:bg-gray-50"
            onClick={() => navigate(`/items/${item.id}`)}
          >
            {item.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

### Custom Hook（业务逻辑分离）

```typescript
// features/auth/hooks/useLogin.ts
import { useMutation } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useAppDispatch } from '../../../hooks/redux';
import { setToken } from '../../../store/slices/authSlice';

interface LoginInput { email: string; password: string }
interface LoginResponse { token: string }

export function useLogin() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  return useMutation(
    (input: LoginInput) =>
      api.post<LoginResponse>('/auth/login', input).then((r) => r.data),
    {
      onSuccess: ({ token }) => {
        dispatch(setToken(token));
        navigate('/', { replace: true });
      },
    },
  );
}
```

### 表单（React Hook Form + Zod）

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin } from '../features/auth/hooks/useLogin';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const { mutate, isLoading } = useLogin();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutate(v))}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register('email')} />
      {errors.email && <span role="alert">{errors.email.message}</span>}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <span role="alert">{errors.password.message}</span>}

      <button type="submit" disabled={isLoading}>Submit</button>
    </form>
  );
}
```

## 11. 行为约定（对 AI 的指令）

写代码时遵循：

1. **版本约束第一**：所有建议必须在 React 17.0.2 上运行；遇到 hook/API 不确定时主动确认是否在 React 17 引入
2. **先读后写**：修改前先读相关文件，确认现有约定，匹配项目已有风格
3. **小步快跑**：每次修改后跑 `tsc --noEmit` 与 `yarn test`，绿了再继续
4. **不预先抽象**：YAGNI，不预留扩展点
5. **不删用户代码**：除非明确要求重构
6. **依赖谨慎**：引入新包前必须解释原因，并确认 peerDeps 兼容 React 17
7. **不建议升级**：除非用户明确要求，不要建议升级 React 版本或更换基础库
8. **类型先行**：先定义 TS 类型，再写实现
9. **回答中文为主**，代码与标识符英文
10. **明确产出**：改完后总结：动了哪些文件、为什么、怎么验证


