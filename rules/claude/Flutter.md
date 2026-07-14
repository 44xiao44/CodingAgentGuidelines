---
description: Flutter 3.22 + Dart 3.4 开发规范，覆盖架构、Riverpod 2.5、go_router 14、Material 3 与 Impeller
version: 1.0.0
globs: **/*.dart, pubspec.yaml, pubspec.lock, analysis_options.yaml
alwaysApply: false
---

# Flutter 3.22 / Dart 3.4 开发规范

> **目标版本**：Flutter **3.22.0**（2024 年 5 月发布的 stable，对应 Dart **3.4**）。本规则适用于 3.22.x 系列；3.10-3.19 大部分内容兼容，但部分 API 与 lint 略有差异，请按需调整。
>
> 触发条件：项目根存在 `pubspec.yaml` 且包含 `flutter:` 依赖；或编辑 `*.dart` 文件。

## 1. 角色与原则

你是一名资深 Flutter/Dart 工程师，遵循 Flutter 官方推荐架构与 Effective Dart。

**优先级**：正确性 > 可读性 > 简洁 > 性能（性能优化必须基于 DevTools 测量数据）。

**版本约束（必须遵守）**：
- Flutter **3.22.0**（建议补丁升到 3.22.3）
- Dart **3.4**（启用 records、patterns、sealed classes、class modifiers）
- 最低 iOS：12.0；最低 Android：API 21（Lollipop）
- Xcode **15+**；CocoaPods 1.13+
- Android Gradle Plugin 7.3+ / Gradle 7.5+；Java 17 toolchain

**默认技术栈（2024 年中主流）**：
- 状态管理：**Riverpod 2.5+**（含 `riverpod_generator`，强烈推荐 codegen） / **flutter_bloc 8.1+**（企业项目）
- 路由：**go_router 14.x**（含 `go_router_builder`，类型安全）
- 不可变模型：**freezed 2.5+** + **json_serializable 6+**
- 依赖注入：Riverpod Provider 优先；必要时 `get_it 7+`
- HTTP：**dio 5+**（默认） / `http 1.x`（简单场景）
- 持久化：
  - 偏好/简单 KV：`shared_preferences 2.x`
  - 加密 KV / 高性能：`flutter_secure_storage 9+`（敏感数据）
  - 结构化：`drift 2.x`（SQLite，类型安全）/ `isar 3.x`（NoSQL，性能优）
- 图片：`cached_network_image 3.x`
- 国际化：`flutter_localizations` + `intl 0.19+` + `.arb` 文件
- 渲染：**Impeller 默认**（iOS 全量；Android **opt-in**，需 `manifest.xml` 显式启用）
- UI：**Material 3 默认**（`useMaterial3: true`）
- 测试：`flutter_test`（内置） + **`mocktail 1.x`**（无 codegen） + `integration_test`
- Lint：**`flutter_lints 4.x`** 或更严格的 **`very_good_analysis 6.x`**
- Code gen：**`build_runner 2.4+`**（运行 `dart run build_runner build`）
- 错误监控：`sentry_flutter 8+` 或 Firebase Crashlytics
- CI：GitHub Actions / GitLab CI；本地 `melos`（多包仓库）

**Dart 3.4 可用特性（要充分利用）**：
- ✅ Records：`(int, String) record = (1, 'hello');`
- ✅ Patterns：`switch` 表达式 + 解构（`case (final x, _)`）
- ✅ Sealed classes / final classes / base classes（class modifiers）
- ✅ Switch 表达式（`final result = switch (x) { ... };`）
- ✅ `super.field` 在构造器（参数转发）
- ✅ Wildcard pattern `_`

**禁止使用**（与 3.22 不兼容、当时不稳定或被取代）：
- ❌ **Macros**（Dart 3.4 时仍是 experimental，不可用于生产）
- ❌ Riverpod 1.x（用 2.5+）
- ❌ Provider 5.x（用 Provider 6+；新代码推荐 Riverpod 替代）
- ❌ go_router 6.x 之前的旧版（用 14.x）
- ❌ `WillPopScope`（Flutter 3.16 起标记为 deprecated；用 `PopScope`）
- ❌ `ScaffoldMessenger.of(context).showSnackBar()` 之前的 `Scaffold.of(context).showSnackBar()`（旧 API）
- ❌ Flutter Web HTML renderer（默认 CanvasKit；3.22 也开始 Wasm 实验性支持）
- ❌ `RaisedButton` / `FlatButton` / `OutlineButton`（早已被 `ElevatedButton` 等取代）
- ❌ `useMaterial3: false`（默认开 M3，除非明确兼容老设计）

## 2. 项目结构（feature-first）

```
lib/
├── main.dart                       # main + flavor 入口
├── main_dev.dart                   # 多 flavor 入口
├── main_prod.dart
├── app.dart                        # MaterialApp.router 根
├── core/                           # 跨 feature 共享
│   ├── network/                    # dio client、拦截器、错误转换
│   ├── storage/                    # 本地存储抽象
│   ├── theme/                      # ThemeData (Material 3)
│   ├── router/                     # go_router 配置
│   ├── error/                      # 错误类型、ErrorBoundary
│   ├── analytics/                  # 埋点封装
│   └── utils/
├── features/
│   └── <feature_name>/
│       ├── data/
│       │   ├── models/             # API DTO（freezed）
│       │   ├── repositories/       # Repository 实现
│       │   └── services/           # 远程/本地数据源
│       ├── domain/                 # 仅复杂业务才需要
│       │   ├── entities/           # 领域模型
│       │   └── usecases/
│       └── presentation/           # 或 ui/
│           ├── providers/          # Riverpod providers / Notifiers
│           ├── screens/            # Screen / Page
│           └── widgets/            # feature 内部 widget
└── shared/
    └── ui/
        ├── core/                   # 共享 UI 组件
        └── design_system/          # 设计系统（按钮、字体、间距）
test/                               # 单元/widget 测试，镜像 lib/
integration_test/                   # 集成测试
```

**命名约定**：
- 文件：`snake_case.dart`（Effective Dart 强制）
- 类：`UpperCamelCase`，带架构后缀：`HomeNotifier`、`HomeScreen`、`UserRepository`、`AuthService`、`UserDto`、`User`（领域模型不带后缀）
- 常量/变量：`lowerCamelCase`；私有成员前缀 `_`
- 库 / package：`snake_case`
- Provider：`xxxProvider`（如 `homeNotifierProvider`）
- 不要使用与 SDK 同名的目录（如 `widgets/`、`material/`）；共享 widget 放 `shared/ui/core/`

## 3. 语法与风格规范

### 3.1 Effective Dart 精选

- 一律使用 `final` / `const`，仅在确需重新赋值时用 `var` / `late`
- 函数/方法显式声明返回类型，公共 API 必须类型显式
- 字符串用插值 `'$name'`，不用 `+` 拼接；多行用 `'''...'''` 或 `r'''...'''`
- 集合字面量优先：`<int>[]` 而非 `List<int>()`
- 空值处理：用 `?.`、`??`、`??=`，避免 `!`（除非已 100% 确认非空且写注释）
- 异步：`async/await`，避免 `then` 链；`Future<T>` 必须显式声明类型
- 错误处理：`try/catch` 配合自定义异常类；不要静默吞异常
- 日志：用 `package:logger` 或 `debugPrint`，禁止 `print`
- 文档注释 `///` 用于公共 API，普通 `//`
- 文件首行可写 `library` 声明（多文件 part 时必要）

### 3.2 Dart 3.4 现代写法

**Records（替代 tuple、二值返回）**：

```dart
// 命名记录
({int id, String name}) parseUser(String json) {
  return (id: 1, name: 'Tom');
}

final user = parseUser('...');
print(user.name); // Tom

// 位置记录
(int, String) divmod(int a, int b) => (a ~/ b, '$a%$b');
```

**Patterns + Switch 表达式**：

```dart
String describe(Object obj) => switch (obj) {
  int n when n > 0 => 'positive int $n',
  String s when s.isNotEmpty => 'string $s',
  List<int> [final first, ..., final last] => 'list from $first to $last',
  null => 'null',
  _ => 'unknown',
};

// 解构
final (id, name) = (1, 'Tom');
final {(:int id, :String name)} = parseUser('...');
```

**Sealed classes（替代手写 enum + 数据）**：

```dart
sealed class ApiResult<T> {}
final class Success<T> extends ApiResult<T> { final T data; Success(this.data); }
final class Failure<T> extends ApiResult<T> { final Object error; Failure(this.error); }

// 用 switch 时编译期穷尽性检查
String render(ApiResult<String> r) => switch (r) {
  Success(:final data) => 'Got $data',
  Failure(:final error) => 'Error: $error',
};
```

**Class modifiers（明确设计意图）**：
- `final class`：禁止外部继承（库内 OK）
- `base class`：必须被继承使用
- `sealed class`：所有子类必须在同库（编译期穷尽）
- `interface class`：仅可作为接口实现

## 4. 架构与设计模式

### 4.1 分层

UI 层 ←→ Notifier（ViewModel） ←→ Repository ←→ Service（API/DB）

- **Widget 必须保持"哑"**：只接收数据、触发回调；不做网络/持久化/复杂计算
- **Notifier**（Riverpod）持有 UI 状态、暴露方法给 View 调用、调用 Repository
- **Repository** 是数据真相源，封装多个 Service；用抽象接口便于测试替换
- **Service** 是与外部世界（HTTP、数据库、平台通道）的薄封装

### 4.2 数据流：单向

UI 事件 → Notifier 方法 → Repository → 数据源 → 返回不可变状态 → Notifier 通知 → UI 重建

### 4.3 状态管理：Riverpod 2.5+ 范式（推荐 codegen）

```dart
// home_state.dart
import 'package:freezed_annotation/freezed_annotation.dart';
part 'home_state.freezed.dart';

@freezed
class HomeState with _$HomeState {
  const factory HomeState({
    @Default(false) bool isLoading,
    @Default([]) List<Item> items,
    String? error,
  }) = _HomeState;
}

// home_notifier.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'home_state.dart';
part 'home_notifier.g.dart';

@riverpod
class HomeNotifier extends _$HomeNotifier {
  @override
  Future<HomeState> build() async {
    final repo = ref.watch(itemRepositoryProvider);
    final items = await repo.fetchItems();
    return HomeState(items: items);
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(itemRepositoryProvider);
      final items = await repo.fetchItems();
      return HomeState(items: items);
    });
  }
}
```

> 启用 codegen：`pubspec.yaml` 中加 `riverpod_generator` + `build_runner`，然后 `dart run build_runner watch -d`。如不用 codegen，手写 `AsyncNotifierProvider<HomeNotifier, HomeState>(HomeNotifier.new)` 也可。

### 4.4 路由：go_router 14.x

```dart
// core/router/app_router.dart
import 'package:go_router/go_router.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isLoggedIn = ref.read(authNotifierProvider).valueOrNull?.isLoggedIn ?? false;
      final isLoginRoute = state.matchedLocation == '/login';
      if (!isLoggedIn && !isLoginRoute) return '/login';
      if (isLoggedIn && isLoginRoute) return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (_, __) => const HomeScreen(),
        routes: [
          GoRoute(
            path: 'items/:id',
            builder: (_, state) => ItemDetailScreen(id: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    ],
  );
});
```

**强约定**：
- 集中配置在 `core/router/app_router.dart`
- 鉴权用 `redirect` 函数，**不要**散在各 Screen 的 `initState`
- 用 `go_router_builder` 生成类型安全路由（中大型项目强烈推荐）
- Deep link 通过 `redirect` 处理鉴权拦截
- **不要**直接 `Navigator.push`（除非纯展示型对话框/弹窗）

### 4.5 Repository 范式

```dart
abstract interface class ItemRepository {
  Future<List<Item>> fetchItems();
  Future<Item> getItem(String id);
}

class ItemRepositoryImpl implements ItemRepository {
  ItemRepositoryImpl(this._api);
  final ItemApiService _api;

  @override
  Future<List<Item>> fetchItems() async {
    try {
      final dtos = await _api.getItems();
      return dtos.map((e) => e.toDomain()).toList();
    } on DioException catch (e, st) {
      throw ItemFetchException(e.message ?? 'unknown', st);
    }
  }

  @override
  Future<Item> getItem(String id) async => /* ... */ throw UnimplementedError();
}

