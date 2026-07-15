---
description: uni-app 2.x（Vue 2）跨端开发规范，覆盖小程序 / H5 / App，含条件编译与各端差异
version: 1.0.0
globs: **/*.vue, **/*.ts, **/*.js, pages.json, manifest.json, App.vue, main.js, uni.scss
alwaysApply: false
---

# uni-app 2.x（Vue 2）开发规范

> **目标版本**：uni-app **2.x**（Vue 2 生态，CLI/HBuilderX 通用）。本规则面向当前生产环境的 uni-app 2.x 项目。新项目可考虑 uni-app 3.x（Vue 3）或 uni-app x（原生编译）。
>
> 触发条件：项目根存在 `pages.json` + `manifest.json`，或编辑 `*.vue` 文件且 `package.json` 中含 `@dcloudio/uni-*` 依赖。

## 1. 角色与原则

你是一名资深 uni-app 跨端工程师，工作在 **uni-app 2.x（Vue 2）** 上，深度理解小程序、H5、App 三端差异，遵循 DCloud 官方推荐与 2020-2022 年的 Vue 2 + 小程序最佳实践。

**优先级**：跨端正确性 > 包体积 > 性能 > 可读性 > 简洁。

> ⚠️ uni-app 与纯 Web/Vue 项目不同，**包大小**和**端差异**是首要约束。微信小程序主包硬上限 2MB、总包 16MB，超限直接无法发布。

**版本约束（必须遵守）**：
- uni-app **2.x**（CLI 版或 HBuilderX 创建的 Vue 2 工程）
- Vue **2.6.x** 或 **2.7.x**（2.7 已自带 Composition API，可不用 `@vue/composition-api` 插件）
- vuex **3.6.x**（不要用 vuex 4，那是 Vue 3）
- vue-router **3.x**（仅 H5 端有效；小程序/App 用 pages.json）
- TypeScript：可选，2.7+ 推荐使用；2.6 需 `vue-class-component` + `vue-property-decorator`
- Node **12-14 LTS**

**默认技术栈（2020-2022 主流）**：
- 框架：uni-app 2.x + Vue 2.7.x（推荐升到 2.7 拿 Composition API）
- 状态管理：**vuex 3.6.x**（按模块拆分）；轻量场景可用 `getApp().globalData` + `Vue.observable`
- 路由：**pages.json**（统一配置）+ `uni.navigateTo` / `uni.redirectTo` / `uni.switchTab` / `uni.reLaunch` / `uni.navigateBack`
- HTTP：**uni.request**（原生跨端） + 自封装 axios-like 拦截器层
- 持久化：`uni.setStorageSync` / `uni.getStorageSync`（同步） / 异步版本
- UI 组件库（按目标端选）：
  - 跨端：**uView UI 1.8.x / 2.x**（最主流）、**uni-ui**（DCloud 官方）
  - 仅微信小程序：**Vant Weapp**（不能在 H5/App 用）
  - 仅 H5：vant 2.x
- 样式：**SCSS** + **rpx 单位**（750rpx = 屏幕宽度）+ **uni.scss**（全局变量）
- 图表：**uCharts**（跨端） / ECharts（仅 H5/App）
- 工具：**HBuilderX**（官方 IDE，零配置）/ vue-cli + `@dcloudio/uni-*` preset（CI/CD）
- 测试：**Jest** + **@vue/test-utils 1.x**（小程序端测试有限）；微信小程序自动化用 **miniprogram-automator**
- Lint：**ESLint** + `eslint-plugin-vue@7` + `@vue/eslint-config-typescript`（可选） + Prettier 2
- 错误监控：**Sentry**（仅 H5/App 完整支持，小程序需小程序专用 SDK 或自封装上报）

**禁止使用**（与 uni-app 2.x 不兼容）：
- ❌ Vue 3 语法：`<script setup>`、`defineProps`、`defineEmits`、`createApp`
- ❌ vuex 4 / Pinia 2（Pinia 1.x 配 `@vue/composition-api` 可用，但生态适配差，**不推荐**）
- ❌ vue-router 4
- ❌ Vite（2.x 项目用 Webpack 4）
- ❌ Tailwind CSS（小程序对 class 选择器、样式继承有限制，落地困难）
- ❌ 浏览器专属 API：`window`、`document`、`localStorage`、`navigator`（小程序/App 端没有）
- ❌ `v-html`（微信小程序、QQ 小程序不支持，需用 **rich-text** 组件）
- ❌ 动态组件 `<component :is>` 在小程序端有限制（需提前在 `easycom` 或 `pages.json` 注册）
- ❌ CSS 选择器：`*`、`body`、`html`、`@import` 跨包（小程序限制）

## 2. 项目结构

```
项目根/
├── App.vue                     # 应用入口（onLaunch / onShow / onHide / onError）
├── main.js                     # Vue 实例化（main.ts 同名）
├── pages.json                  # 页面路由 + tabBar + 全局窗口配置 ⭐
├── manifest.json               # 应用配置（appid、版本、各端配置）⭐
├── uni.scss                    # 全局样式变量
├── package.json
├── vue.config.js               # （CLI 项目）Webpack 自定义
├── babel.config.js
├── pages/                      # 主包页面 ⭐
│   ├── index/
│   │   └── index.vue
│   ├── login/
│   │   └── login.vue
│   └── ...
├── subPackages/                # 分包（小程序减小主包） ⭐
│   ├── user/
│   │   ├── pages/
│   │   │   ├── profile/
│   │   │   └── settings/
│   │   └── components/
│   └── order/
├── static/                     # 静态资源（图片、字体；不参与编译）
├── components/                 # 全局组件（easycom 自动注册）
│   └── <ComponentName>/
│       └── <ComponentName>.vue
├── uni_modules/                # uni 标准模块（uView 等通过此安装）
├── store/                      # vuex
│   ├── index.js
│   └── modules/
│       ├── user.js
│       └── cart.js
├── api/                        # 后端接口封装
│   ├── request.js              # uni.request 拦截器
│   ├── user.js
│   └── order.js
├── common/                     # 公共方法 / 常量
│   ├── utils.js
│   ├── constants.js
│   └── filters.js              # Vue 2 过滤器
├── mixins/                     # 公共 mixin（页面级 / 组件级）
├── styles/                     # SCSS 公共样式
└── locale/                     # 国际化（如需）
```

**命名约定**：
- 页面文件：`kebab-case`（如 `user-profile.vue`），路径与 pages.json 一致
- 组件：`PascalCase.vue`（easycom 自动识别）或 `kebab-case`，项目内统一一种
- vuex 模块：`camelCase.js`
- 常量：`SCREAMING_SNAKE_CASE`
- 工具函数：`camelCase`
- 全局组件名建议加项目前缀（如 `xyz-button.vue`）避免与 uView 等冲突

## 3. pages.json 与路由

### pages.json 关键字段

```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "首页",
        "enablePullDownRefresh": true
      }
    }
  ],
  "subPackages": [
    {
      "root": "subPackages/user",
      "pages": [
        { "path": "pages/profile/profile", "style": { "navigationBarTitleText": "个人中心" } }
      ]
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["subPackages/user"]
    }
  },
  "globalStyle": {
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "uni-app",
    "navigationBarBackgroundColor": "#F8F8F8",
    "backgroundColor": "#F8F8F8"
  },
  "tabBar": {
    "color": "#7A7E83",
    "selectedColor": "#3cc51f",
    "borderStyle": "black",
    "backgroundColor": "#ffffff",
    "list": [
      { "pagePath": "pages/index/index", "iconPath": "static/tab-home.png", "selectedIconPath": "static/tab-home-active.png", "text": "首页" }
    ]
  }
}
```

### 路由 API（uni.* 而非 vue-router）

| API | 用途 | 限制 |
|---|---|---|
| `uni.navigateTo` | 跳新页面 | 页面栈 ≤ 10 层 |
| `uni.redirectTo` | 关闭当前并跳转 | 不可返回 |
| `uni.switchTab` | 跳到 tabBar 页面 | 只能跳 tabBar 配置过的页 |
| `uni.reLaunch` | 关闭所有页面跳到指定页 | 重置页面栈 |
| `uni.navigateBack` | 返回上一页 | `delta` 控制层数 |

**参数传递**：URL 拼 query（注意 URL 长度限制约 1024，复杂参数用 vuex 或 eventChannel）。

```javascript
// 简单参数
uni.navigateTo({ url: `/pages/detail/detail?id=${id}` });

// 复杂对象用 encodeURIComponent + JSON
uni.navigateTo({ url: `/pages/detail/detail?data=${encodeURIComponent(JSON.stringify(obj))}` });

// 推荐：复杂数据存 vuex 或 globalData，URL 只传 id
```

## 4. 条件编译（核心机制）

uni-app 跨端的灵魂：**用注释做条件分支**。

```vue
<template>
  <view>
    <!-- #ifdef MP-WEIXIN -->
    <button open-type="getUserInfo">微信授权</button>
    <!-- #endif -->

    <!-- #ifdef H5 -->
    <a href="tel:10086">拨打</a>
    <!-- #endif -->

    <!-- #ifndef MP -->
    <view>非小程序端可见</view>
    <!-- #endif -->
  </view>
</template>

<script>
// JS 中：
// #ifdef MP-WEIXIN
import wxLogin from './wx-login';
// #endif

// #ifdef H5
import h5Tracker from './h5-tracker';
// #endif

export default {
  methods: {
    callPhone(num) {
      // #ifdef APP-PLUS
      plus.device.dial(num);
      // #endif

      // #ifdef MP-WEIXIN
      uni.makePhoneCall({ phoneNumber: num });
      // #endif

      // #ifdef H5
      window.location.href = `tel:${num}`;
      // #endif
    }
  }
}
</script>

<style lang="scss">
/* SCSS / CSS 中： */
.btn {
  /* #ifdef MP-WEIXIN */
  background: #07c160;
  /* #endif */
  /* #ifdef H5 */
  background: #1890ff;
  /* #endif */
}
</style>
```

**常用条件**：

| 条件 | 含义 |
|---|---|
| `#ifdef H5` | H5 端 |
| `#ifdef APP-PLUS` | App 端（5+App / nvue） |
| `#ifdef MP` | 任何小程序 |
| `#ifdef MP-WEIXIN` | 微信小程序 |
| `MP-ALIPAY` | 支付宝小程序 |
| `MP-BAIDU` | 百度小程序 |
| `MP-TOUTIAO` | 字节跳动小程序 |
| `MP-QQ` | QQ 小程序 |
| `MP-LARK` | 飞书小程序 |
| `\|\|` 与 `&&` | `#ifdef H5 \|\| MP-WEIXIN`（注意：旧版本不支持 `&&`） |

