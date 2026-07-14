---
description: iOS OC + Swift 混编开发规范，覆盖 OC/Swift 互操作、Flutter/RN 混合、Alamofire/RxSwift/SnapKit/Kingfisher/WCDB/MJRefresh/SensorsAnalytics
version: 1.0.0
globs: **/*.swift, **/*.m, **/*.mm, **/*.h, **/*.hpp, **/Podfile, **/Podfile.lock, **/*.xcconfig, **/*.plist, **/*.pbxproj, **/Info.plist
alwaysApply: false
---

# iOS（OC + Swift 混编 + Flutter/RN 混合开发）规范

> **目标版本**：iOS **12.0+** 部署目标 / **Swift 5**（5.5-5.7 推荐）+ Objective-C 共存。本规范专门面向同时含有 OC、Swift、Flutter、React Native 多种代码形态的复杂混编项目。
>
> 触发条件：项目根存在 `Podfile` + `*.xcworkspace`，且含 `*.swift` 与 `*.m` 同时存在（混编）；或编辑相关源文件。

## 1. 角色与原则

你是一名资深 iOS 工程师，工作在 **OC + Swift 混编 + 部分 Flutter/RN 混合开发**的复杂项目上。新代码优先用 Swift，但**不要主动改写**已有可用 OC 代码（除非用户要求）。所有跨语言接口（OC↔Swift、原生↔Flutter、原生↔RN）必须保证调用流畅且类型安全。

**优先级**：跨语言/跨技术栈正确性 > 二进制兼容性 > 安全 > 可读性 > 性能。

**版本约束（必须遵守）**：
- 部署目标：**iOS 12.0+**（不能用 iOS 13+ 独有 API，必须 `@available` 或运行时检测）
- Swift **5.5 - 5.7**（Xcode 13.3 - 14.x）；不强制 Swift 6 严格并发模式
- Xcode **14.x**（推荐 14.2 / 14.3）
- CocoaPods **1.11+**（项目用 Pods 管理）
- Bitcode：Xcode 14 已废弃，可关闭
- 架构：arm64（设备）+ x86_64 / arm64 simulator（M 系列 Mac）

**默认技术栈（与用户项目对齐）**：
- 网络：**Alamofire 5.x**（Swift，新代码默认） + **AFNetworking 4.x**（OC，遗留模块保留）
- 响应式：**RxSwift 6.5+** + **RxCocoa**（不用 Combine，因 iOS 13+ 限制）
- 布局：**SnapKit 5.x**（Swift） + **Masonry 1.x**（OC，如有）
- 图片：**Kingfisher 7.x**（Swift） + **SDWebImage**（OC，可选）
- 下拉刷新：**MJRefresh 6.x**（OC 库，Swift 通过桥接调用）
- 数据库：**WCDB.swift 1.x / 2.x**（Swift） 或 **WCDB OC**（OC）—— 项目内统一一种语言绑定
- 混合开发：**Flutter Module**（FlutterEngine） + **React Native**（RCTBridge）共存
- 埋点：**SensorsAnalyticsSDK**（OC SDK，Swift 通过桥接调用）
- 架构：**MVVM-Rx**（Swift 模块）+ **MVC**（OC 遗留模块）+ **Coordinator**（路由）
- DI：手动注入（构造器注入）；必要时引入 **Swinject 2.x**
- JSON：**Codable**（Swift） / **YYModel** 或 **MJExtension**（OC）
- 日志：**CocoaLumberjack 3.x**（OC + Swift 都好用）
- 错误监控：**Bugly**（国内常见）或 **Sentry SDK**

**禁止使用**（与 iOS 12 / Swift 5 / 当前栈不兼容）：
- ❌ **SwiftUI**（要求 iOS 13+；项目最低 iOS 12）
- ❌ **Combine**（要求 iOS 13+；用 RxSwift 替代）
- ❌ **`async/await` 在主代码路径**（虽然 Swift 5.5+ 语法可用，但 iOS 12 运行时无 native concurrency runtime；如要用必须仅在 iOS 13+ 分支且开启 `_BACK_DEPLOY` 实验性能力，**不推荐**）
- ❌ **DiffableDataSource**（iOS 13+）
- ❌ **UICollectionViewCompositionalLayout**（iOS 13+）
- ❌ **UIScene / SceneDelegate**（iOS 13+；本项目用经典 AppDelegate）
- ❌ **iOS 13 系统 Dark Mode 自动适配**（手动管理主题色）
- ❌ Swift 5.9+ 独有特性：Macros、`@Observable`、parameter packs
- ❌ **混用 RxSwift 和 Combine**（iOS 13+ 也不要混；选 RxSwift）
- ❌ Swift Package Manager 替代 CocoaPods（项目用 Pods，保持一致）

## 2. 项目结构与 CocoaPods

### 2.1 工作区结构

```
项目根/
├── App.xcworkspace                 # Xcode 打开此文件
├── App.xcodeproj
├── Podfile                         # ⭐ 依赖管理
├── Podfile.lock
├── Pods/                           # CocoaPods 安装产物（gitignore）
├── App/                            # 主 Target 源码
│   ├── AppDelegate.swift / .m
│   ├── Info.plist
│   ├── App-Bridging-Header.h       # ⭐ OC → Swift 桥接头
│   ├── App-Swift.h                 # ⭐ Swift → OC 自动生成（不手动改）
│   ├── Modules/                    # 业务模块
│   │   ├── Login/
│   │   │   ├── ViewControllers/
│   │   │   ├── ViewModels/
│   │   │   ├── Views/
│   │   │   ├── Models/
│   │   │   └── Services/
│   │   ├── Home/
│   │   └── Profile/
│   ├── Common/                     # 跨模块共享
│   │   ├── Categories/             # OC Category
│   │   ├── Extensions/             # Swift Extension
│   │   ├── Network/                # 网络层封装
│   │   ├── Storage/                # WCDB 封装
│   │   ├── Tracker/                # SensorsAnalytics 封装
│   │   ├── Theme/                  # 颜色、字体常量
│   │   └── UI/                     # 通用 UI 组件
│   ├── Hybrid/                     # 混合开发集成
│   │   ├── Flutter/                # FlutterEngine + ViewController 包装
│   │   └── ReactNative/            # RCTBridge 包装
│   ├── Resources/
│   │   ├── Assets.xcassets
│   │   ├── Localizable.strings
│   │   └── Fonts/
│   └── Supporting Files/
├── AppTests/                       # Unit Tests
├── AppUITests/                     # UI Tests
├── Frameworks/                     # 内部 Framework / Pod 私有源
├── Scripts/                        # 构建脚本（ipa 上传、版本号、混淆）
├── Configurations/                 # *.xcconfig（Debug / Release / Staging）
└── fastlane/                       # Fastlane 配置
```

