---
description: Java 服务编码规范
version: 1.0.0
globs: **/*.java
alwaysApply: false
---

# Java 服务编码规范

> 通用行为约束、简洁优先、边界与异常理念、注释「先业务后设计」见 merged-rules.mdc，本文件只列 Java/Spring 特有落地要求。

## 代码结构与函数设计

- 优先使用 Early Return 处理参数校验、权限、边界条件，避免 if-else 嵌套
- 方法嵌套层不要过度（过度嵌套会影响用户读代码的心智）
- 单个方法不超过 200 行；超过时按逻辑块用 Extract Method 拆分，每个方法名描述"做什么"

## Stream 与 Optional

- 优先用 `Optional` 链式写法替代显式 null 判断与多层 if 嵌套，用 Stream 函数式写法替代命令式循环
- `Optional` / Stream 链中每个操作（`map` / `filter` / `orElse` / `collect` 等）都要加注释，说明该步在做什么业务转换，而非描述语法

  ```java
  // [业务] 从流式响应中安全取出首个 choice 的 delta，任一层为空都返回 null，避免逐层 if 判空
  LLMDeltaMessage delta = Optional.ofNullable(line)
          // [业务] 取出流式 choice 列表
          .map(LLMStreamRes::getStreamChoiceList)
          // [业务] 列表为空则视为无结果
          .filter(list -> !list.isEmpty())
          // [业务] 取首个 choice 的增量消息
          .map(list -> list.get(0).getDelta())
          // [业务] 任一环节缺失时返回 null
          .orElse(null);

  List<String> activeUserNames = users.stream()
          // [业务] 只保留启用状态的用户
          .filter(User::isActive)
          // [业务] 取出用户姓名用于展示
          .map(User::getName)
          // [业务] 汇总为姓名列表返回给上层
          .collect(Collectors.toList());
  ```

## 命名规范

- 类名：大驼峰（`UserOrderService`）
- 方法/变量：小驼峰（`getUserById`）
- 常量：全大写加下划线（`MAX_RETRY_COUNT`）
- 接口不加 `I` 前缀，实现类加 `Impl` 后缀

## 注释规范

> 注释顺序「先业务、后设计」及 docstring 首句写业务职责见 merged-rules.mdc 第 8 条，此处只列 Java 特有要求。

- 所有  类、方法和实体的字段必须有 Javadoc注释
- Javadoc 用 `@param` / `@return` / `@throws` 描述技术细节，并在其中明确前置条件、后置条件（如「order_id 必须非空」「命中即返回，不会返回 null」）


## 异常处理

- 禁止空 catch 块，必须记录日志或重新抛出
- 使用 SLF4J（`@Slf4j`），禁止 `System.out.println`
- 业务异常使用自定义 `BusinessException`，技术异常向上传播

## 返回值

- 集合类型返回空集合，对象类型用 `Optional`，不返回 `null`
- Controller 层统一返回封装对象（`Result<T>`）

## 分层边界

- Controller 只做参数接收、基础校验、响应封装
- 业务逻辑放在 Service 或对应领域层；导入、计算、状态流转、组合查询等不写进 Controller
- 新代码遵循项目已有 DDD / 分层设计，不破坏职责边界

## 数据库与接口 IO

- 数据库查询、远程接口调用、历史数据读取优先批量，避免在循环中逐条查询、逐条插入、逐条调用
- 数据库查询必须有分页或数量限制，禁止无条件全表查询
- 历史数据查询优先 `Set` 入参、`Map` 出参，避免重复数据与调用方二次遍历
- 数据导入/迁移优先批量 `upsert`、批量查询、批量写入

## 类型设计

- 请求/响应优先定义明确的 DTO / Entity / VO，不用 `Map<String, Object>` 或统一 `String` 承载业务数据
- 明确类型可提升序列化、字段取值、阅读与维护质量

## 序列化

- JSON 序列化/反序列化优先使用 fastjson2（`com.alibaba.fastjson2`），不混用 Jackson、Gson 或旧版 fastjson
- 反序列化为泛型集合时使用 `TypeReference` 明确类型，不依赖运行时强转

## 其他

- 不允许直接使用魔法数字，提取为常量并注释业务含义
- 依赖注入使用构造函数注入，不使用 `@Autowired` 字段注入
- 使用类时优先正常 `import`，不在代码中大量写全限定类名；存在同名或歧义类时先确认正确包路径，不靠猜

