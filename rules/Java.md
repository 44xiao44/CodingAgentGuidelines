---
description: Java 服务编码规范
version: 1.0.0
globs: **/*.java
alwaysApply: false
---

# Java 服务编码规范

> 通用行为约束、简洁优先、边界与异常理念见通用规范 general（本文件不重复）；注释「先业务、后设计」的落地要求在下方「注释规范」章节直接给出，不跨文件引用。

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

### 先业务、后设计（关键代码块内联注释）

复杂业务逻辑必须写中文内联注释，顺序固定：① `// [业务]` 解决什么业务问题 → ② `// [设计]` 为何这样实现、有何约束/取舍。

- 复杂业务方法的关键代码块前必须先 `[业务]` 后 `[设计]`；简单直白代码不注释。
- 一个复杂方法内至少覆盖 3 个关键点：① 入口校验 ② 关键分支/不变量 ③ 关键转换或遍历目的。
- 每条注释 1 句话，只写在关键代码块前；禁止复述代码字面动作（如「定义变量/判空/返回结果」）。
- `[业务]` 说清「解决什么问题」，`[设计]` 说清「为什么这样做」，二者顺序不可颠倒。

```java
// [业务] 根据历史设备编号批量查询设备信息，避免导入时逐条访问数据库。
// [设计] 用 Set 入参、Map 出参，调用方可直接按编号取值，无需再遍历 List。
Map<String, Device> deviceMap = deviceService.getByCodes(deviceCodes);

// [业务] 入口校验：订单号为空直接失败，不进入后续查询链路。
// [设计] fail fast，避免把空值透传到下游造成无意义的空结果。
if (StringUtils.isBlank(orderId)) {
    throw new BusinessException("订单号不能为空");
}
```

### Javadoc

- 所有类、方法和实体的字段必须有 Javadoc 注释；方法 Javadoc 首句写业务职责（做什么、为谁做），而非罗列参数。
- Javadoc 用 `@param` / `@return` / `@throws` 描述技术细节，并在其中明确前置条件、后置条件（如「order_id 必须非空」「命中即返回，不会返回 null」）。
- Javadoc（对外契约）与 `[业务]/[设计]`（方法体内关键步骤）职责不同，二者都要写，不可互相替代。


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
- 批量写操作（批量 update / insert / upsert / delete）必须做批大小控制：单批超过阈值时循环分批处理，避免单条 SQL 报文过大、`IN` 参数超限、锁范围过大、长事务与内存峰值
  - 默认阈值 `BATCH_SIZE = 200`，提取为带业务注释的常量，禁止魔法数字；阈值按操作复杂度调整（简单单字段 update 可放大到 500-1000，多字段 upsert 应更小），调整时注释说明依据
  - 分批优先复用已有工具（Guava `Lists.partition`、Hutool `CollUtil.split`、Commons `ListUtils.partition`），不手写 `subList` 循环
  - 必须显式决策分批后的事务与失败语义：是「整体一个事务」还是「每批独立事务」；某批失败时前面已成功的批是否回滚、是中断还是跳过并记录失败明细。不允许默默各批独立提交而不说明
  - 若框架已内建批处理（MyBatis `ExecutorType.BATCH`、JPA `hibernate.jdbc.batch_size`），先确认是否已生效，避免手动再切一层造成冗余

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