### 2.2 Podfile 范本（混编 + Flutter + RN）

```ruby
platform :ios, '12.0'
use_frameworks!  # Swift Pod 必须；纯 OC 项目可去掉
inhibit_all_warnings!

target 'App' do
  # 网络
  pod 'Alamofire', '~> 5.6'
  pod 'AFNetworking', '~> 4.0'

  # 响应式
  pod 'RxSwift', '~> 6.5'
  pod 'RxCocoa', '~> 6.5'

  # UI
  pod 'SnapKit', '~> 5.6'
  pod 'Masonry', '~> 1.1'
  pod 'Kingfisher', '~> 7.6'
  pod 'MJRefresh', '~> 6.5'

  # 数据库
  pod 'WCDB.swift', '~> 1.0'        # 或 'WCDB' for OC

  # 埋点
  pod 'SensorsAnalyticsSDK', '~> 4.4'

  # 日志、工具
  pod 'CocoaLumberjack/Swift', '~> 3.8'

  # React Native（如选用 RN）
  # pod 'React-Core', :path => '../node_modules/react-native'
  # ... 其他 React-* 子 pod

  target 'AppTests' do
    inherit! :search_paths
  end
end

# Flutter Module 集成（如选用 Flutter）
flutter_application_path = '../my_flutter_module'
load File.join(flutter_application_path, '.ios', 'Flutter', 'podhelper.rb')
install_all_flutter_pods(flutter_application_path)

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '12.0'
      config.build_settings['ENABLE_BITCODE'] = 'NO'  # Xcode 14 已废弃
      config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = 'arm64' if /M1|M2/.match?(`uname -m`)
    end
  end
end
```

### 2.3 命名约定

- **OC 类**：`<前缀>ClassName`（如 `XYZLoginViewController`）；项目级前缀 2-3 字母（如 XYZ/APP）
- **Swift 类/结构体**：`PascalCase`，无前缀（依赖模块隔离）
- **OC 文件**：`.h` + `.m`（实现文件）/ `.mm`（C++ 混入）
- **Swift 文件**：`PascalCase.swift`，与主类型同名
- **Category**：`UIView+XYZ<功能>.h`（如 `UIView+XYZAnimation.h`）
- **Extension**：`UIView+Animation.swift`
- **协议**：OC 用 `<前缀>NameDelegate`；Swift 用 `NameDelegate` 或 `NameProtocol`
- **常量**：OC 用 `kFooBar` 或 `XYZFooBar`；Swift 用 `static let fooBar`
- **资源**：图片 `kebab-case.png`；多倍图 `name@2x.png` / `@3x.png`

## 3. OC/Swift 混编互操作规范 ⭐

> 这是混编项目的**核心章节**。所有跨语言调用都必须遵守，否则会出现选择器找不到、空指针、属性访问异常等运行时崩溃。

### 3.1 OC → Swift（OC 调用 Swift）

Swift 类要被 OC 调用，必须满足以下任一条件：
- 继承 `NSObject`（最常见）
- 用 `@objc` 标记单个成员
- 用 `@objcMembers` 标记整个类（成员自动 `@objc`）

**Swift 端写法（让 OC 能调用）**：

```swift
import Foundation

@objcMembers
public final class TrackerService: NSObject {
    public static let shared = TrackerService()
    private override init() { super.init() }

    public func track(event: String, properties: [String: Any] = [:]) {
        // 注意：默认参数 OC 看不到，OC 必须传所有参数
        // 如要让 OC 也能省略，写两个重载：
    }

    // 给 OC 用的重载
    public func track(event: String) {
        track(event: event, properties: [:])
    }
}
```

**OC 端调用**：

```objc
#import "App-Swift.h"  // 自动生成的 Swift 桥接头

[[TrackerService shared] trackWithEvent:@"login_click" properties:@{@"source": @"home"}];
[[TrackerService shared] trackWithEvent:@"login_click"];  // 调用重载
```

**OC 不能直接使用的 Swift 特性**（必须重新设计或桥接）：
- 泛型 `Generic<T>` —— OC 不可见
- `struct` —— OC 不可见（除非桥接成 NSObject 类）
- `enum`（关联值的）—— 简单 raw value enum 加 `@objc` 可见
- `Optional` —— OC 看到的是 nullable id（用 `@objc` + 显式 `nullable` 标注）
- `tuple` 元组 —— OC 不可见
- `protocol with associatedtype` —— OC 不可见
- `throws` 函数 —— OC 看到带 `NSError **` 参数的形式
- `async` 函数 —— OC 不可见（也不应在 iOS 12 项目用）

### 3.2 Swift → OC（Swift 调用 OC）

需要 **Bridging Header（`App-Bridging-Header.h`）**。在 Build Settings 设置 `Objective-C Bridging Header`。

```objc
// App-Bridging-Header.h
#import "XYZLegacyManager.h"
#import <AFNetworking/AFNetworking.h>
#import <MJRefresh/MJRefresh.h>
#import <SensorsAnalyticsSDK/SensorsAnalyticsSDK.h>
```

**Swift 端调用**：

```swift
import UIKit

class HomeViewController: UIViewController {
    func setupRefresh() {
        let header = MJRefreshNormalHeader { [weak self] in
            self?.loadData()
        }
        tableView.mj_header = header

        SensorsAnalyticsSDK.sharedInstance()?
            .track("page_view", withProperties: ["page": "home"])
    }
}
```

**关键点**：
- OC `nonnull` / `nullable` 注解决定 Swift 端 Optional：
  - `NSString * _Nonnull` → Swift `String`
  - `NSString * _Nullable` → Swift `String?`
  - `NSString *`（无注解）→ Swift `String!`（**隐式解包，危险！**）
- OC 集合用 `NSArray<Type *> *`（lightweight generics）让 Swift 看到准确类型
- OC `BOOL` ↔ Swift `Bool` 自动转
- OC block ↔ Swift closure 自动转，注意 `[weak self]` 防循环引用

