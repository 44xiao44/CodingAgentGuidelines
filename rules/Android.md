---
description: Android Kotlin 1.7 + JDK 17 + Java/Kotlin 混合开发规范，覆盖互操作、架构、Compose 与 View 共存
version: 1.0.0
globs: **/*.kt, **/*.kts, **/*.java, **/AndroidManifest.xml, **/*.gradle, **/*.gradle.kts, **/libs.versions.toml, **/proguard-rules.pro
alwaysApply: false
---

# Android（Kotlin 1.7 + JDK 17 + Java/Kotlin 混合）开发规范

> **目标版本**：Kotlin **1.7.0**（建议补丁升到 1.7.20）+ **JDK 17** + Android Gradle Plugin **7.3+**。本规范专门面向 Java/Kotlin 混合代码库（典型场景：老 Java 项目渐进迁移到 Kotlin）。
>
> 触发条件：项目根存在 `settings.gradle(.kts)` + `build.gradle(.kts)`，且 `app/build.gradle*` 中含 `org.jetbrains.kotlin` 插件，或 `src/main/java` 与 `src/main/kotlin` 同时存在。

## 1. 角色与原则

你是一名资深 Android 工程师，工作在 **Kotlin 1.7 + JDK 17** 的 Java/Kotlin 混合项目上。**新代码用 Kotlin**，但**不要**主动改写已有可用 Java 代码（除非用户要求）。所有跨语言接口必须保证两端调用流畅。

**优先级**：互操作正确性 > 二进制兼容性 > 安全 > 可读性 > 性能（性能优化基于 Profiler 数据）。

**版本约束（必须遵守）**：
- Kotlin **1.7.0**（推荐 1.7.10 / 1.7.20 拿 bug fix）
- Compose Compiler 版本必须**严格匹配** Kotlin：
  - Kotlin 1.7.0 → Compose Compiler **1.2.0**
  - Kotlin 1.7.10 → Compose Compiler **1.3.0**
  - Kotlin 1.7.20 → Compose Compiler **1.3.2**（推荐）
- JDK **17**（toolchain）；source/targetCompatibility 通常仍设 **11**（Android runtime 兼容性更好）；jvmTarget 设 **11** 或 **17**（统一）
- Android Gradle Plugin **7.3.x**（首个稳定支持 JDK 17）/ Gradle **7.5+**
- compileSdk **33**（Android 13）；targetSdk 33；minSdk **21+**（推荐 24）
- Java 源码：可用 text blocks（JDK 15+），**不要**用 records / sealed classes（Android runtime 不支持）/ pattern matching for switch（preview）

**默认技术栈（2022 中下半年 Kotlin 1.7 时代）**：
- 异步：**Coroutines 1.6.4** + **Flow / StateFlow**（替代 LiveData）；老 Java 模块允许保留 **RxJava 3** + Retrofit 2 RxJavaCallAdapter
- DI：**Hilt 2.43-2.44**（Dagger Hilt）；多模块项目用 Hilt + ViewModelComponent
- 架构：**MVVM**（ViewModel + UI State + Repository）+ **Clean Architecture**（UI / Domain / Data 三层）
- 路由：**Navigation 2.5.x**（含 Compose Navigation）
- 数据：**Room 2.4.x** + **DataStore 1.0.x**（替代 SharedPreferences）
- 网络：**Retrofit 2.9.x** + **OkHttp 4.10.x** + **Moshi 1.13** 或 **kotlinx.serialization 1.4**
- 图片：**Coil 2.2.x**（Kotlin-first，Compose 友好）；Java 模块兼容 **Glide 4.13+**
- UI：**View System** + **Jetpack Compose 1.2/1.3**（混合渐进迁移）；Compose 仅在新页面/组件
- ViewBinding：所有 View 系统页面必启用（替代 findViewById、DataBinding）
- 列表：**RecyclerView** + **ListAdapter** + **DiffUtil**；Compose 端用 **LazyColumn**
- 后台任务：**WorkManager 2.7.x**
- 错误监控：**Firebase Crashlytics** 或 **Sentry SDK 6.x**
- 注解处理：优先 **KSP 1.0.6+**（Kotlin Symbol Processing）；不支持 KSP 的库才用 **kapt**
- 测试：**JUnit 4** + **MockK 1.12** + **Robolectric 4.8** + **Espresso 3.4** + **Compose UI Test 1.2/1.3**
- Lint：**Android Lint** + **ktlint 0.46.1** + **detekt 1.21.x**
- 构建脚本：**Kotlin DSL**（`build.gradle.kts`） + **Version Catalogs**（`gradle/libs.versions.toml`）
- 多模块：通过 `buildSrc/` 或 `build-logic/` 共享构建约定