**文件级条件编译**：`xxx.mp-weixin.vue`、`xxx.h5.js` 仅在对应端打包（注意维护成本）。

## 5. TypeScript 与语法规范

- **2.7+ 推荐**：可直接用 Composition API（Vue 2.7 内置），无需插件
- **2.6 项目**：用 `@vue/composition-api` 插件，或继续 Options API
- TypeScript 集成：
  - 2.7：原生支持 `<script lang="ts">`
  - 2.6：需 `vue-class-component` + `vue-property-decorator`（Class 写法）
- 优先 Options API（团队上手成本低、uni-app 文档示例都是 Options 风格）；新页面可用 Composition API
- 不混用 Class API 和 Options API，项目内统一一种
- 公共方法用 `export function` 而非 `mixin`（mixin 调试困难）
- ES Module 写法（`import` / `export`），不用 CommonJS

### Options API 范式（uni-app 主流）

```vue
<script>
import { mapState, mapActions } from 'vuex';

export default {
  name: 'UserProfile',
  data() {
    return {
      list: [],
      loading: false,
    };
  },
  computed: {
    ...mapState('user', ['userInfo']),
  },
  // 页面生命周期（仅页面组件可用，自定义组件不行）
  onLoad(options) {
    this.id = options.id;
    this.fetchData();
  },
  onShow() { /* ... */ },
  onPullDownRefresh() {
    this.fetchData();
  },
  methods: {
    ...mapActions('user', ['updateUser']),
    async fetchData() {
      this.loading = true;
      try {
        const res = await this.$api.user.getProfile(this.id);
        this.list = res.data;
      } catch (e) {
        uni.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        this.loading = false;
        uni.stopPullDownRefresh();
      }
    },
  },
};
</script>
```