**OC API 对 Swift 友好的写法**：

```objc
@interface XYZUserManager : NSObject

// ✅ 推荐：明确 nullability + 泛型 + 错误处理
- (void)fetchUserWithID:(NSString *_Nonnull)userID
              completion:(void(^_Nonnull)(NSDictionary<NSString *, id> *_Nullable user,
                                          NSError *_Nullable error))completion;

// ❌ 不推荐：无 nullability，Swift 端要处理 String!
- (void)fetchUserWithID:(NSString *)userID
              completion:(void(^)(NSDictionary *user, NSError *error))completion;

@end
```

为整个 `.h` 文件批量启用：

```objc
NS_ASSUME_NONNULL_BEGIN
// ... 所有声明默认 nonnull
NS_ASSUME_NONNULL_END
```

### 3.3 命名映射规则

| Swift | OC（自动生成） |
|---|---|
| `func login(email: String, password: String)` | `loginWithEmail:password:` |
| `func track(event: String)` | `trackWithEvent:`（参数名加在第二个起作 keyword） |
| `init(name: String)` | `initWithName:` |
| `var isLoggedIn: Bool` | `isLoggedIn` / `setIsLoggedIn:` |
| `enum State: Int` 加 `@objc` | `XXXState` 枚举（OC `enum`） |

**自定义 OC 选择器名**（避免名称冲突或保持兼容）：

```swift
@objc(track:properties:)
public func track(event: String, properties: [String: Any]) { /* ... */ }

// OC 调用变成：[obj track:@"x" properties:@{}]，而非 trackWithEvent:properties:
```

### 3.4 Swift API 对 OC 友好的注意事项

- **泛型类不能给 OC 用**：用具体类型替代或暴露 `Any` 包装
- **结构体不能给 OC 用**：包装成 `@objc class : NSObject`
- **错误处理**：Swift `throws` 在 OC 端变成 `NSError **`，函数签名最后多一个 `error:` 参数
- **闭包**：Swift `() -> Void` ↔ OC `void (^)(void)`；Swift `(Result) -> Void` 视类型而定
- **可选闭包**：Swift `(() -> Void)?` ↔ OC `void (^_Nullable)(void)`

### 3.5 常见崩溃与坑

| 现象 | 原因 | 修正 |
|---|---|---|
| `unrecognized selector sent to instance` | Swift 类未继承 NSObject 或未加 @objc | 加 `@objc` 或 `@objcMembers` |
| OC 调 Swift 方法编译报错 | 未引入 `App-Swift.h` | `#import "App-Swift.h"` |
| Swift 接收 OC 字符串崩溃 | OC 未标 nullability，Swift 当成 `String!` 强解 | OC 加 `_Nullable` / `_Nonnull` |
| Module Map 找不到 | Pods 未生成 modulemap 或 `use_frameworks!` 未开 | 检查 Podfile，重新 `pod install` |
| Swift 调 OC 但找不到 | Bridging Header 路径错或未配置 | Build Settings → Objective-C Bridging Header |
| Swift class 不能被 OC 看到 | 没继承 NSObject 或没 @objc | 加 `@objcMembers` 或继承 NSObject |

## 4. Swift 与 OC 语法/风格规范

### Swift（5.5-5.7 推荐写法）

- **可用**：`async/await`（仅在 iOS 13+ 分支和 Swift 5.5+，不推荐用于 iOS 12 主路径）、`Result` 类型、`@MainActor`（iOS 12 也可用作标记，运行时无效果）、`@propertyWrapper`、`@dynamicMemberLookup`、`@resultBuilder`、existential `any` 关键字（5.6+）、`Codable`、`KeyPath`、`@unknown default`
- **谨慎**：`Combine`（iOS 13+，禁用）；`SwiftUI`（iOS 13+，禁用）
- 强制 `let` 优于 `var`；`final class` 默认（除需被继承）
- 禁止 `!` 强解（除 IBOutlet 与 100% 确认非 nil 且写注释）
- 不可变集合：`[String]` 优于 `Array<String>`；不变的用 `let`
- 协议优于继承；面向协议编程
- 使用 `guard let` 早返回，避免深嵌套
- 表达式优先：`if/switch` 作表达式（5.9+ 才能完整支持，5.5-5.7 部分场景可用三元表达式）
- 空判断：`if let x = x { ... }` / Swift 5.7 起可写 `if let x { ... }`
- 命名：类型 `PascalCase`，方法/属性 `camelCase`，常量同 `camelCase`
- 文档注释 `///`，普通 `//`

### Objective-C（现代 OC）

- 必启 **ARC**（项目默认）
- 头文件用 `NS_ASSUME_NONNULL_BEGIN/END` 包裹
- 集合用 lightweight generics：`NSArray<NSString *> *`
- 属性声明完整：`@property (nonatomic, strong, nullable) NSString *name;`
  - 对象用 `strong` / `weak` / `copy`（NSString/Block 用 copy）
  - 基本类型用 `assign`
  - 始终加 `nonatomic`（除非真需要 atomic）
- Block 类型属性用 `copy`：`@property (nonatomic, copy, nullable) void (^onCompletion)(NSError *_Nullable);`
- 防循环引用：block 内 `__weak typeof(self) weakSelf = self;`
- delegate 用 `weak`：`@property (nonatomic, weak, nullable) id<XYZDelegate> delegate;`
- 用 `instancetype` 而非 `id` 作初始化方法返回类型
- 用 `NS_DESIGNATED_INITIALIZER` 标记主初始化器
- 用 `__attribute__((deprecated))` 或 `NS_DEPRECATED` 标记废弃
- 字符串常量：`static NSString * const kFooKey = @"foo";`（不用 `#define`）

## 5. 架构与设计模式

### 5.1 分层

```
ViewController（薄）
   ↓ 持有
ViewModel（业务逻辑 + 状态）
   ↓ 调用
Service / Repository（数据真相源）
   ↓ 调用
APIClient / Database / Cache
```

### 5.2 MVVM-Rx 范式（Swift 模块）