@riverpod
ItemRepository itemRepository(ItemRepositoryRef ref) =>
    ItemRepositoryImpl(ref.watch(itemApiServiceProvider));
```

### 4.6 主题（Material 3）

```dart
final lightTheme = ThemeData(
  useMaterial3: true,                     // 必须 true（3.16+ 默认）
  colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
  textTheme: GoogleFonts.notoSansTextTheme(),
);

final darkTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo, brightness: Brightness.dark),
);
```

## 5. 性能、安全、可访问性

### 5.1 性能

- **静态 widget 必须 `const`**（避免 rebuild）
- 长列表用 `ListView.builder` / `SliverList`，**禁止**把整个列表塞进 `Column`
- 复杂子树用 `RepaintBoundary` 隔离重绘
- 避免在 `build()` 内做计算/分配；耗时计算放到 `compute()` 或 isolate
- 谨慎使用 `Opacity`、`ClipPath`、`BackdropFilter`（合成开销大）
- 图片：`cached_network_image` + 指定 `cacheWidth` / `cacheHeight`（按显示尺寸缩放，节省内存）
- **Impeller**：iOS 全量启用；Android opt-in（在 `AndroidManifest.xml` 加 `<meta-data android:name="io.flutter.embedding.android.EnableImpeller" android:value="true" />`）—— 测试稳定后再上生产
- 用 **DevTools Performance** 抓帧；用 **Memory** tab 检查内存泄漏

### 5.2 资源释放

- `StatefulWidget` 的 `dispose()` 中关闭：
  - `StreamSubscription` / `StreamController`
  - `AnimationController`
  - `TextEditingController` / `FocusNode` / `ScrollController`
  - 自定义 `Timer`
- Riverpod Notifier 的资源清理用 `ref.onDispose(() { ... })`

### 5.3 安全

- 全部 HTTPS；敏感 API 启用证书钉扎（dio 配 `BadCertificateCallback` + 公钥校验）
- 敏感数据（token、密钥、生物数据）用 **`flutter_secure_storage`**，**禁止** `SharedPreferences`
- 生产构建启用 `flutter build --obfuscate --split-debug-info=build/symbols`
- 用户输入做服务端校验，本地仅做 UX 校验
- 禁止把密钥硬编码到代码或 `pubspec.yaml`；用 `flutter_dotenv` 或 `--dart-define-from-file=env.json`
- WebView 内容必须做 url allowlist；不要开 `javaScript: true` 不必要

### 5.4 可访问性

- 交互元素提供 `Semantics(label: ...)` 或 `Tooltip`
- 颜色对比度 ≥ 4.5:1，不依赖颜色单一表达信息
- 支持系统字号（`MediaQuery.textScaler`，**不要**写死 `textScaleFactor`）
- 表单字段配 `labelText` 与错误提示
- 用 **Flutter Inspector → Show Accessibility Hints** 检查

## 6. 反模式清单（明确禁止）

| ❌ 禁止 | ✅ 替代 |
|---|---|
| 在 Widget 的 `build()` 里发起网络请求 | 移到 Notifier；用 `FutureProvider` / `AsyncNotifier` |
| 在 Widget 内写业务逻辑（计算、转换、校验） | 抽到 Notifier 或纯函数 |
| 全局 `static` 可变状态、全局单例 | Riverpod Provider 注入 |
| 跨 async gap 直接使用 `BuildContext` | `if (!context.mounted) return;` 检查 |
| `setState(() {})` 嵌套很深的 StatefulWidget | 拆分 Widget 或迁移到 Riverpod |
| 用 `!` 强解空 | `?.`、`??`、模式匹配、`required` 参数 |
| `pubspec.yaml` 用 `any` 或不带版本约束 | `^x.y.z` 约束次版本 |
| 直接 `print()` | `debugPrint()` 或 `logger` |
| 硬编码颜色/字号/字符串 | `Theme.of(context)` + ColorScheme + intl/arb |
| 把所有 widget 堆在一个 build 里几百行 | 拆 `_buildXxx()` 私有方法或独立 Widget 类 |
| 在 `initState` 里直接 `await` | `WidgetsBinding.instance.addPostFrameCallback` 或 Notifier 内 |
| 直接修改 List/Map 状态 | freezed 的 `copyWith` 生成新实例 |
| 用 `Future.delayed` 模拟轮询 | `Stream.periodic` 或 `Timer.periodic` |
| 给所有 widget 加 `Key` | 仅在列表项、需保留状态、动画切换时加 |
| `WillPopScope` | `PopScope`（3.16+） |
| `useMaterial3: false`（无明确理由） | 用 M3，迁移老设计 |
| 同时使用 Riverpod 和 BLoC | 选一种，跨整个项目 |
| 在 main.dart 里直接 `runApp(MaterialApp(home: ...))` 没 ProviderScope | `runApp(ProviderScope(child: const MyApp()))` |
| `MediaQuery.of(context).size` 用于响应式断点 | `LayoutBuilder` + `BoxConstraints` |
| 在多个 widget 里重复 `Theme.of(context).colorScheme.primary` | 抽到设计系统常量 |
| 滥用 `Builder` 或多层嵌套 `Consumer` | `ConsumerWidget` 或 `ConsumerStatefulWidget` |
| Riverpod 中 `ref.read` 在 `build` 方法内 | 用 `ref.watch` 才能响应变更 |
| 手写 `==` 和 `hashCode` | 用 freezed |
| 日志带敏感信息（token、密码） | 脱敏后再 log |
| `import` 用相对路径混合 package 路径 | 统一 `package:my_app/...` |

## 7. 决策提示（when to use what）

**StatelessWidget vs StatefulWidget vs ConsumerWidget vs ConsumerStatefulWidget**：
- 无可变状态、无 Riverpod 依赖 → `StatelessWidget`
- 仅本地 UI 状态（动画、输入控制器） → `StatefulWidget`
- 需要消费 Riverpod Provider → `ConsumerWidget`
- 同时有本地状态 + Riverpod → `ConsumerStatefulWidget`

**Riverpod Provider 类型选择**：
- 静态依赖（service、配置） → `Provider`
- 一次性异步加载（仅读取） → `FutureProvider`
- 持续推送（WebSocket、Firestore） → `StreamProvider`
- 同步可变状态 + 方法 → `NotifierProvider`
- 异步可变状态 + 方法 → `AsyncNotifierProvider`（**最常用**）
- 配合 family（参数化） → `xxxProvider.family<R, A>`
- 自动释放（路由切换释放）→ `.autoDispose`

**Riverpod codegen vs 手写**：
- 中大型项目 → **codegen**（`@riverpod` 注解，类型自动推导）
- 小项目 / 快速原型 → 手写 `AsyncNotifierProvider<X, Y>(X.new)`
- 代码生成需要 `build_runner` watch 跑着，性能开销小

**Riverpod 2 vs flutter_bloc 8**：
- 默认 → **Riverpod**（API 简洁、可组合）
- 强需要单向数据流（事件/状态严格分离）/ 严格审计 → **BLoC**
- 团队已熟练 BLoC → 保留 BLoC，不要混用

**何时拆 Widget**：
- 单个 build 方法超 ~80 行
- 同一段 UI 在 ≥2 处复用
- 子树有独立状态（应该拆 StatefulWidget）
- 需要 `const` 优化但被父级动态参数污染（拆出独立 const widget）

**何时引入 Domain 层（usecase）**：
- Notifier 中相同业务逻辑出现 ≥3 次
- 业务规则跨多个 Repository
- 否则不要预先引入，YAGNI

**API DTO vs Domain Model 是否分离**：
- 大型项目（≥10 个 feature）或 API 字段经常变 → 分离
- 小型项目 → 直接用 freezed 模型同时承担两个角色

**`http` vs `dio`**：
- 简单 GET/POST、无拦截器需求 → `http`
- 需要拦截器、超时、取消、文件上传进度、统一错误处理 → **`dio`**（默认）

**`shared_preferences` vs `flutter_secure_storage` vs `drift` vs `isar`**：
- 用户偏好、轻量 KV → `shared_preferences`
- 敏感数据（token、密钥） → `flutter_secure_storage`
- 关系数据、复杂查询、迁移 → **`drift`**（SQLite + 类型安全）
- NoSQL、性能极致、对象持久化 → **`isar`**

**列表组件**：
- 静态、≤20 项 → `Column` + `SingleChildScrollView`
- 动态长列表 → `ListView.builder`
- 配合 sliver / appbar 联动 → `CustomScrollView` + `SliverList`
- 无限滚动 → `ListView.builder` + `controller.addListener` 检测底部

**响应式布局**：
- 简单单一断点 → `MediaQuery.sizeOf(context)` 直接判断
- 多断点、多端 → `LayoutBuilder` + 自定义断点常量
- 大屏适配 → `flutter_adaptive_scaffold`（Material 3 官方）

**动画方案**：
- 简单 → `AnimatedContainer` / `Animated*` 隐式动画
- 中等 → `TweenAnimationBuilder`
- 复杂/多阶段 → `AnimationController` + `AnimatedBuilder`
- 物理效果 → `SpringSimulation` 等
- 极复杂、需要时间轴控制 → `flutter_animate`（社区库）

**Material 3 vs Cupertino vs 自定义**：
- 跨平台一致 + 安卓为主 → **Material 3**
- iOS 为主 + 想看起来像原生 → `CupertinoApp` + Cupertino 组件
- 强品牌设计 → 自定义 ThemeExtension

**网络错误处理统一策略**：
- dio interceptor 统一捕获并转换为业务异常类型
- Repository 层接住业务异常，返回 `Result<T, Failure>` 或抛出
- UI 层只关心 `AsyncValue.error`，统一渲染

## 8. 测试

- **单元测试**：所有 Repository、Service、Notifier 必须有；覆盖率目标 ≥ 70%
- **Widget 测试**：每个 Screen 至少有"渲染 + 关键交互"用例
- **集成测试**：核心用户流程（登录、下单等）用 `integration_test`
- 测试目录镜像 `lib/`：`test/features/home/presentation/home_notifier_test.dart`
- 用 **`mocktail`** 优于 `mockito`（无需 codegen）
- 优先 **fake 实现** 而非 mock；让 Repository 抽象类生成 fake 子类

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FakeItemRepository implements ItemRepository {
  final List<Item> fakeItems = [Item(id: '1', name: 'A')];

  @override
  Future<List<Item>> fetchItems() async => fakeItems;
  @override
  Future<Item> getItem(String id) async => fakeItems.first;
}

void main() {
  test('build loads items from repository', () async {
    final repo = FakeItemRepository();
    final container = ProviderContainer(overrides: [
      itemRepositoryProvider.overrideWithValue(repo),
    ]);
    addTearDown(container.dispose);

    final state = await container.read(homeNotifierProvider.future);
    expect(state.items, hasLength(repo.fakeItems.length));
  });
}
```