**禁止使用**（与 Kotlin 1.7 / JDK 17 / Android 不兼容或当时不存在）：
- ❌ Kotlin 1.8+ 特性：`data object`（1.9）、`enum entries`（1.9）、`@OptIn` 模块级（1.9）、context receivers stable（1.9 还是 experimental）
- ❌ Kotlin 2.0+：K2 编译器、Compose Compiler 由 Kotlin 仓库直接发布、新版 `dataObject`
- ❌ Java 17 在 Android 上不可用的特性：**records**（runtime 不支持）、**sealed classes (Java)**（runtime 不支持）、**pattern matching for switch**（preview）
- ❌ AGP 8.x（要求 Gradle 8.0+，且对老 Java 8 有破坏性变更）
- ❌ Compose 1.4+ 特性（如 `LazyStaggeredGrid` 稳定版）
- ❌ Hilt + ViewModel KMP 组合
- ❌ 直接用 `BuildConfig.DEBUG` 控制 R8 行为（用 build types 配置）

## 2. 项目结构（多模块）

```
项目根/
├── settings.gradle.kts             # 模块声明 + 依赖仓库
├── build.gradle.kts                # 顶层（仅声明 plugins，不含具体配置）
├── gradle/
│   └── libs.versions.toml          # ⭐ 版本目录（依赖统一管理）
├── build-logic/                    # 或 buildSrc/，共享构建约定（Convention Plugins）
│   └── convention/
│       ├── build.gradle.kts
│       └── src/main/kotlin/
│           ├── AndroidApplicationConventionPlugin.kt
│           ├── AndroidLibraryConventionPlugin.kt
│           └── KotlinConventionPlugin.kt
├── app/                            # Application 模块
│   ├── build.gradle.kts
│   └── src/main/...
├── core/                           # 跨 feature 共享
│   ├── common/                     # 工具、扩展函数、常量
│   ├── network/                    # Retrofit / OkHttp 配置
│   ├── database/                   # Room
│   ├── datastore/                  # DataStore
│   ├── designsystem/               # 主题、Compose 设计系统
│   ├── ui/                         # 共享 UI 组件（View + Compose）
│   └── domain/                     # UseCase 公共
├── feature/                        # 业务模块（按特性切分）
│   ├── home/
│   ├── auth/
│   ├── profile/
│   └── order/
└── data/                           # 数据层模块（可选拆分）
    ├── repository/
    └── remote/

# 模块内部结构
feature/home/
└── src/main/
    ├── AndroidManifest.xml
    ├── java/com/company/feature/home/      # Java 源（遗留）
    └── kotlin/com/company/feature/home/    # Kotlin 源（新代码）
        ├── data/
        ├── domain/
        ├── ui/
        │   ├── HomeScreen.kt              # Compose
        │   ├── HomeFragment.kt            # View 系统
        │   ├── HomeViewModel.kt
        │   └── HomeUiState.kt
        └── di/
            └── HomeModule.kt              # Hilt
```

> **关于 java/ vs kotlin/ 目录**：Android 默认 `src/main/java` 同时识别 `.java` 和 `.kt`。**建议**新建 `src/main/kotlin` 专门放 Kotlin 源，`src/main/java` 仅留 Java 源，便于团队认知边界。两个目录在编译时合并为同一 source set，**包名应保持一致**（不要因目录不同而分包）。

**命名约定**：
- Kotlin 文件：`PascalCase.kt`，类名与文件名一致；扩展函数文件 `XxxExt.kt`
- Java 文件：`PascalCase.java`，与类名严格一致
- 模块名：`kebab-case`（`feature-home`、`core-network`）；模块内部包名 `com.company.feature.home`
- 资源 ID：模块前缀避免冲突（`feature_home_btn_login`）
- ViewBinding 生成的类：`<LayoutName>Binding`（如 `FragmentHomeBinding`）
- Compose @Composable：`PascalCase`，状态参数命名 `xxxState`
- ViewModel：`<Feature>ViewModel`
- UseCase：`<Action><Object>UseCase`（如 `GetUserProfileUseCase`）
- Repository：`<Object>Repository` + `<Object>RepositoryImpl`

## 3. Java/Kotlin 混合互操作规范 ⭐

> 这是本规范的**核心章节**。所有跨语言调用都必须遵守，否则会出现 NullPointerException、API 不友好、二进制不兼容等问题。

### 3.1 Kotlin → Java：让 Kotlin API 对 Java 友好

| 场景 | Kotlin 写法 | Java 调用 | 修正建议 |
|---|---|---|---|
| `companion object` 中的方法 | `companion object { fun foo() }` | `MyClass.Companion.foo()` ❌ 啰嗦 | 加 `@JvmStatic` → `MyClass.foo()` |
| `companion object` 中的常量 | `companion object { const val X = 1 }` | OK | `const val` 即生效 |
| `companion object` 普通字段 | `companion object { val x = "hi" }` | `MyClass.Companion.getX()` ❌ | 加 `@JvmField` → `MyClass.x` |
| 顶层函数 | `// File: Utils.kt`<br>`fun trim(s: String) {}` | `UtilsKt.trim(s)` ❌ | 文件顶 `@file:JvmName("Utils")` → `Utils.trim(s)` |
| 默认参数 | `fun greet(name: String = "World")` | 必须传所有参数 ❌ | 加 `@JvmOverloads` 生成重载 |
| `Throws` 声明 | `fun load(): String` | Java 不知道会抛 IOException | 加 `@Throws(IOException::class)` |
| 属性 → getter/setter 命名 | `var isVisible: Boolean` | `getIsVisible()` / `setIsVisible(b)` | Kotlin 编译器对 `is*` 前缀做特殊处理：变成 `isVisible()` / `setVisible(b)` |
| 平台类型暴露 | `fun get(): String` | Java 看到 `String`（非 null） | 用 `@Nullable` 或 `String?` 明确 |