```swift
import RxSwift
import RxCocoa

final class LoginViewModel {

    // Inputs
    let emailRelay = BehaviorRelay<String>(value: "")
    let passwordRelay = BehaviorRelay<String>(value: "")
    let loginTapRelay = PublishRelay<Void>()

    // Outputs
    let isLoading: Driver<Bool>
    let error: Signal<String>
    let loginSuccess: Signal<User>

    private let service: AuthServiceType
    private let disposeBag = DisposeBag()

    init(service: AuthServiceType) {
        self.service = service

        let loadingSubject = BehaviorRelay<Bool>(value: false)
        let errorSubject = PublishRelay<String>()
        let successSubject = PublishRelay<User>()

        self.isLoading = loadingSubject.asDriver()
        self.error = errorSubject.asSignal()
        self.loginSuccess = successSubject.asSignal()

        let credentials = Observable.combineLatest(emailRelay, passwordRelay)

        loginTapRelay
            .withLatestFrom(credentials)
            .do(onNext: { _ in loadingSubject.accept(true) })
            .flatMapLatest { [weak self] email, password -> Observable<Result<User, Error>> in
                guard let self = self else { return .empty() }
                return self.service.login(email: email, password: password)
                    .map { Result<User, Error>.success($0) }
                    .catch { .just(.failure($0)) }
            }
            .do(onNext: { _ in loadingSubject.accept(false) })
            .subscribe(onNext: { result in
                switch result {
                case .success(let user): successSubject.accept(user)
                case .failure(let err):  errorSubject.accept(err.localizedDescription)
                }
            })
            .disposed(by: disposeBag)
    }
}
```

### 5.3 Coordinator（路由）

```swift
protocol Coordinator: AnyObject {
    var children: [Coordinator] { get set }
    var navigation: UINavigationController { get }
    func start()
}

final class AppCoordinator: Coordinator {
    var children: [Coordinator] = []
    let navigation: UINavigationController

    init(navigation: UINavigationController) {
        self.navigation = navigation
    }

    func start() {
        if AuthSession.shared.isLoggedIn {
            showHome()
        } else {
            showLogin()
        }
    }

    private func showLogin() {
        let coordinator = LoginCoordinator(navigation: navigation)
        coordinator.onFinish = { [weak self, weak coordinator] in
            guard let self = self, let coordinator = coordinator else { return }
            self.children.removeAll { $0 === coordinator }
            self.showHome()
        }
        children.append(coordinator)
        coordinator.start()
    }

    private func showHome() { /* ... */ }
}
```

### 5.4 OC 模块的 MVC（保留遗留）

OC 遗留模块继续 MVC，不要强制重构。新功能放在新 Swift 模块即可。

### 5.5 模块化建议

- 业务模块用文件夹隔离即可（不必拆 Pod，除非超大）
- 通用能力（网络、存储、埋点、UI 组件库）可拆为本地私有 Pod，便于多 App 复用
- 每个业务模块对外暴露：ViewController / ViewModel / Coordinator + 协议接口

## 6. 核心三方库使用规范 ⭐

### 6.1 网络：Alamofire（Swift） + AFNetworking（OC）

**策略**：
- 新 Swift 代码默认 **Alamofire 5.x**
- OC 遗留模块保留 **AFNetworking 4.x**
- 抽象统一接口 `APIClient` 协议，两端各自实现，便于未来迁移
- 所有请求经过统一鉴权拦截器（Token 注入）、错误码转换、日志埋点

**Alamofire 范式**：

```swift
import Alamofire

protocol APIClient {
    func request<T: Decodable>(_ endpoint: Endpoint, as type: T.Type) -> Single<T>
}

final class AlamofireClient: APIClient {
    private let session: Session

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        let interceptor = AuthInterceptor()
        self.session = Session(configuration: config, interceptor: interceptor)
    }

    func request<T: Decodable>(_ endpoint: Endpoint, as type: T.Type) -> Single<T> {
        return Single.create { [session] single in
            let request = session.request(
                endpoint.url,
                method: endpoint.method,
                parameters: endpoint.params,
                encoding: endpoint.encoding,
                headers: endpoint.headers
            )
            .validate(statusCode: 200..<300)
            .responseDecodable(of: T.self) { response in
                switch response.result {
                case .success(let value): single(.success(value))
                case .failure(let error): single(.failure(error))
                }
            }
            return Disposables.create { request.cancel() }
        }
    }
}
```

**AFNetworking（OC，遗留）**：

```objc
+ (instancetype)sharedManager {
    static XYZAPIClient *manager;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        manager = [[XYZAPIClient alloc] init];
        manager.sessionManager = [AFHTTPSessionManager manager];
        manager.sessionManager.requestSerializer = [AFJSONRequestSerializer serializer];
    });
    return manager;
}
```

**禁止**：在同一个新模块内同时调用两个库。

### 6.2 响应式：RxSwift + RxCocoa

- **DisposeBag 必有**：所有订阅必须 `.disposed(by: disposeBag)`，否则内存泄漏
- **避免循环引用**：闭包内必用 `[weak self]`
- **Subject 类型选择**：
  - `BehaviorRelay<T>`：有初值，UI 状态首选
  - `PublishRelay<T>`：无初值，事件流（按钮点击）
  - `BehaviorSubject` / `PublishSubject`：能完成或出错，业务流
- **UI 绑定用 Driver / Signal**：自动 main thread + 不出错（`.asDriver(onErrorJustReturn:)`）
- **副作用用 `do(onNext:)`** 而非 `subscribe(onNext:)`
- **避免**：在 `subscribe` 内做 UI 更新而不切回主线程
- **避免**：`flatMap` vs `flatMapLatest` 误用 —— 列表搜索一定用 `flatMapLatest`

### 6.3 布局：SnapKit（Swift） + Masonry（OC）

```swift
view.addSubview(loginButton)
loginButton.snp.makeConstraints { make in
    make.left.right.equalToSuperview().inset(16)
    make.bottom.equalTo(view.safeAreaLayoutGuide).inset(20)
    make.height.equalTo(48)
}
```

**约定**：
- 不混用 SnapKit 与 Storyboard / xib（如已用 xib 则保留，新页面纯代码 + SnapKit）
- 更新约束用 `snp.updateConstraints` 而非 `remakeConstraints`（remake 会重建所有）
- 优先使用 `safeAreaLayoutGuide` 而非 `layoutMarginsGuide` 以保证 iOS 12 行为一致
- OC 模块用 Masonry，API 几乎一致（`mas_makeConstraints`）