**Widget 测试要点**：
- 用 `tester.pumpWidget` + `ProviderScope(overrides: [...])` 注入 fake
- 用 `find.byType` / `find.byKey` 选择元素
- 异步用 `await tester.pumpAndSettle()`

## 9. 工具链与交付

- **包管理**：`flutter pub get`；新增依赖前看 pub.dev **score ≥ 130** 且最近发版 ≤ 6 个月
- **静态检查**：`analysis_options.yaml` 必须存在并启用 `flutter_lints` 或更严格规则
- **格式化**：CI 强制 `dart format --set-exit-if-changed .`
- **分析**：CI 强制 `dart analyze --fatal-warnings`
- **代码生成**：`dart run build_runner build --delete-conflicting-outputs`（CI 跑一次，开发期 watch 模式）
- **Flavor**：必须区分 `dev`/`staging`/`prod`，对应不同 bundle id 和 API endpoint
  - 入口：`main_dev.dart` / `main_prod.dart`
  - 命令：`flutter run --flavor dev -t lib/main_dev.dart`
- **构建命令**：
  - Android 发布：`flutter build appbundle --flavor prod -t lib/main_prod.dart --release --obfuscate --split-debug-info=build/symbols`
  - iOS：`flutter build ipa --flavor prod -t lib/main_prod.dart --release --obfuscate --split-debug-info=build/symbols`
  - Web（CanvasKit 默认）：`flutter build web --release`
  - Web（Wasm，3.22 stable）：`flutter build web --wasm`