**Kotlin 端示例（对 Java 友好的写法）**：

```kotlin
// File: StringUtils.kt
@file:JvmName("StringUtils")
@file:JvmMultifileClass

package com.company.core.common

@JvmOverloads
fun formatName(first: String, last: String = "") = "$first $last".trim()

class FeatureFlags {
    companion object {
        @JvmStatic
        fun isEnabled(key: String): Boolean = /* ... */ false

        @JvmField
        val DEFAULT_TIMEOUT_MS: Long = 5_000
    }
}

// 数据类对 Java 友好
data class User(
    @JvmField val id: Long,
    @JvmField val name: String,
)
```

**Java 调用**：
```java
String s = StringUtils.formatName("Tom");                  // 默认参数
boolean enabled = FeatureFlags.isEnabled("preview");       // @JvmStatic 直调
long t = FeatureFlags.DEFAULT_TIMEOUT_MS;                  // @JvmField 直访问
User u = new User(1L, "Tom");
String name = u.name;                                      // @JvmField，无需 getName()
```

### 3.2 Java → Kotlin：在 Kotlin 中正确处理 Java 返回值

| 问题 | 风险 | 修正 |
|---|---|---|
| Java 方法返回 `String`（无 `@Nullable` / `@NonNull`） | Kotlin 看到**平台类型** `String!`，可能 NPE | Java 端加 **AndroidX `@Nullable` / `@NonNull`** 注解；Kotlin 端用 `String?` 接收并显式判 |
| Java 集合 `List<String>` | 不可变性丢失 | Kotlin 端如要修改用 `MutableList`，否则用 `List` |
| Java SAM 接口 | Kotlin 1.4+ 支持 SAM 转换 | 直接传 lambda：`view.setOnClickListener { /* ... */ }` |
| Java checked exception | Kotlin 不强制 catch | 仍要处理；用 `try/catch` 或 `runCatching` |
| Java 数组 `String[]` | Kotlin 是 `Array<String>` | 转换：`array.toList()` |

**Java 端建议（提升 Kotlin 端体验）**：
```java
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public class LegacyService {
    @NonNull
    public String getName() { return "Tom"; }

    @Nullable
    public User findUser(long id) { return /* ... */ null; }

    public void register(@NonNull Listener listener) { /* ... */ }
}
```

**Kotlin 端调用**：
```kotlin
val name: String = service.getName()            // 非 null
val user: User? = service.findUser(1L)          // 可空
service.register { event -> /* SAM 转换 */ }
```

### 3.3 Coroutines / 异步在边界

- **suspend function 不能直接被 Java 调用**（编译后多了 `Continuation` 参数）
- 三种桥接方案：
  1. **回调适配**：在 Kotlin 端写 `fun loadAsync(callback: Callback)` 包装 suspend 函数
  2. **`@JvmStatic` + RxJava**：用 `kotlinx-coroutines-rx3` 互转 → `flow.asObservable()`
  3. **`Future` 适配**：用 `kotlinx-coroutines-jdk8` → `future { ... }` 返回 `CompletableFuture`

```kotlin
// Kotlin 端给 Java 用的回调式 API
class UserRepository @Inject constructor(
    private val scope: CoroutineScope,
) {
    suspend fun getUser(id: Long): User = /* ... */ TODO()

    fun getUserAsync(id: Long, callback: Callback<User>) {
        scope.launch {
            try {
                callback.onSuccess(getUser(id))
            } catch (e: Throwable) {
                callback.onError(e)
            }
        }
    }

    interface Callback<T> {
        fun onSuccess(value: T)
        fun onError(error: Throwable)
    }
}
```

### 3.4 Sealed class / Data class 在 Java 端

- **Sealed class**（Kotlin）→ Java 看不到 sealed 修饰；Java 端 `switch`/`if` 不会获得穷尽性检查
- **Data class** → Java 端可调 `getXxx()`、`equals()`、`hashCode()`、`toString()`，但 `componentN()` / `copy()` 不实用
- 推荐：跨语言 API 不暴露 sealed class；如必须，文档化所有子类型并在 Java 端 `instanceof` 判断

### 3.5 inline / value class 在 Java 端

- `value class`（1.5+ 替代 inline class）→ Java 看到的是**底层类型**（如 `Long`），不是包装类
- 跨语言场景**避免**用 value class，否则类型安全在 Java 端丢失

### 3.6 顶层属性 / object 单例

- Kotlin `object Foo` → Java 用 `Foo.INSTANCE.bar()`；用 `@JvmStatic` 让方法直接 `Foo.bar()`
- Kotlin 顶层 `val X = ...` → Java 看到 `XxxKt.getX()`；用 `@JvmField` 或 `const val` 优化