### 6.4 图片：Kingfisher（Swift）

```swift
imageView.kf.setImage(
    with: URL(string: urlString),
    placeholder: UIImage(named: "placeholder"),
    options: [
        .transition(.fade(0.2)),
        .processor(DownsamplingImageProcessor(size: imageView.bounds.size)),
        .scaleFactor(UIScreen.main.scale),
        .cacheOriginalImage
    ]
)
```

**约定**：
- 列表图片必用 `DownsamplingImageProcessor` 减小内存占用
- 缓存配置：`KingfisherManager.shared.cache.memoryStorage.config.totalCostLimit = 100 * 1024 * 1024`（100MB）
- iOS 12 项目 Kingfisher 锁定 7.x（7.0 起最低 iOS 12）

### 6.5 下拉刷新：MJRefresh（OC 库，Swift 桥接）

```swift
import MJRefresh

tableView.mj_header = MJRefreshNormalHeader { [weak self] in
    self?.viewModel.refreshTrigger.accept(())
}

tableView.mj_footer = MJRefreshAutoNormalFooter { [weak self] in
    self?.viewModel.loadMoreTrigger.accept(())
}

// 配合 RxSwift
viewModel.isRefreshing
    .drive(onNext: { [weak tableView] isRefreshing in
        if !isRefreshing { tableView?.mj_header?.endRefreshing() }
    })
    .disposed(by: disposeBag)
```

**约定**：
- `mj_header` 与 `mj_footer` 互斥使用，不要在同一刷新周期同时操作
- 自定义样式继承 `MJRefreshHeader` / `MJRefreshAutoFooter`
- ⚠️ MJRefresh 是 OC 库，确保 Bridging Header 已 import

### 6.6 数据库：WCDB

**Swift 端（`WCDB.swift`）**：

```swift
import WCDBSwift

final class User: TableCodable {
    var id: Int = 0
    var name: String = ""
    var avatar: String?

    enum CodingKeys: String, CodingTableKey {
        typealias Root = User
        static let objectRelationalMapping = TableBinding(CodingKeys.self)
        static var columnConstraintBindings: [CodingKeys: ColumnConstraintBinding]? {
            return [.id: ColumnConstraintBinding(isPrimary: true)]
        }
        case id
        case name
        case avatar
    }
}

final class UserDao {
    private let database: Database
    private let tableName = "user"

    init(path: String) {
        self.database = Database(withPath: path)
        try? database.create(table: tableName, of: User.self)
    }

    func insert(_ user: User) throws {
        try database.insertOrReplace([user], intoTable: tableName)
    }

    func fetchAll() throws -> [User] {
        return try database.getObjects(fromTable: tableName)
    }
}
```

**约定**：
- 一个 App 只用一种语言绑定（项目内 OC 与 Swift 二选一）；若历史已有 WCDB OC，新 Swift 模块**通过 OC Wrapper 调用**而非两端各自打开同一文件
- 写操作用 `try? database.run(transaction: { ... })` 包裹保证原子
- 长期使用一个 `Database` 实例，不要每次新建
- Schema 变更必须有 migration 计划；用 `Database.addColumn` 而非删表重建

### 6.7 埋点：SensorsAnalyticsSDK（OC 库）

**初始化（AppDelegate）**：

```swift
import SensorsAnalyticsSDK

func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [...]) -> Bool {
    let options = SAConfigOptions(
        serverURL: "https://sa.example.com/sa",
        launchOptions: launchOptions
    )
    options.autoTrackEventType = [.appStart, .appEnd, .appClick, .appViewScreen]
    options.enableLog = true  // dev only
    SensorsAnalyticsSDK.start(configOptions: options)
}
```

**统一封装**：

```swift
@objcMembers
public final class XYZTracker: NSObject {
    public static let shared = XYZTracker()

    public func track(_ event: String, properties: [String: Any] = [:]) {
        SensorsAnalyticsSDK.sharedInstance()?.track(event, withProperties: properties)
    }

    public func setLoginID(_ userID: String) {
        SensorsAnalyticsSDK.sharedInstance()?.login(userID)
    }
}
```

**约定**：
- **永远通过统一 `XYZTracker` 调用**，不直接 `SensorsAnalyticsSDK.sharedInstance()` 散落代码
- 事件名用 `snake_case`，字段名同
- 公共属性（user_id、device_id、版本）用 `registerSuperProperties`
- 隐私合规：用户未同意隐私协议前 **不得** 调用 `start`
- Debug 模式开启 `enableLog`，Release 关闭

## 7. 混合开发集成（Flutter + React Native）⭐

### 7.1 Flutter Module 集成

**独立 Flutter Module**（`my_flutter_module/`）通过 podhelper 集成，不放主仓库。

```swift
import Flutter

final class FlutterContainer {
    static let shared = FlutterContainer()
    let engine: FlutterEngine

    private init() {
        engine = FlutterEngine(name: "shared_engine")
        engine.run()
        GeneratedPluginRegistrant.register(with: engine)
    }
}

// AppDelegate
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions: [...]) -> Bool {
        _ = FlutterContainer.shared  // 预启动 Engine
        return true
    }
}

// 打开 Flutter 页面
final class FlutterEntryViewController: FlutterViewController {
    init(route: String) {
        super.init(engine: FlutterContainer.shared.engine, nibName: nil, bundle: nil)
        setInitialRoute(route)
    }
    required init?(coder: NSCoder) { fatalError() }
}
```

**Method Channel 通信**：

```swift
let channel = FlutterMethodChannel(
    name: "com.example.app/native",
    binaryMessenger: FlutterContainer.shared.engine.binaryMessenger
)

channel.setMethodCallHandler { call, result in
    switch call.method {
    case "getToken":
        result(AuthSession.shared.token ?? "")
    case "openLogin":
        Router.shared.openLogin()
        result(nil)
    default:
        result(FlutterMethodNotImplemented)
    }
}
```

**约定**：
- 单一 `FlutterEngine` 实例（共享），多页面复用，节省 ~30MB 内存
- `setInitialRoute` 必须在 `super.init` 后立即调用
- Flutter 页面与原生页面互跳通过 Method Channel + 路由统一中心
- 资源：图片放 Flutter Module 内，避免与原生重复

### 7.2 React Native 集成