### Composition API 范式（Vue 2.7+）

```vue
<script>
import { ref, onMounted } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';

export default {
  setup() {
    const list = ref([]);
    const loading = ref(false);
    const userStore = useUserStore();

    const fetchData = async (id) => {
      loading.value = true;
      try {
        const res = await uni.$api.user.getProfile(id);
        list.value = res.data;
      } finally {
        loading.value = false;
        uni.stopPullDownRefresh();
      }
    };

    onLoad((options) => {
      fetchData(options.id);
    });

    onPullDownRefresh(() => fetchData(currentId));

    return { list, loading, userInfo: userStore.userInfo };
  },
};
</script>
```

## 6. 架构与模式

### 状态管理：vuex 3 模块化

```javascript
// store/index.js
import Vue from 'vue';
import Vuex from 'vuex';
import user from './modules/user';
import cart from './modules/cart';

Vue.use(Vuex);

export default new Vuex.Store({
  modules: { user, cart },
});

// store/modules/user.js
const STORAGE_KEY = 'TOKEN';

export default {
  namespaced: true,
  state: () => ({
    token: uni.getStorageSync(STORAGE_KEY) || '',
    userInfo: null,
  }),
  mutations: {
    SET_TOKEN(state, token) {
      state.token = token;
      if (token) uni.setStorageSync(STORAGE_KEY, token);
      else uni.removeStorageSync(STORAGE_KEY);
    },
    SET_USER_INFO(state, info) {
      state.userInfo = info;
    },
  },
  actions: {
    async login({ commit }, { username, password }) {
      const res = await uni.$api.user.login({ username, password });
      commit('SET_TOKEN', res.data.token);
      commit('SET_USER_INFO', res.data.user);
    },
    logout({ commit }) {
      commit('SET_TOKEN', '');
      commit('SET_USER_INFO', null);
    },
  },
};
```