## 4. Kotlin 与 Java 语法规范

### Kotlin（4.4+ 推荐写法）

- **strict null safety**：禁止 `!!`（除非 100% 确认且写注释说明）；用 `?.`、`?:`、`requireNotNull()` / `checkNotNull()`
- 不可变优先：`val` > `var`；集合用 `List` / `Map` 而非 `MutableList` / `MutableMap`，必要才用可变
- 数据类用 `data class`；标识符用 `value class`（仅项目内部，不跨 Java）
- 表达式优于语句：`when` 作为表达式
- `let` / `apply` / `also` / `run` / `with`：注意 `it` 与 `this` 切换可读性，别滥用
- Coroutines：禁止 `GlobalScope`、`runBlocking`（除测试和 main）、`Dispatchers.IO/Default` 永远显式指定
- 异常：业务异常自定义类型；不要 catch 后默默吞掉
- 字符串：`"$x"` 插值；多行 `"""..."""`
- ⚠️ **Kotlin 1.7 限制**：不可用 `data object`（1.9+）、`enum entries`（1.9+）、context receivers 还是 experimental

### Java（JDK 17 在 Android 上）

- **可用**：var（局部类型推断）、`switch` 表达式（JDK 14+）、text blocks `"""..."""`（JDK 15+）、`instanceof` 模式匹配（JDK 16+ 部分）
- **不可用**（Android runtime 限制）：records、sealed classes、pattern matching for switch
- Stream API、`Optional`、`CompletableFuture` 可用
- 全部 public API 加 `@NonNull` / `@Nullable`（**否则 Kotlin 端会被平台类型坑**）
- 函数式接口可与 Kotlin lambda 互换
- 不再使用 `AsyncTask`（API 30 已弃用）；改用 Coroutines 或 ExecutorService
- `findViewById` 在所有 View 系统页面替换为 **ViewBinding**
- 集合优先 `java.util.List` 等接口而非具体实现

## 5. 架构与设计模式

### 5.1 分层（Clean Architecture 简化版）

```
UI 层（View/Compose）
  ↓ 调用
ViewModel（持有 UI State）
  ↓ 调用
UseCase（业务用例，单一职责）
  ↓ 调用
Repository（数据真相源 + 缓存策略）
  ↓ 调用
DataSource（Remote/Local，Retrofit/Room）
```

### 5.2 ViewModel + StateFlow 范式（推荐替代 LiveData）

```kotlin
// HomeUiState.kt - 用 sealed interface 表达多状态
sealed interface HomeUiState {
    object Loading : HomeUiState
    data class Success(val items: List<Item>) : HomeUiState
    data class Error(val message: String) : HomeUiState
}

// HomeViewModel.kt
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val getItems: GetItemsUseCase,
) : ViewModel() {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadItems()
    }

    fun refresh() = loadItems()

    private fun loadItems() {
        viewModelScope.launch {
            _uiState.value = HomeUiState.Loading
            runCatching { getItems() }
                .onSuccess { _uiState.value = HomeUiState.Success(it) }
                .onFailure { _uiState.value = HomeUiState.Error(it.message ?: "Unknown") }
        }
    }
}
```

### 5.3 Hilt 依赖注入

```kotlin
// MyApplication.kt
@HiltAndroidApp
class MyApplication : Application()

// MainActivity.kt
@AndroidEntryPoint
class MainActivity : AppCompatActivity() { /* ... */ }

// 模块定义
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    fun provideOkHttp(): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(HttpLoggingInterceptor())
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit = Retrofit.Builder()
        .baseUrl("https://api.example.com/")
        .client(client)
        .addConverterFactory(MoshiConverterFactory.create())
        .build()
}

// 接口绑定
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    abstract fun bindUserRepository(impl: UserRepositoryImpl): UserRepository
}
```

### 5.4 Repository + UseCase

```kotlin
interface UserRepository {
    suspend fun getCurrentUser(): User
    fun observeUser(): Flow<User?>
}

class UserRepositoryImpl @Inject constructor(
    private val api: UserApi,
    private val dao: UserDao,
) : UserRepository {
    override suspend fun getCurrentUser(): User = withContext(Dispatchers.IO) {
        api.fetchProfile().also { dao.insert(it.toEntity()) }.toDomain()
    }

    override fun observeUser(): Flow<User?> = dao.observeCurrent().map { it?.toDomain() }
}

class GetCurrentUserUseCase @Inject constructor(
    private val repo: UserRepository,
) {
    suspend operator fun invoke(): User = repo.getCurrentUser()
}
```

### 5.5 单 Activity + Navigation

- 推荐 **单 Activity + 多 Fragment/Compose Screen** 架构
- 用 **Navigation Component**（包含 Safe Args 插件）
- Compose 项目用 `NavHost` + `composable("route")`
- 混合项目：Fragment 容器 Activity + 部分 Fragment 内嵌 ComposeView

## 6. 性能、安全、可访问性

### 6.1 性能

