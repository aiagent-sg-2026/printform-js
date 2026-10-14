# Studio v3 工程重开与数据导入的 JSON 安全边界

## 问题与修复范围

原有 `readProject()` 仅限制工程文件总字节数，并检查设计、清单及样本数据的根类型；不会像 `validateDataset()` 一样检查样本内部危险键、节点数、深度或非有限数值。实际Node24调用旧版：含`__proto__`的相同样本被工程重开接受、被数据集入口拒绝；修复后两个入口均以`UNSAFE_JSON_KEY`拒绝，自定义`/shipments`绑定与`toString`／`a/b`键原样保留。

现在 `studio-v3/json-safety.js` 是共享实现：

- `readProject()` 的 JSON 文件入口在提取工程前检查整个外层对象；HTML 入口先使用现有惰性 DOM 解析，再检查解析得到的工程对象，包括随后不会保留的 schema 等 JSON 字段。
- 工程样本在克隆、创建新工程、编译之前再次按数据预算检查。
- `importDataset()` 在读取格式与数据集属性前检查整个输入，再由 `validateDataset()` 检查数据本身；数据集直接校验也使用同一实现。
- 高级 JSON 编辑器的 `parseSampleJSON()` 同样使用共享边界；语法错误仍报告行列，安全预算错误保留专用错误码，不误报为语法错误。
- 数据路径与字段枚举沿用共享实现中的同一危险键集合，不再维护第二套集合。

## 明确契约

| 范围 | UTF-8 字节预算 | 深度与节点预算 |
| --- | --- | --- |
| `.printform.json` 或 HTML 文件 | 10 MiB | 解析所得工程对象/JSON 外层最多深度 18、50,000 节点 |
| 工程 `sampleData` | 紧凑 JSON 序列化后 2 MiB | 以样本根为深度 0，最多深度 16、50,000 节点 |
| 原始或包装的数据集文件 | 文件文本 2 MiB | 外层最多深度 18、50,000 节点；数据本身另受深度 16、50,000 节点及紧凑 JSON 2 MiB 限制 |
| 高级 JSON 编辑器 | 输入文本 2 MiB | 根深度 0，最多深度 16、50,000 节点 |

节点包括对象、数组及标量值，不单独计算属性名。外层对象及其元数据也占节点预算，因此数据恰好占满 50,000 节点时，包装文件可能先超出外层预算。字节限额为 MiB（界面错误文字沿用 MB）。

所有层级的自有属性名 `__proto__`、`prototype`、`constructor` 均拒绝；JSON Unicode 转义后的等价键也拒绝。不删除字段、不截断数据、不把恶意输入自动清洗为有效工程。普通自定义键（如 `toString`、`valueOf`、`hasOwnProperty`、空字符串、含 `/`、`~` 或中文的键）保留。数值必须有限，包括 JSON 数值 `1e999` 解析出的 Infinity；直接对象校验不接受函数、undefined 或非 JSON 对象。

工程重开**不调用数据集的业务结构校验**：合法的 `/shipments` 等自定义集合、无 `/items` 的工程和原始未知字段仍可重开；不会为了套用数据库模型而新增 `/items` 或修改绑定。数据集导入继续要求 `/items` 为至多 500 条对象记录的数组，并保留原有货币及已知数值字段校验。这个修复没有把这些数据集业务限制强加给工程重开。

共享结构检查在原生 `JSON.parse()` 之后、规范化/克隆/工程编译之前进行；解析前先限制文本字节数。它不是流式解析器，不宣称在原生解析器分配任何对象之前完成深度检查。HTML 的既有 DOMParser 行为不变，本页不宣称验证运行时签名或外部 ERP 内容的真实性。

工程读取返回新工程；异常不会安装该工程。数据集导入失败发生在丢弃草稿、写入本地数据库、修改选择和应用到表单之前。已有数据库保存/应用时的其他故障处理并非本次范围。ERP 提供的金额、税额和币种数据不重算；不会产生汇率、过账、联网 ERP、打印机或硬件验收声明。

## 可执行的临时复现命令（不创建文件）

在仓库根目录、满足 package.json 的 Node 版本要求时，由集成人员运行：

```sh
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import {newProject,compileProject,designOf} from './studio-v3/model.js';
import {readProject,saveProject} from './studio-v3/file-io.js';
import {importDataset} from './studio-v3/database-model.js';
const project = newProject(), design = designOf(project);
project.sampleData.shipments = project.sampleData.items;
delete project.sampleData.items;
project.sampleData.custom = {'toString':'ERP supplied','a/b':{'x~y':317}};
design.collection = '/shipments';
const custom = compileProject(project,design), before = structuredClone(custom);
assert.deepEqual(readProject(saveProject(custom)).sampleData,custom.sampleData);
const file = JSON.parse(saveProject(custom));
file.project.sampleData = JSON.parse('{"items":[],"custom":{"__proto__":{"polluted":true}}}');
const result = operation => {
  try { operation(); return 'accepted'; }
  catch (error) { return `rejected: ${error.code || error.name}`; }
};
console.log({
  project:result(()=>readProject(JSON.stringify(file))),
  dataset:result(()=>importDataset(JSON.stringify(file.project.sampleData),'invoice'))
});
assert.deepEqual(custom,before);
assert.equal(Object.hasOwn(Object.prototype,'polluted'),false);
NODE
```

父任务已用实际Node24执行：旧版输出project accepted／dataset rejected；修复版project与dataset均rejected:UNSAFE_JSON_KEY；自定义集合往返保留，原工程与Object.prototype不变。初次带已移除的`--experimental-default-type=module`旗标在启动阶段exit9；移除此旗标后真正运行，未将启动失败算通过。

## 永久回归与实际验证

`tests/studio-v3-project-import-safety.test.js` 通过真实消费者覆盖：JSON/HTML 重开并绑定自定义集合、数据集导入/导出的未知键与金额保留、三种危险键和转义键、外层及被丢弃 HTML JSON 字段、深度边界、深/宽/UTF-8 大输入、非有限数值、语法错误，以及真实内存数据库下拒绝导入后保存记录、选择、工程修订和未应用草稿不变。它不以源代码字符串、替身接线或模拟响应复述代替消费者行为；内存模式只是通过禁用 IndexedDB 使用产品已有的降级实现。

实际Node24/Vitest4串行专项 **10 files / 90 tests passed**；强化数据边界断言并删除模板源码/文案断言后，最终完整`build:site` **224 files / 2,279 tests passed**，runtime/site及publication gate完成。另三引擎业务consumer **24/24 passed**。before/after实际导入命令和数据库不变回归证明修复路径，不替代真实ERP或硬件认证。

```sh
npm test -- --run --maxWorkers=1 --no-file-parallelism tests/studio-v3-project-import-safety.test.js tests/studio-v3-database.test.js tests/studio-v3.test.js
```

不以测试覆盖意图冒充物理设备、真实ERP或全部输入验收。完整main托管run与最终checkout SHA由GitHub验收评论及KBverification记录。