### HTTP 封装（uni.request 拦截器）

```javascript
// api/request.js
const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.example.com'
  : 'https://api-dev.example.com';

function request(options) {
  // 请求拦截
  const token = uni.getStorageSync('TOKEN');
  const header = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.header,
  };

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header,
      timeout: 15000,
      success: (res) => {
        // 响应拦截
        if (res.statusCode === 401) {
          uni.removeStorageSync('TOKEN');
          uni.reLaunch({ url: '/pages/login/login' });
          return reject(new Error('未登录'));
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (res.data.code === 0) resolve(res.data);
          else {
            uni.showToast({ title: res.data.message || '请求失败', icon: 'none' });
            reject(res.data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      },
      fail: (err) => reject(err),
    });
  });
}

export default {
  get: (url, data, options) => request({ url, method: 'GET', data, ...options }),
  post: (url, data, options) => request({ url, method: 'POST', data, ...options }),
  put: (url, data, options) => request({ url, method: 'PUT', data, ...options }),
  del: (url, data, options) => request({ url, method: 'DELETE', data, ...options }),
};

// api/user.js
import request from './request';

export default {
  login: (data) => request.post('/auth/login', data),
  getProfile: (id) => request.get(`/users/${id}`),
};

// main.js
import api from './api';
Vue.prototype.$api = api;
// 或挂到 uni 上：uni.$api = api;
```

### 全局组件：easycom（避免一一注册）

`pages.json` 中：

```json
{
  "easycom": {
    "autoscan": true,
    "custom": {
      "^u-(.*)": "uview-ui/components/u-$1/u-$1.vue",
      "^xyz-(.*)": "@/components/xyz-$1/xyz-$1.vue"
    }
  }
}
```

模板中直接用 `<u-button>`、`<xyz-card>`，无需手动 `import` + `components: {}`。

## 7. 性能、安全、可访问性

### 包大小（小程序首要约束）

- **微信小程序**：单个分包 ≤ 2MB，总和 ≤ 16MB；主包仅放首屏 + 必要依赖
- **支付宝小程序**：单分包 ≤ 4MB，总 ≤ 32MB
- **优化手段**：
  - 拆分 **subPackages**（次要功能/页面入分包）
  - 大图传 CDN 走 `<image src>` 而非 `static/` 内
  - **uni_modules** 按需引入（不要全量 `import 'uview-ui'`）
  - manifest.json 启用 `optimization.subPackages: true`、`mp-weixin.optimization.subPackages: true`
  - 开启 minify、terser
  - 字体仅打包用到的子集

### setData / 渲染性能（小程序）

- **避免高频 setData**：批量 `Object.assign` 后一次更新，不要循环里 setData
- 列表数据扁平化，避免深嵌套（小程序 setData 序列化开销）
- 长列表（>100 项）用 **uList / virtual-list / recycle-list**（uView 提供）
- 图片懒加载：`<image lazy-load>`
- 不在 `data` 里放大对象（10MB+ 直接 setData 会卡顿）；大对象放 `this.$options.bigData` 或 `Object.freeze`