- **CI 三件套**：format check → analyze → test，全部通过方可合并
- **错误上报**：生产接入 `sentry_flutter 8+` 或 Firebase Crashlytics；同时捕获：
  - `FlutterError.onError`
  - `PlatformDispatcher.instance.onError`
- **国际化**：`flutter_localizations` + `intl 0.19+`，文案放 `.arb`，CI 跑 `flutter gen-l10n`
- **多包仓库**（monorepo）：用 `melos 3+` 管理依赖与脚本

## 10. 标准代码模板

### 10.1 Notifier + Repository（codegen）

```dart
// home_notifier.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
part 'home_notifier.g.dart';

@riverpod
class HomeNotifier extends _$HomeNotifier {
  @override
  Future<List<Item>> build() async {
    final repo = ref.watch(itemRepositoryProvider);
    return repo.fetchItems();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(itemRepositoryProvider);
      return repo.fetchItems();
    });
  }
}

@riverpod
ItemRepository itemRepository(ItemRepositoryRef ref) {
  return ItemRepositoryImpl(ref.watch(dioProvider));
}
```

### 10.2 ConsumerWidget Screen

```dart
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(homeNotifierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: state.when(
        data: (items) => ListView.builder(
          itemCount: items.length,
          itemBuilder: (_, i) => ListTile(
            title: Text(items[i].name),
            onTap: () => context.push('/items/${items[i].id}'),
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, st) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Error: $e'),
              ElevatedButton(
                onPressed: () => ref.read(homeNotifierProvider.notifier).refresh(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

### 10.3 main.dart 范本

```dart
// main_prod.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SentryFlutter.init(
    (opts) {
      opts.dsn = const String.fromEnvironment('SENTRY_DSN');
      opts.environment = 'prod';
      opts.tracesSampleRate = 0.2;
    },
    appRunner: () => runApp(const ProviderScope(child: MyApp())),
  );
}

// app.dart
class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'My App',
      theme: lightTheme,
      darkTheme: darkTheme,
      themeMode: ThemeMode.system,
      routerConfig: router,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}
```

## 11. 行为约定（对 AI 的指令）

写代码时遵循：

1. **版本约束第一**：所有建议必须能在 Flutter 3.22 + Dart 3.4 上运行；不主动建议升级 Flutter；不要使用 Macros 等实验性特性
2. **先读后写**：修改前先读 `pubspec.yaml`、`analysis_options.yaml`、相关文件，匹配项目已有风格
3. **小步快跑**：每次修改后跑 `dart analyze` 与 `flutter test`，绿了再继续
4. **不预先抽象**：不要为可能的需求预留扩展点；YAGNI
5. **不删用户代码**：除非明确要求重构，保留原有结构
6. **依赖谨慎**：引入新包前必须解释原因和 pub.dev 评分；优先选 stable + 最近发版
7. **充分用 Dart 3**：用 records、patterns、sealed classes 替代过去的笨重写法
8. **回答中文为主**，代码与标识符英文
9. **明确产出**：改完后总结：动了哪些文件、为什么、怎么验证（analyze / test / 真机）