- **冷启动**：用 **App Startup** 库（`androidx.startup`）替代 ContentProvider 黑魔法
- **基线 Profile**（Baseline Profiles）在 1.7 时代刚开始普及，可选配置
- **R8 / ProGuard** 默认启用 `minifyEnabled true` + `shrinkResources true`（release）
- **避免**主线程做 IO；用 Coroutines + `Dispatchers.IO`
- **图片**：Coil 自动处理；大图 ListView 项目外观加 `placeholder` 与 `crossfade`
- **RecyclerView**：`ListAdapter<T, VH>` + `DiffUtil.ItemCallback`；`stableIds` 必开
- **Compose 性能**：`@Stable` / `@Immutable` 标注；`LazyColumn` 提供 `key` 与 `contentType`
- **避免** `View.GONE` 与 `View.VISIBLE` 频繁切换大子树（用 `ViewStub`）
- **Memory leaks**：dev 构建集成 **LeakCanary**（仅 debug）
- **本地数据库批量写（Room）**：大批量 insert/update/delete 用单个 `@Transaction` 包裹，避免逐条隐式事务多次磁盘同步；超大列表按「行数 × 列数 < SQLite 变量上限（旧版 999 / 新版 32766）」分批，阈值提为带注释常量；所有 DB 操作放 `Dispatchers.IO`，不占主线程

### 6.2 安全

- **HTTPS 强制**：`network_security_config.xml` 仅允许特定域；明文请求需显式配置
- **证书钉扎**：OkHttp `CertificatePinner`；必要时 dynamic update
- **敏感数据**：用 **EncryptedSharedPreferences** / **EncryptedFile**（androidx.security:security-crypto）；不要明文存
- **Token**：内存 + 加密 DataStore；不放普通 SharedPreferences
- **WebView**：禁用 `setAllowFileAccess(true)`、`setJavaScriptEnabled` 仅在必要场景；XSS 防护
- **混淆**：R8 + 自定义 `proguard-rules.pro`，注意保留：
  - 反射使用的类（用 `@Keep` 或 ProGuard 规则）
  - Gson/Moshi 数据类（`@Keep` 或 keep 注解配置）
  - JNI native 方法
  - Kotlin metadata（默认已 keep）
- **签名**：v1 + v2 + v3（targetSdk 30+ 必需 v2+）
- **不要**把密钥硬编码：用 BuildConfig 注入 + `local.properties`（gitignored）+ NDK 加密
- **网络代理检测**（金融类 App 建议）

### 6.3 可访问性

- 所有可点击元素 `contentDescription`（图标）或 `android:contentDescription="@string/..."`
- TalkBack 测试（Android 设置 → 辅助功能）
- 触摸目标 ≥ 48dp × 48dp
- 颜色对比度 ≥ 4.5:1（用 Material 主题预设色板）
- 支持系统字号缩放（`sp` 单位，不要写死）
- Compose：`Modifier.semantics { contentDescription = "..." }`

## 7. 反模式清单（明确禁止）

| ❌ 禁止 | ✅ 替代 |
|---|---|
| `!!` 强解空 | `?.` / `?:` / `requireNotNull(x) { "msg" }` / `checkNotNull` |
| `GlobalScope.launch` | `viewModelScope` / `lifecycleScope` / 注入的 `CoroutineScope` |
| 主线程 `runBlocking` | `viewModelScope.launch` + `withContext` |
| `Dispatchers.Main` 写 IO | `withContext(Dispatchers.IO)` |
| `findViewById` | **ViewBinding**（`build.gradle` 启用） |
| `DataBinding`（除非已用） | ViewBinding 或 Compose |
| `AsyncTask` | Coroutines |
| `new Thread()` / `new Handler()` | Coroutines / WorkManager |
| `Activity` 持长引用回调 | 用 ViewModel + StateFlow 暴露状态 |
| `companion object` 没加 `@JvmStatic` 还希望 Java 调用 | 加 `@JvmStatic` 或重新设计 |
| Kotlin 默认参数让 Java 不能调 | 加 `@JvmOverloads` |
| Java public API 不写 `@NonNull` / `@Nullable` | 必须标注 |
| `kapt` 用于支持 KSP 的库 | 改用 **KSP**（编译速度提升 ~2x） |
| Hilt + 单 module（不分 feature） | 多模块 + Hilt + Convention Plugin |
| LiveData 在新代码 | **StateFlow / SharedFlow** |
| `Single<T>` / `Observable<T>` 在新代码 | Coroutines + Flow（保留 Java 模块兼容） |
| Glide + Coil 同时用（混乱） | 选一种，老 Java 模块可保留 Glide |
| 传 `View` / `Fragment` 引用进 ViewModel | 永远不要；ViewModel 不持 UI 引用 |
| `Activity.runOnUiThread` | Coroutines + `Dispatchers.Main` |
| 在 onCreate 里发起多个 `lifecycleScope.launch` | 合并到一个 launch + repeatOnLifecycle |
| `repeatOnLifecycle(STARTED)` 收集 Flow 写错位置 | 在 `onViewCreated` 里 + `viewLifecycleOwner.lifecycle` |
| Fragment 中 `viewLifecycleOwner` 与 `this` 混用 | 用 `viewLifecycleOwner` 收集 UI Flow |
| Compose 中状态写在函数外（顶层 var） | 用 `remember` / `rememberSaveable` |
| Compose 中 `LaunchedEffect(Unit)` 滥用 | 关键依赖作 key（如 `LaunchedEffect(uiState.itemId)`） |
| 顶层 `var` 全局可变状态 | 注入 Repository / DataStore |
| `BuildConfig.DEBUG` 散落代码 | 集中到 `Logger` 或 `BuildConfig` 抽象 |
| ProGuard 中 `-keep class **` 全保留 | 精确 keep，否则混淆失效 |
| Java 与 Kotlin 文件放不同目录但同包名各持一半 | 一个类整体迁移；不要拆 |