### 通用性能

- 路由级懒加载在小程序端**不生效**（编译期合并），通过分包实现
- 减少 watch；用 computed 替代
- `v-for` 必须配 `:key`，用稳定 id
- 谨慎使用 `v-if` vs `v-show`（频繁切换用 `v-show`）

### 资源释放

- `onUnload` 中清除定时器、关闭 socket、移除事件监听
- `uni.$on` 必须配 `uni.$off`（以页面 hash 为 namespace）
- 动画用 `uni.createAnimation` 或 CSS3，避免 JS 高频 setData

### 安全

- 全部 HTTPS（小程序强制）
- token 存 `uni.setStorageSync`（小程序端没有 HttpOnly Cookie 概念）；不要明文存敏感 PII
- 接口签名：时间戳 + nonce + sign（防重放）
- **不要**信任前端校验，所有规则服务端校验
- 微信小程序：`request` 域名必须在 mp.weixin.qq.com 白名单
- 微信用户 openid 不要暴露给客户端日志

### 可访问性 / 用户体验

- 所有按钮用 `<button>` 或加 `hover-class` 提供反馈
- 表单输入提供 `placeholder` + 错误提示
- Loading 状态：`uni.showLoading` + `uni.hideLoading` 配对
- 网络错误：`uni.showToast({ icon: 'none' })`，避免阻断式 `showModal`
- Tab 切换 / 列表加载提供骨架屏（uView `u-skeleton`）

## 8. 反模式清单（明确禁止）

| ❌ 禁止 | ✅ 替代 |
|---|---|
| 用 `window`、`document`、`localStorage` | `uni.*` API（`uni.setStorageSync` 等） |
| `v-html` | `<rich-text :nodes="nodes">`（小程序也支持） |
| 全量 `import 'uview-ui'` | 按需 / easycom 自动加载 |
| 在 `<style>` 用通配符 `*` 或 `body` | 用具体类选择器 |
| 单个分包 > 2MB | 拆分包 + 大资源走 CDN |
| 循环里 `uni.request` | 用 `Promise.all` 并发 + 后端批量接口 |
| 循环里 `setData`（小程序） | 累积后一次性 `this.list = [...]` |
| `data` 里放大对象 + 频繁修改 | `Object.freeze` 或不响应式存（`this._cache`） |
| 数据放 `getApp().globalData` 滥用 | 优先 vuex；globalData 仅用启动配置 |
| 直接修改 vuex state | `commit('SET_X', val)` |
| 跨包 `@import` SCSS | 用 `uni.scss` 全局变量或独立打包 |
| 监听 `setInterval`/`setTimeout` 不清理 | `onUnload` 中清 |
| `uni.$on` 不配 `uni.$off` | 在 `onUnload` 中关闭 |
| 复杂参数走 URL query（>1KB） | 存 vuex / globalData / eventChannel |
| 在自定义组件里写 `onLoad`（无效） | 页面生命周期仅页面可用 |
| 直接修改 props | emit 事件让父级修改 |
| 多端混合写一个分支用 `process.env.PLATFORM` | 用条件编译 `#ifdef` |
| `v-for` 不写 `:key` 或用 `index` | 稳定唯一 id |
| 把 token 写到代码里测试 | 配 `manifest.json` 多环境 + EnvProvider |
| 同一组件文件超 500 行 | 拆子组件或 mixin |

## 9. 决策提示（when to use what）

**Options API vs Composition API**：
- 团队 Vue 2 经验深、维护遗留代码 → **Options API**（默认）
- 新页面、逻辑复用多、TS 项目 → **Composition API**（Vue 2.7+）
- 项目内统一一种风格

**vuex vs globalData vs storage**：
- 跨页面响应式状态 → **vuex 3**
- 启动期/全局只读配置 → **getApp().globalData**
- 持久化 → **uni.setStorageSync**（同步）/ 异步版（大数据）
- 跨进程通信（小程序）→ **eventChannel**（页面间）/ `uni.$emit`

**uView vs uni-ui vs Vant Weapp**：
- 跨端、组件丰富 → **uView 2.x**（默认）
- 官方维护、轻量 → **uni-ui**
- 仅微信小程序 → **Vant Weapp**（不要在多端项目用）
- 不混用，避免样式冲突