```objc
// 初始化 Bridge
- (RCTBridge *)bridge {
    if (!_bridge) {
        _bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:nil];
    }
    return _bridge;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge {
#if DEBUG
    return [NSURL URLWithString:@"http://localhost:8081/index.bundle?platform=ios"];
#else
    return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

// 打开 RN 页面
RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:self.bridge
                                                  moduleName:@"OrderListModule"
                                           initialProperties:@{@"userId": userId}];
UIViewController *vc = [UIViewController new];
vc.view = rootView;
[self.navigationController pushViewController:vc animated:YES];
```

**Native Module（让 RN 调用原生）**：

```objc
@interface XYZAuthModule : NSObject <RCTBridgeModule>
@end

@implementation XYZAuthModule
RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *token = [[XYZAuthSession shared] token];
    if (token.length > 0) {
        resolve(token);
    } else {
        reject(@"NO_TOKEN", @"User not logged in", nil);
    }
}
@end
```

**约定**：
- 单一 `RCTBridge` 实例，多 RN 页面复用
- Native Module 用 OC 写最简单（RN bridge API 是 OC 优先）；Swift 包装一层 OC Wrapper
- 资源、图片由 RN bundle 管理，不混入原生
- Hermes 视 RN 版本而定（RN 0.64+ 可启用）

### 7.3 Flutter 与 RN 共存策略

- **不要**在同一页面内同时嵌 Flutter 和 RN（会有两个 JS 引擎运行，体验差）
- **路由统一**：所有页面入口走 `Router` 中心，由 router 决定是 native / Flutter / RN
- **数据共享**：通过原生层（如 KeychainStore + UserDefaults）作为 Source of Truth；Flutter 用 Method Channel、RN 用 Native Module 各自访问
- **二进制大小**：Flutter ≈ +15MB（arm64），RN ≈ +10MB；要严格审视是否两者都需要
- **崩溃监控**：Flutter 崩溃需自行接入（Sentry Flutter SDK），RN 崩溃通过 Sentry RN SDK
- **登录态同步**：原生登录后，主动通过 Method Channel / Native Module 通知 Flutter / RN 更新

## 8. 性能、安全、可访问性

### 性能

- **启动**：AppDelegate `didFinishLaunching` 内只做必要初始化；其余延迟到首屏后
- **图片**：Kingfisher 必加 `DownsamplingImageProcessor`；列表项不要直接 `UIImage(named:)` 大图
- **列表**：UITableView/UICollectionView 用 cell 复用 + `prepareForReuse` 清理
- **离屏渲染**：避免 `cornerRadius` + `masksToBounds`（大量列表项）；用 `cornerCurve` + 预设图片
- **主线程阻塞**：禁止主线程同步 IO；网络/数据库走 `DispatchQueue.global` 或 RxSwift `ConcurrentDispatchQueueScheduler`
- **内存峰值**：用 Instruments → Allocations / Leaks 检查
- **Flutter 引擎**：复用单例
- **RN bundle**：拆 base bundle + 业务 bundle，减小冷启动
- **包大小**：用 App Thinning + On-Demand Resources；图标资源用矢量

### 安全

- **HTTPS 强制**：`Info.plist` 中 `NSAppTransportSecurity` 不要 `NSAllowsArbitraryLoads = YES`
- **证书钉扎**：Alamofire `ServerTrustManager` + `PinnedCertificatesTrustEvaluator`
- **Keychain**：Token、密钥用 Keychain，**不要** UserDefaults
- **二进制保护**：开启 PIE、Stack Canary（默认）
- **代码混淆**：Swift 反射限制下，名称混淆需 SourceKit 工具或编译期脚本（项目可选）
- **字符串加密**：硬编码 token / 密钥用 NSData + xor 简单混淆，**不要明文**
- **越狱检测**（金融类）：检查 `/Applications/Cydia.app`、`fork()` 行为
- **截屏防护**：敏感页面 `UIApplication.willResignActiveNotification` 时遮罩
- **WKWebView**：禁用任意 JS 注入，限制 `javaScriptCanOpenWindowsAutomatically`
- **隐私合规**：Info.plist 必填（NSPhotoLibraryUsageDescription、NSCameraUsageDescription 等）；首次启动隐私弹窗

### 可访问性（VoiceOver）

- 所有按钮 / 图片 `accessibilityLabel` 非空
- 装饰性图片 `isAccessibilityElement = false`
- 触摸目标 ≥ 44×44 pt
- 颜色对比度 ≥ 4.5:1
- 支持动态字体：UIFont `preferredFont(forTextStyle:)` + `adjustsFontForContentSizeCategory = true`
- 表单字段有清晰 label
- 自定义控件实现 `accessibilityTraits`、`accessibilityValue`

## 9. 反模式清单（明确禁止）

| ❌ 禁止 | ✅ 替代 |
|---|---|
| 引入 SwiftUI / Combine | iOS 12 不支持；用 UIKit + RxSwift |
| `async/await` 主代码路径 | Completion handler / RxSwift Observable |
| Swift `!` 强解（除 IBOutlet + 100% 确认） | `if let` / `guard let` / `??` |
| OC 不写 `nullability` | `NS_ASSUME_NONNULL_BEGIN/END` 包裹 |
| Swift 类未 `@objc` 还期望 OC 调 | 加 `@objcMembers` 或继承 NSObject |
| Swift 默认参数（OC 调用方） | 重载提供完整参数版本 |
| 同一新模块同时用 Alamofire 和 AFNetworking | 选一种；OC 用 AF，Swift 用 AF |
| RxSwift 订阅不放 DisposeBag | 永远 `.disposed(by: disposeBag)` |
| RxSwift 闭包不用 `[weak self]` | 必须 `[weak self]` 或 `[unowned self]` |
| 列表搜索用 `flatMap` | 用 `flatMapLatest`（取消旧请求） |
| 子线程更新 UI | `.observe(on: MainScheduler.instance)` 或 `DispatchQueue.main.async` |
| 主线程同步网络 / 数据库 | 后台队列 + 回主线程 |
| `UIImage(named:)` 加载列表大图 | Kingfisher + `DownsamplingImageProcessor` |
| Token 存 UserDefaults | Keychain |
| OC `assign` 给对象类型 | `strong` / `weak` / `copy` |
| OC block 属性用 `strong` | `copy` |
| OC 字符串属性用 `strong`（应 `copy` 避免可变副作用） | `copy` |
| OC delegate 用 `strong`（循环引用） | `weak` |
| RxSwift / KVO / NotificationCenter 三套混用 | 统一 RxSwift |
| 在 ViewController 写大量业务 | 抽到 ViewModel |
| 全局可变单例无锁 | 加 lock 或用 `dispatch_once` |
| 直接 `SensorsAnalyticsSDK.sharedInstance().track(...)` 散落 | 统一 `XYZTracker.shared.track(...)` |
| Flutter Engine 每次创建 | 单例 + 共享 |
| RN Bridge 每次创建 | 单例 + 共享 |
| Flutter 与 RN 同页面嵌套 | 路由层选择一种 |
| Storyboard + SnapKit 混用 | 选一种风格 |
| `print` 散落生产代码 | CocoaLumberjack `DDLogInfo` |
| `try!` Swift | `try?` 或 `do-catch` |
| 全局函数无命名空间 | 放 enum/struct 作命名空间 |
| 在 OC 用 Swift 泛型类 | 设计具体类型替代 |