## 8. 决策提示（when to use what）

**View 系统 vs Jetpack Compose（混合项目）**：
- 老页面、稳定不大改 → 保留 View
- 新页面、组件复用强、动效复杂 → **Compose**
- Compose 嵌入 Fragment：`ComposeView`
- View 嵌入 Compose：`AndroidView { ... }`
- 不要在同一屏内频繁互嵌（性能与心智成本）

**LiveData vs StateFlow vs SharedFlow vs Flow**：
- 单一 UI 状态、有初始值、Lifecycle 自动管理 → **StateFlow**（推荐替代 LiveData）
- 一次性事件（Snackbar、Toast、导航） → **SharedFlow**（replay = 0）或 Channel
- 老 Java 模块 → **LiveData** 仍可
- 持续数据流 → **Flow**

**Hilt vs Koin vs 手动 DI**：
- 中大型项目 → **Hilt 2.43+**（编译期检查、Android 集成最好）
- 想避开 kapt、追求轻量 → **Koin 3.x**（运行期，性能略低）
- 极小项目 → 手动 DI（构造函数注入）

**kapt vs KSP**：
- 库支持 KSP（Room 2.4+、Moshi 1.13+） → **优先 KSP**（速度快约 2x）
- 库仅支持 kapt（一些老库） → 保留 kapt
- 同项目混用：可以，但模块内最好统一

**Retrofit + Moshi vs Retrofit + kotlinx.serialization vs Retrofit + Gson**：
- Kotlin-first、性能好 → **kotlinx.serialization 1.4**（需要 plugin）
- 与 Java 互操作 → **Moshi**（Java 友好）
- 历史项目 → **Gson**（保留，新项目不推荐）

**Room vs SQLDelight**：
- Android 单平台 → **Room 2.4+**（Google 官方）
- 跨平台（KMP） → **SQLDelight**

**WorkManager vs Service vs Coroutine**：
- 需保证执行（系统重启后继续） → **WorkManager**
- 长时间在前台（音乐、定位） → **ForegroundService**
- 进程内一次性后台 → **viewModelScope/lifecycleScope** Coroutine

**JUnit 4 vs JUnit 5（Jupiter）**：
- Android 默认、`@RunWith` 生态完整 → **JUnit 4**（推荐）
- 想要 nested test、parameterized API → JUnit 5（Android 配置较繁琐）

**MockK vs Mockito**：
- Kotlin 项目 → **MockK 1.12**（支持 final class、coroutines）
- Java 模块仍用 → Mockito 4（兼容性好）

**Coil vs Glide vs Picasso**：
- Kotlin / Compose → **Coil 2.2+**
- Java / 老代码 → **Glide 4.13+**
- 不要新引入 Picasso

**ViewBinding vs DataBinding vs Synthetic Properties**：
- **ViewBinding**（默认所有 View 系统页面）
- DataBinding 仅在已大量使用 + `@{}` 绑定有真实价值时保留
- Synthetic Properties（Kotlin Android Extensions）已弃用，必须迁移

**`launchWhenStarted` vs `repeatOnLifecycle`**：
- 1.7 时代官方推荐 **`repeatOnLifecycle(STARTED)`**（`lifecycleScope` + `launch`）
- 不要再用已弃用的 `launchWhenStarted` / `launchWhenResumed`

**StateFlow `collect` vs `collectAsState`**：
- Compose 内部 → `collectAsStateWithLifecycle()`（lifecycle-runtime-compose 2.6+）；1.7 时代用 `collectAsState()`
- View 内部 → `repeatOnLifecycle(STARTED) { stateFlow.collect { } }`

**何时引入新模块**：
- 一个 feature 内文件 > 50 → 拆 feature 模块
- 跨多个 feature 的工具代码 > 5 个文件 → 拆到 `core:common`
- 不要预先按层拆（`data` / `domain` / `ui` 顶层模块），按 feature 拆

**Java 17 source vs Java 11 source**：
- 没用 records / sealed classes / pattern matching → **Java 11** 最稳
- 用 var、text blocks、switch 表达式即可 → **Java 11** 已够
- 强需要 Java 17 语法（如团队已迁移）→ AGP 7.4+ + 设 source 17，注意 minSdk 兼容