**uCharts vs ECharts**：
- 跨端（小程序 + H5 + App）→ **uCharts**（默认）
- 仅 H5/App，需求复杂 → **ECharts**
- 小程序复杂图表 → uCharts + Canvas 2D

**HBuilderX vs vue-cli + uni preset**：
- 小团队、零配置、一键发布 → **HBuilderX**
- 需要 CI/CD、自定义 webpack → **vue-cli** + `@dcloudio/uni-preset-vue`
- 同项目两人都能用，团队约定一种

**`easycom` vs 全局注册 vs 局部注册**：
- 命名前缀稳定的组件库（uView） → **easycom 自定义规则**
- 项目内常用业务组件 → easycom autoscan + 命名前缀
- 偶尔用一次的组件 → 局部 import + `components: {}`

**条件编译 vs 平台分文件**：
- 几行差异 → **条件编译** `#ifdef`
- 整个文件实现完全不同（如登录组件 H5 走表单 / 小程序走授权） → **xxx.mp-weixin.vue** 文件级
- 文件级编译维护成本高，能不用就不用

**`v-if` vs `v-show`**：
- 切换频率低、初始可能不显示 → `v-if`
- 频繁切换、必显示一次 → `v-show`
- tabBar 内容切换 → 用页面级而非组件 `v-if`

**`onLoad` vs `created` vs `mounted`**：
- 拿路由参数 → **onLoad**（仅页面）
- 数据初始化、监听事件 → `created`
- 操作 DOM/获取节点 → `mounted`（需要 ref）+ `$nextTick`

**何时拆分分包**：
- 主包接近 1.5MB → 立即拆分
- 单一业务线（订单、个人中心、客服） → 独立分包
- 低频访问页面 → 入分包
- 公共代码 → 主包或独立公共包

## 10. 测试

uni-app 测试支持有限，以下是务实的策略：

- **纯逻辑（utils、vuex actions）**：Jest + 普通 mock
- **组件单测**：@vue/test-utils 1.x（仅在 H5 模拟环境，行为可能与真实小程序不同）
- **E2E**：
  - 微信小程序：**miniprogram-automator**（官方）
  - H5：Cypress 9-10 / Playwright
  - App：手测为主，或用 Appium
- 覆盖率目标：核心 utils / api 层 ≥ 70%；UI 组件较低
- 在 CI 中至少跑：lint + tsc（如有 TS） + utils 层 jest

```javascript
// __tests__/api/request.test.js
import request from '@/api/request';

global.uni = {
  request: jest.fn(({ success }) =>
    success({ statusCode: 200, data: { code: 0, data: { id: 1 } } })),
  getStorageSync: jest.fn(() => 'fake-token'),
  showToast: jest.fn(),
};

test('request adds Authorization header', async () => {
  await request.get('/users/1');
  expect(uni.request).toHaveBeenCalledWith(
    expect.objectContaining({
      header: expect.objectContaining({ Authorization: 'Bearer fake-token' }),
    }),
  );
});
```

## 11. 工具链与交付

- **包管理**：**npm 6** 或 **yarn 1.x**（HBuilderX 内置 npm；CLI 项目用 yarn 也可）
- **依赖审查**：必须兼容 Vue 2 + uni-app 2.x；包发布时间不晚于 2022（避免要求 Vue 3 的库）
- **Lint**：ESLint + `eslint-plugin-vue@7` + `@vue/eslint-config-typescript`（TS 项目）
- **Format**：Prettier 2.x（注意 .vue 文件需要 prettier-plugin-vue）
- **类型检查**：TS 项目跑 `vue-tsc --noEmit`（vue 2.7） 或 `tsc --noEmit`
- **多环境**：通过 `manifest.json` + `package.json` 脚本切换：
  ```json
  {
    "scripts": {
      "dev:mp-weixin": "cross-env UNI_PLATFORM=mp-weixin VUE_APP_ENV=dev vue-cli-service uni-build --watch",
      "build:mp-weixin": "cross-env UNI_PLATFORM=mp-weixin VUE_APP_ENV=prod vue-cli-service uni-build",
      "dev:h5": "cross-env UNI_PLATFORM=h5 vue-cli-service uni-serve",
      "build:h5": "cross-env UNI_PLATFORM=h5 vue-cli-service uni-build"
    }
  }
  ```