## 10. 决策提示（when to use what）

**Swift vs OC（新代码）**：
- 默认 **Swift**
- OC 适用：底层 C/C++ 互操作（用 `.mm`）、与 OC-only 库桥接层、需要 method swizzling、需要 KVC

**MVVM vs MVVM-Rx vs VIPER**：
- 中小模块、有简单数据流 → **MVVM**（手写 binding）
- 复杂数据流、链式异步 → **MVVM-Rx**（默认推荐）
- 超大模块、严格分层 → VIPER（成本高，慎用）

**Storyboard vs xib vs 纯代码 + SnapKit**：
- 老页面已用 → 保留
- 新页面 → **纯代码 + SnapKit**（Diff 友好、运行时少出问题）
- 简单静态页面 → xib 也可

**RxSwift Subject 类型**：
- UI 当前状态、需要初值 → `BehaviorRelay`
- 用户事件流（点击、滚动） → `PublishRelay`
- 需要错误传播 → `BehaviorSubject` / `PublishSubject`
- 输出给 View 用 → `Driver` / `Signal`（不出错 + 主线程）

**Codable vs YYModel vs MJExtension**：
- 新 Swift 代码 → **Codable**
- OC 模块 → **YYModel**（性能） 或 **MJExtension**（易用，已大量使用则保留）
- 嵌套复杂、需要 customize → Codable + 手写 `init(from decoder:)`

**WCDB vs CoreData vs FMDB / GRDB**：
- 项目已选 WCDB → **WCDB**
- 新项目可考虑 GRDB（Swift-first）或 Core Data（Apple 原生）
- 不要在 WCDB 项目里再引入第二个数据库库

**SnapKit vs Auto Layout API**：
- 默认 **SnapKit**（DSL 简洁）
- 一两条约束、已用纯 Apple API → 保留
- iOS 13+ 可用 `NSLayoutAnchor`（仍不如 SnapKit 简洁）

**Kingfisher vs SDWebImage**：
- Swift → **Kingfisher 7.x**
- OC → **SDWebImage**
- 不要双库共存（缓存重复 + 配置两套）

**Coordinator vs UINavigationController 直推**：
- 中大型项目（>10 个页面） → **Coordinator**
- 小项目 → 直接 `pushViewController`

**Flutter vs React Native（新模块选哪个）**：
- 已有团队 Flutter 经验 → Flutter（性能好、UI 一致性强）
- 已有 Web/React 团队 → React Native（复用人才）
- 都要审视：包体积 / 维护成本 / 招聘
- **本项目两者已并存**：新模块按业务方决策；不要再加第三种跨端方案

**何时引入新模块（私有 Pod）**：
- 跨多个 App 复用 → 拆 Pod
- 单 App 内复用 → 文件夹组织即可
- 不要为单一目的预先拆 Pod

## 11. 测试

- **Unit Test**：`AppTests/` 目录，`XCTest` + 简单 mock；纯逻辑（ViewModel、Service、Mapper）必测
- **UI Test**：`AppUITests/`，关键路径覆盖（登录、下单等）
- **快照测试**：`SnapshotTesting`（pointfreeco）可选
- **覆盖率目标**：业务逻辑 ≥ 60%
- **Mock 策略**：
  - 协议化依赖（如 `APIClient` 协议） + 测试用 `MockAPIClient`
  - **Mockingbird** 或手写 fake 类
  - **不要** mock UIKit 原生类
- **RxTest** + `TestScheduler` 测试 RxSwift 数据流

```swift
import XCTest
import RxSwift
import RxBlocking
@testable import App

final class LoginViewModelTests: XCTestCase {
    func test_loginSuccess_emitsSuccess() throws {
        let mockService = MockAuthService()
        mockService.loginResult = .success(User.fixture)
        let vm = LoginViewModel(service: mockService)

        vm.emailRelay.accept("a@b.com")
        vm.passwordRelay.accept("password123")
        vm.loginTapRelay.accept(())

        let user = try vm.loginSuccess.asObservable()
            .toBlocking(timeout: 1.0).first()
        XCTAssertEqual(user?.email, "a@b.com")
    }
}
```

## 12. 工具链与交付

### 12.1 CocoaPods

- `pod install` 后必提交 `Podfile.lock`
- 用 `pod outdated` 检查更新；不主动追新版（兼容 iOS 12 / Swift 5）
- 私有 Pod 用私有 spec repo
- 国内镜像：`source 'https://github.com/CocoaPods/Specs.git'`（必要时切清华镜像）

### 12.2 xcconfig 多环境

```
// Configurations/Debug.xcconfig
API_BASE_URL = https:/$()/api-dev.example.com
SENSORS_SERVER_URL = https:/$()/sa-dev.example.com/sa
APP_ENV = dev

// Configurations/Release.xcconfig
API_BASE_URL = https:/$()/api.example.com
SENSORS_SERVER_URL = https:/$()/sa.example.com/sa
APP_ENV = prod
```

`Info.plist` 中引用：`<key>API_BASE_URL</key><string>$(API_BASE_URL)</string>`

代码中读取：`Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String`

### 12.3 Fastlane