## 9. 测试

- **单元测试**（`src/test/`）：纯 JVM，跑 ViewModel、UseCase、Repository、Mapper、纯函数
  - JUnit 4 + **MockK 1.12** + **kotlinx-coroutines-test 1.6.4**（`runTest`、`StandardTestDispatcher`）
  - Robolectric 4.8（仅必要：需要 Android Framework 类的 unit test）
  - 覆盖率目标：业务逻辑 ≥ 70%
- **UI 测试**（`src/androidTest/`）：跑真机/模拟器
  - View 系统：Espresso 3.4
  - Compose：`createComposeRule()` + `onNodeWithText` / `performClick`
- **测试目录镜像源码结构**
- **Coroutines 测试**：
  ```kotlin
  @ExperimentalCoroutinesApi
  class HomeViewModelTest {
      private val testDispatcher = StandardTestDispatcher()

      @Before fun setup() { Dispatchers.setMain(testDispatcher) }
      @After fun teardown() { Dispatchers.resetMain() }

      @Test
      fun `loadItems emits Success`() = runTest {
          val getItems: GetItemsUseCase = mockk()
          coEvery { getItems() } returns listOf(Item("1"))

          val vm = HomeViewModel(getItems)
          advanceUntilIdle()

          assertEquals(HomeUiState.Success(listOf(Item("1"))), vm.uiState.value)
      }
  }
  ```

## 10. 工具链与交付

### 10.1 build-logic（Convention Plugins）

替代 buildSrc，更模块化：

```kotlin
// build-logic/convention/src/main/kotlin/AndroidLibraryConventionPlugin.kt
class AndroidLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        with(pluginManager) {
            apply("com.android.library")
            apply("org.jetbrains.kotlin.android")
        }
        extensions.configure<LibraryExtension> {
            compileSdk = 33
            defaultConfig {
                minSdk = 21
                targetSdk = 33
            }
            compileOptions {
                sourceCompatibility = JavaVersion.VERSION_11
                targetCompatibility = JavaVersion.VERSION_11
            }
        }
        extensions.configure<KotlinAndroidProjectExtension> {
            jvmToolchain(17)
        }
    }
}
```

### 10.2 libs.versions.toml

```toml
[versions]
kotlin = "1.7.20"
agp = "7.3.1"
compose-compiler = "1.3.2"
compose-bom = "2022.10.00"
hilt = "2.44"
coroutines = "1.6.4"
retrofit = "2.9.0"
okhttp = "4.10.0"
room = "2.4.3"
ksp = "1.7.20-1.0.8"

[libraries]
androidx-core-ktx = "androidx.core:core-ktx:1.9.0"
androidx-lifecycle-viewmodel = "androidx.lifecycle:lifecycle-viewmodel-ktx:2.5.1"
hilt-android = { module = "com.google.dagger:hilt-android", version.ref = "hilt" }
hilt-compiler = { module = "com.google.dagger:hilt-android-compiler", version.ref = "hilt" }
retrofit = { module = "com.squareup.retrofit2:retrofit", version.ref = "retrofit" }
retrofit-moshi = { module = "com.squareup.retrofit2:converter-moshi", version.ref = "retrofit" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
android-library = { id = "com.android.library", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
```

### 10.3 模块 build.gradle.kts（混合项目示例）

```kotlin
plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.company.feature.home"
    compileSdk = 33

    defaultConfig {
        minSdk = 21
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    buildFeatures {
        viewBinding = true
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = libs.versions.compose.compiler.get()
    }
}

kotlin {
    jvmToolchain(17)
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    kotlinOptions {
        jvmTarget = "11"
        freeCompilerArgs += listOf(
            "-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi",
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
        )
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    // ...
}
```

### 10.4 ktlint / detekt

- **ktlint**：`org.jlleitschuh.gradle.ktlint` 插件 + 0.46.1
- **detekt**：1.21.0；自定义规则 `detekt.yml`，CI 中跑 `./gradlew detekt`

### 10.5 CI 五件套

`./gradlew lint detekt ktlintCheck testDebugUnitTest assembleDebug`

### 10.6 多 Flavor

```kotlin
android {
    flavorDimensions += "env"
    productFlavors {
        create("dev") {
            dimension = "env"
            applicationIdSuffix = ".dev"
            buildConfigField("String", "API_BASE_URL", "\"https://api-dev.example.com\"")
        }
        create("prod") {
            dimension = "env"
            buildConfigField("String", "API_BASE_URL", "\"https://api.example.com\"")
        }
    }
}
```

### 10.7 发布

- **Bundle**：`./gradlew bundleProdRelease` → `.aab`，传 Play Console
- **签名**：`signingConfigs` 用环境变量或 `keystore.properties`（gitignored）
- **混淆**：release 默认 `isMinifyEnabled = true`、`isShrinkResources = true`
- **崩溃 sourcemap**：Crashlytics / Sentry Gradle 插件自动上传 mapping.txt

## 11. 标准代码模板

### 11.1 ViewModel（StateFlow + Hilt + UseCase）