- **CI**：lint → 构建（多端按需） → 上传产物 / 触发上传脚本
- **小程序发布**：
  - 微信：`miniprogram-ci`（npm 包）配 appid + 私钥实现自动上传
  - 支付宝：`alipay-mini-cli`
  - 字节：`tt-mp-cli`
- **App 发布**：HBuilderX 云打包或离线打包
- **OTA / 热更新**：仅 App（5+App）支持，通过 `plus.runtime.install` + 资源包；H5 直接刷新；小程序走平台审核
- **错误监控**：
  - H5/App：`@sentry/vue 6` + `@sentry/tracing 6`
  - 小程序：自封装 `App.onError` + `uni.request` 上报
- **性能监控**：微信小程序生态 `wx.reportPerformance`、`getPerformance`

## 12. 标准代码模板

### 页面（Options API）

```vue
<template>
  <view class="container">
    <view v-if="loading" class="loading">
      <u-loading mode="circle" />
    </view>
    <view v-else-if="error" class="error" @tap="fetchData">
      <text>{{ error }}，点击重试</text>
    </view>
    <view v-else>
      <view
        v-for="item in list"
        :key="item.id"
        class="row"
        hover-class="row-hover"
        @tap="goDetail(item.id)"
      >
        <text class="title">{{ item.title }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'ItemList',
  data() {
    return {
      list: [],
      loading: false,
      error: '',
      page: 1,
      pageSize: 20,
      hasMore: true,
    };
  },
  onLoad() {
    this.fetchData();
  },
  onPullDownRefresh() {
    this.page = 1;
    this.list = [];
    this.hasMore = true;
    this.fetchData();
  },
  onReachBottom() {
    if (this.hasMore && !this.loading) {
      this.page += 1;
      this.fetchData(true);
    }
  },
  methods: {
    async fetchData(append = false) {
      this.loading = true;
      this.error = '';
      try {
        const res = await this.$api.item.list({ page: this.page, pageSize: this.pageSize });
        this.list = append ? [...this.list, ...res.data.list] : res.data.list;
        this.hasMore = res.data.list.length === this.pageSize;
      } catch (e) {
        this.error = e.message || '加载失败';
      } finally {
        this.loading = false;
        uni.stopPullDownRefresh();
      }
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/detail/detail?id=${id}` });
    },
  },
};
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
  background-color: #f8f8f8;
  min-height: 100vh;
}
.row {
  padding: 24rpx 32rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
  &-hover {
    background: #f0f0f0;
  }
  .title {
    font-size: 28rpx;
    color: #333;
  }
}
.loading,
.error {
  display: flex;
  justify-content: center;
  padding: 64rpx 0;
}
</style>
```

### 通用组件

```vue
<template>
  <view class="card" :class="{ 'card-shadow': shadow }">
    <view v-if="title" class="card-title">{{ title }}</view>
    <view class="card-body">
      <slot />
    </view>
  </view>
</template>

<script>
export default {
  name: 'XyzCard',
  props: {
    title: { type: String, default: '' },
    shadow: { type: Boolean, default: true },
  },
};
</script>

<style lang="scss" scoped>
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  &-shadow {
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
  }
  &-title {
    font-size: 32rpx;
    font-weight: bold;
    margin-bottom: 16rpx;
  }
}
</style>
```

## 13. 行为约定（对 AI 的指令）

写代码时遵循：

1. **跨端兼容性第一**：每个 API、组件、样式都要确认目标端是否支持；遇到端差异主动用条件编译
2. **包大小敏感**：引入新依赖前必须考虑对主包/分包大小的影响
3. **先读后写**：修改前先读相关文件、`pages.json`、`manifest.json`，确认现有约定
4. **小步快跑**：每次修改后在主目标端运行验证；多端项目至少在 H5 + 微信小程序两端测
5. **不预先抽象**：YAGNI
6. **不删用户代码**：除非明确要求重构
7. **依赖谨慎**：引入新包前必须确认对 Vue 2 + uni-app 2.x 的兼容性（看 peerDeps、看包发布时间）
8. **不建议升级**：除非用户明确要求，不要建议升级到 uni-app 3 / Vue 3
9. **回答中文为主**，代码与标识符英文
10. **明确产出**：改完后总结：动了哪些文件、影响哪些端、怎么验证