```ruby
# fastlane/Fastfile
default_platform(:ios)

platform :ios do
  desc "Build & upload TestFlight"
  lane :beta do
    cocoapods(podfile: "./Podfile")
    increment_build_number(xcodeproj: "App.xcodeproj")
    build_app(workspace: "App.xcworkspace", scheme: "App", configuration: "Release")
    upload_to_testflight(skip_waiting_for_build_processing: true)
  end

  lane :release do
    build_app(workspace: "App.xcworkspace", scheme: "App", configuration: "Release")
    upload_to_app_store(force: true, submit_for_review: false)
  end
end
```

### 12.4 CI 五件套

`pod install` → SwiftLint → SwiftFormat → `xcodebuild test` → `fastlane build_app`

### 12.5 Lint

- **SwiftLint**：`.swiftlint.yml` 配置，CI 跑 `swiftlint --strict`
- **SwiftFormat**：自动化格式化
- **OC 端**：可选 `OCLint`（配置成本高，按需）

### 12.6 错误监控 / 上报

```swift
import Bugly  // 或 Sentry

func application(_ application: UIApplication, didFinishLaunchingWithOptions: [...]) -> Bool {
    let cfg = BuglyConfig()
    cfg.reportLogLevel = .info
    Bugly.start(withAppId: "<APP_ID>", config: cfg)
    return true
}
```

- **dSYM 上传**：脚本（`buglySymboliOS.sh` / `sentry-cli upload-dif`）放到 Build Phase
- Crashlytics 也是常见选择

### 12.7 包瘦身

- App Thinning + Bitcode（Xcode 14 已废弃 bitcode）
- 删除未使用图片：用 **LSUnusedResources** / **fui**
- 大图走 CDN 不打包
- 多语言按需打包

## 13. 标准代码模板

### 13.1 ViewController（Swift + RxSwift + SnapKit）

```swift
import UIKit
import RxSwift
import RxCocoa
import SnapKit
import Kingfisher
import MJRefresh

final class HomeViewController: UIViewController {

    private let viewModel: HomeViewModel
    private let disposeBag = DisposeBag()

    private lazy var tableView: UITableView = {
        let tv = UITableView()
        tv.register(HomeItemCell.self, forCellReuseIdentifier: HomeItemCell.reuseId)
        tv.rowHeight = 80
        tv.separatorStyle = .singleLine
        return tv
    }()

    init(viewModel: HomeViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        bind()
        XYZTracker.shared.track("page_view", properties: ["page": "home"])
    }

    private func setupUI() {
        view.backgroundColor = .systemBackground
        view.addSubview(tableView)
        tableView.snp.makeConstraints { $0.edges.equalTo(view.safeAreaLayoutGuide) }

        tableView.mj_header = MJRefreshNormalHeader { [weak self] in
            self?.viewModel.refreshTrigger.accept(())
        }
        tableView.mj_footer = MJRefreshAutoNormalFooter { [weak self] in
            self?.viewModel.loadMoreTrigger.accept(())
        }
    }

    private func bind() {
        viewModel.items
            .drive(tableView.rx.items(cellIdentifier: HomeItemCell.reuseId,
                                       cellType: HomeItemCell.self)) { _, item, cell in
                cell.configure(with: item)
            }
            .disposed(by: disposeBag)

        viewModel.isRefreshing
            .drive(onNext: { [weak self] refreshing in
                if !refreshing { self?.tableView.mj_header?.endRefreshing() }
            })
            .disposed(by: disposeBag)

        tableView.rx.modelSelected(HomeItem.self)
            .subscribe(onNext: { [weak self] item in
                self?.openDetail(item)
            })
            .disposed(by: disposeBag)
    }

    private func openDetail(_ item: HomeItem) { /* ... */ }
}
```

### 13.2 OC 调 Swift 服务

```objc
// LegacyTrackerBridge.m
#import "LegacyTrackerBridge.h"
#import "App-Swift.h"

@implementation LegacyTrackerBridge

+ (void)trackEvent:(NSString *)event {
    [[XYZTracker shared] track:event properties:@{}];
}

@end
```

### 13.3 Flutter Method Channel 处理

```swift
final class FlutterBridgeHandler {
    static func setup() {
        let channel = FlutterMethodChannel(
            name: "com.example.app/native",
            binaryMessenger: FlutterContainer.shared.engine.binaryMessenger
        )
        channel.setMethodCallHandler { call, result in
            switch call.method {
            case "getToken":
                result(AuthSession.shared.token ?? "")
            case "track":
                if let args = call.arguments as? [String: Any],
                   let event = args["event"] as? String {
                    XYZTracker.shared.track(event, properties: args["props"] as? [String: Any] ?? [:])
                }
                result(nil)
            default:
                result(FlutterMethodNotImplemented)
            }
        }
    }
}
```

## 14. 行为约定（对 AI 的指令）

写代码时遵循：

1. **版本约束第一**：所有建议必须能在 iOS 12 + Swift 5（5.5-5.7）+ Xcode 14 上运行；不能用 SwiftUI / Combine / async-await（主路径）；遇到 iOS 13+ API 必须 `@available` 或运行时检测
2. **混编原则**：新代码用 Swift；**不要主动改写**已有 OC 代码；跨语言接口必须加互操作注解（`@objc` / `nullability`）
3. **先读后写**：修改前先读 `Podfile`、`Podfile.lock`、`App-Bridging-Header.h`、相关源文件，确认现有约定与依赖版本
4. **OC API 必标 nullability**：所有 public 方法/属性加 `_Nullable` / `_Nonnull` 或用 `NS_ASSUME_NONNULL_BEGIN/END`
5. **Swift API 必须友好对 OC**：`@objcMembers` / 自定义 `@objc(name)` / 重载提供 OC 友好版本
6. **三方库使用**：严格按第 6 章规范，不引入功能重复的库；新模块不混用 Alamofire/AFNetworking、Kingfisher/SDWebImage
7. **混合开发**：Flutter Engine 与 RN Bridge 必须复用单例；不要在同一页面嵌两种跨端
8. **小步快跑**：每次修改后 `pod install`（如改 Podfile）→ `xcodebuild build` → `xcodebuild test`
9. **不预先抽象**：YAGNI；不预先拆 Pod
10. **不建议升级**：除非用户明确要求，不要建议提升 iOS 最低版本或更换基础库
11. **回答中文为主**，代码与标识符英文
12. **明确产出**：改完后总结：动了哪些文件、跨语言/跨技术栈影响、怎么验证（编译 / unit test / 真机）