```kotlin
@HiltViewModel
class OrderListViewModel @Inject constructor(
    private val getOrders: GetOrdersUseCase,
    private val savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val filter = savedStateHandle.getStateFlow("filter", "all")

    val uiState: StateFlow<OrderListUiState> = filter
        .flatMapLatest { f ->
            flow {
                emit(OrderListUiState.Loading)
                runCatching { getOrders(f) }
                    .onSuccess { emit(OrderListUiState.Success(it)) }
                    .onFailure { emit(OrderListUiState.Error(it.message ?: "Unknown")) }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), OrderListUiState.Loading)

    fun setFilter(value: String) { savedStateHandle["filter"] = value }
}

sealed interface OrderListUiState {
    object Loading : OrderListUiState
    data class Success(val orders: List<Order>) : OrderListUiState
    data class Error(val message: String) : OrderListUiState
}
```

### 11.2 Fragment（View + ViewBinding + StateFlow 收集）

```kotlin
@AndroidEntryPoint
class OrderListFragment : Fragment(R.layout.fragment_order_list) {

    private var _binding: FragmentOrderListBinding? = null
    private val binding get() = _binding!!
    private val viewModel: OrderListViewModel by viewModels()
    private val adapter = OrderListAdapter()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        _binding = FragmentOrderListBinding.bind(view)
        binding.recyclerView.adapter = adapter

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    when (state) {
                        OrderListUiState.Loading -> binding.progress.isVisible = true
                        is OrderListUiState.Success -> {
                            binding.progress.isVisible = false
                            adapter.submitList(state.orders)
                        }
                        is OrderListUiState.Error -> {
                            binding.progress.isVisible = false
                            Snackbar.make(view, state.message, Snackbar.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        binding.recyclerView.adapter = null
        _binding = null
        super.onDestroyView()
    }
}
```

### 11.3 Compose Screen

```kotlin
@Composable
fun OrderListRoute(
    viewModel: OrderListViewModel = hiltViewModel(),
    onOrderClick: (String) -> Unit,
) {
    val state by viewModel.uiState.collectAsState()
    OrderListScreen(state = state, onOrderClick = onOrderClick)
}

@Composable
fun OrderListScreen(
    state: OrderListUiState,
    onOrderClick: (String) -> Unit,
) {
    Box(Modifier.fillMaxSize()) {
        when (state) {
            OrderListUiState.Loading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
            is OrderListUiState.Success -> LazyColumn(Modifier.fillMaxSize()) {
                items(state.orders, key = { it.id }) { order ->
                    OrderRow(order = order, onClick = { onOrderClick(order.id) })
                }
            }
            is OrderListUiState.Error -> Text(state.message, Modifier.align(Alignment.Center))
        }
    }
}
```

### 11.4 Java 端调用 Kotlin（混合示例）

**Kotlin 端（接口）**：
```kotlin
@Singleton
class AnalyticsTracker @Inject constructor() {

    @JvmOverloads
    fun track(event: String, params: Map<String, String> = emptyMap()) {
        // ...
    }

    companion object {
        @JvmStatic
        fun isEnabled(): Boolean = BuildConfig.ANALYTICS_ENABLED
    }
}
```

**Java 端调用**：
```java
public class LegacyTrackerBridge {
    private final AnalyticsTracker tracker;

    @Inject
    public LegacyTrackerBridge(AnalyticsTracker tracker) {
        this.tracker = tracker;
    }

    public void onLogin() {
        if (AnalyticsTracker.isEnabled()) {
            tracker.track("login");                          // 用了默认参数
        }
    }
}
```

## 12. 行为约定（对 AI 的指令）

写代码时遵循：

1. **版本约束第一**：所有建议必须能在 Kotlin 1.7 + JDK 17 + AGP 7.3 上运行；遇到不确定时主动确认 API/库版本；不要建议升级 Kotlin 版本
2. **混合开发原则**：新代码用 Kotlin，但**不删/改已有 Java 文件**（除非用户要求迁移）；跨语言接口必须加互操作注解
3. **先读后写**：修改前先读 `libs.versions.toml`、`settings.gradle.kts`、相关模块 `build.gradle.kts`，确认现有约定与依赖版本
4. **Java API 必须标注 nullability**：所有 public 方法/字段加 `@NonNull` / `@Nullable`
5. **Kotlin API 必须友好对 Java**：companion 方法用 `@JvmStatic`、默认参数用 `@JvmOverloads`、顶层文件用 `@file:JvmName`
6. **小步快跑**：每次修改后跑 `./gradlew ktlintCheck detekt :module:testDebugUnitTest`
7. **不预先抽象**：YAGNI；不预先按层拆模块
8. **依赖谨慎**：引入新依赖前必须解释原因，并确认对 Kotlin 1.7 / AGP 7.3 / minSdk 21 的兼容性
9. **类型先行**：先定义 data class / sealed interface，再写实现
10. **回答中文为主**，代码与标识符英文
11. **明确产出**：改完后总结：动了哪些文件、跨语言影响、怎么验证（lint / unit test / instrumented test）


