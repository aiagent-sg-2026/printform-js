# 源码制品：同发布身份、严格解析与人工提交

本页描述当前真实调用链及受控本地验证程序；不是新增执行授权，也不是Docker、真实模型、物理打印或生产资格的通过证明。普通Studio仍浏览器优先、ERP独立；只有用户明确披露的公开虚构starter进入可选源码工作区。配额、模型、路由、预算、隔离参数及冻结G8不变。

## 1. 身份不是一个版本字符串

- `coding-runner/identity.mjs::runnerSourceHash()`按排序后的`Dockerfile`与所有`.mjs`文件的精确名称/字节计算hash；测试文件也在其中。所有runner改动落定后才生成发布资料及构建镜像；旧镜像不能借同名tag成为新源码。
- `scripts/generate-studio-v3-agent.mjs`把该hash并入`packageHash`及生成的身份。Vite把相同身份注入`AGENT_BUILD_IDENTITY`。
- `verifyAgentRelease()`核对`./releases/<release>/agent/agent-manifest.json`与运行bundle的`release/contractHash/knowledgeHash/packageHash/sourceRunnerHash`。不能只读取远端manifest就宣称当前bundle相同。
- `DockerBroker.initialize()`检查image的不可变`sha256:` ID及`io.printform.coding.protocol=printform-coding-v1`、`io.printform.coding.base`标签，然后在受限容器中执行sealed `identity.mjs`，核对容器hash与宿主源码hash。
- `pairSourceRunner()`校验协议、profile、hash、1MiB响应上限、bearer长度与到期时间。`SourceWorkspaceRun.open()`再次要求发布的`sourceRunnerHash`与连接相同，之后才创建工作区。
- 工作区绑定四元组`releaseIdentity`、当前`documentId`、`baseRevision`和唯一`runId`；create回执另给`workspaceId/revision/treeDigest/imageDigest`。发布四元组不能与第五个runner hash混为同一个字段。

## 2. 配对、lease、run和回执

`/pair`是本机人工导航页；`POST /v1/pair`以一次性代码取得内存bearer。代码/bearer不进入聊天、模型参数、项目、URL、storage、截图或证据日志。每个连接的令牌到期与每个工作区的空闲到期是两种时钟；单次call的互斥`lease`又是不同概念。

`SourceConnection.call()`先提交`POST /v1/workspaces/<id>/calls`，若返回running，随后用`GET .../calls/<callId>?wait=1`等待真实终态。服务端`Workspaces.accept()`验证owner、revision、配额及无已有lease；`finally`才释放lease并完成回执。

`run`在独立受限容器中执行；回执含实际exit、signal、进程时间、before/after revision/tree及image。只有非零`COMMAND_FAILED`且效果已知时才是可继续修复的失败。未知效果、无效回执或清理不明不能当作成功，也不能盲重试。测试源码及stdout可编辑，不能成为独立资格oracle。

## 3. 从精确字节到私有draft

1. `workspace_artifacts`必须引用本次记录的成功run `callId`。后端`operations.artifact()`要求run已完成、无error、exit0，且当前revision/tree仍等于该run结束时；制品是有界`.json`普通源码文件。opaque ID包含workspace、call、path、revision、tree、文件digest及image。
2. `verifySourceArtifact()`校验媒体类型、64000原始UTF8 bytes、原文SHA256、全部custody字段及恰好四个release身份字段。BOM参与bytes/hash，仅解析视图移除开头BOM。
3. **先复用`parseLosslessRecords()`做有界严格预检，再用`JSON.parse()`保留native类型。** 所有层级重复键（含Unicode转义解码后的同键、相同重复值）、`__proto__/prototype/constructor`、非法JSON、尾随文本及过深/过多节点均拒绝，统一映射为`ARTIFACT_REJECTED`。不修改共享parser，不把number词形字符串直接当操作数字，不放松权限。
4. native解析后仍只接受`format/version/summary/operations`；version必须number `1`，summary非空且≤500字符，operations为1..24项。严格预检不是业务验证。
5. `import_artifact`要求真正的coding授权、已登记制品，以及制品路径之外确有源码编辑。它重新获取当前制品，重做所有校验，并核对opaque ID与先前digest；缓存ID不批准后续写入。
6. `agent-source-handlers.js`调用原有`draft.apply(summary,operations)`。同一个typed authoring/parser、numeric范围、selected scope及受保护金融绑定不变；不接收任意HTML、脚本或数据篡改。失败不产生draft step。
7. 导入成功会清除此前inspection/pixel/observation状态，并把source evidence绑定当前draft version；它只修改私有候选，不写CommandBus或live project。
8. `finish`先`confirmImported()`重新获取/校验制品，再要求同一draft版本的最新inspection且ready。导入不是免检通行证；其他直接draft改动/undo会清掉source evidence，不能沿用旧检查。

## 4. Preview与人工Apply不是run权限

`finish`产生proposal后，正常agent清理可关闭源码工作区；proposal仍是已经验证的私有候选，而不是一项待提交远端命令。

`AIPanel.preview()`对当前proposal重新渲染，并经`inspectProject(candidate,report)`确定checked；未checked、busy、过期bus/revision/design/scope/selection不能Apply。真实用户点击Apply才走`AIPanel.apply()`的intent ledger与应用层`editProject(bus,designOperations(...))`，完成一次CommandBus提交。重复同intent不再提交，Undo沿用既有历史。agent工具没有commit效果。

单元消费者测试可以验证真实业务/状态机与提交逻辑，但不能从synthetic run receipt或布局report fixture推断Docker实际执行、浏览器分页或物理出纸。实际Docker与实际页面证据必须独立记录。

## 5. 本次发现与证据范围

修复前仅用合成、无业务资料的146字节制品复现：它含两个`summary`（`first`与`last`），原始hash为`0c353de9b72dc6ead3af80092227e2eb0e9d25547c89ecd8b1494b9f90dc8024`。原verifier接受，结果summary为`last`。hash/custody正确不消除JSON歧义。

首次诊断命令试图赋值Node23已只读的全局`crypto`而失败；移除不必要赋值后得到上述实际复现。此项是修复前有界runtime调查，不是仓库测试通过记录。未为消除该环境警告修改项目模块配置。

新增`tests/studio-v3-source-artifact-consumer.test.js`直接消费真实backend artifact导出、host verifier、SourceWorkspaceRun导入、typed draft、金融/范围校验、inspection gate及AIPanel人工提交；run receipt及布局report明确为单元fixture，不声称执行了shell或渲染器。覆盖重复/转义/隐藏键、深度/语法、BOM精确字节、native数字、非法数字/范围、金融/选区拒绝、重新取制品、缺失/阻塞inspection、r0私有候选、人工提交r1及重复intent。测试执行由集成负责人统一完成，不能将新增测试代码本身写为Pass。

## 6. 集成负责人专属的安全实际运行程序

以下是可执行前置条件和精确API序列，不是已执行结果。不得启动旧broker，不能使用/重启/停止既有4317服务，不能清理他人容器/volume或调用全局prune。

### 6.1 只创建自己的镜像与broker

1. 等`coding-runner/docker.mjs`的owner清理修复及全部runner文件最终落定，由负责人统一执行回归。修复后的`cleanupExpired()`只列举并核验当前随机`broker.owner`的managed资源，再经`remove()`重新inspect/核对owner后删除；它**不是全局janitor**。旧owner崩溃遗留物不因过期自动取得删除授权。
2. 使用项目要求的Node24，在仓库目录调用`runnerSourceHash()`取得`H`，只构建`coding-runner/`上下文。通过`crypto.randomUUID()`生成`U`，保存本次唯一镜像引用`printform-coding-lifecycle:<H前12位>-<U>`；等价Docker参数为`['build','--tag',image,'coding-runner']`。不可覆盖旧tag或借用旧image。记录image不可变ID及协议/base标签，而不只记tag。
3. 生成/构建同一源码发布前端；核对built bundle的身份与相应manifest。浏览器使用真实已知的测试页面Origin，不修改Origin/CORS/Fetch-Metadata、不关闭浏览器安全，不假装本地fixture是公开部署。
4. `createCodingServer({origin,port:0,image})`创建本次独有broker；`listen()`返回的新随机loopback端口只属于该实例。初始化会再次核对sealed identity。将返回的`runnerSourceHash`与`H`及前端身份核对，imageDigest与先前inspect ID核对。不需要重新查询Docker server版本。
5. 凭证只在内存保存。独立浏览器context人工导航新broker的`/pair`页读取一次性代码，再由真实测试Origin页面执行`pairSourceRunner(code,{baseURL:newUrl})`。保存该连接用于cleanup；不要console/log/JSON序列化配对回复、代码或bearer，也不要把含代码的页面截图放进证据。

### 6.2 真实源码→修复→制品→人审

1. 在真实页面创建公开虚构项目和`createBus()`，记录documentId、r0、data/schema的摘要。用`authorizeSourceWorkspace(connection,{fictionalSource:true})`及`workspace.open({identity,project,baseRevision:bus.revision,runId:crypto.randomUUID()},signal)`创建本次工作区。identity取当前已核对发布，不能手工伪造hash或使用development冒充同发布。
2. 只在公开starter里修改`src/form.mjs`，保留原测试/build源码。用现有write/patch的expectedDigest及正常revision走真实路径。可先加入一个确定失败的虚构heading测试（不改冻结G8），运行`node --test test/form.test.mjs`取得真实非零exit receipt，然后修复源码、重跑相同测试取得exit0；每次保留独立callId/进程状态/源码diff，不拿stdout的“passed”替代回执。
3. 运行`node build.mjs`；在后续任何源码写入前，用成功build的`callId`及`path:'artifacts/form.printform-operations.json'`调用`workspace.artifact()`。保留完整脱敏receipt和制品原始bytes/hash，不仅保留opaque ID。
4. 通过本次`createAgentTools()`的`import_artifact`而非直接赋值design，验证真实typed draft、数字（例如CUSTOM 188.5×244.2）、scope和金融保护；拒绝探针使用独立本次工作区/候选，不能降低授权或改生产数据。调用`inspect_draft`使用真实renderer与`inspectProject`，然后`finish`再次核对来源及最新inspection。
5. 保存/读取live bus必须仍r0、原data/schema不变；独立检查私有candidate的实际纸面标题、尺寸及内容。工作区关闭后proposal仍不能自动提交。实际Preview并明确触发人工Apply后才期望r1，再确认真实模板/binding和data/schema守恒。若有真实PDF，只导出文件，不触发native print dialog、打印机发现、物理打印或扫描。
6. 每一步把期望与实测分开：`H`、bundle/manifest四元组、image ID/标签、workspace/owner、document/base/run、每个call的revision/tree/image、artifact bytes/hash/ID、inspection receipt和humanApply revision必须形成同一条lineage。身份metadata相符仍不是进程执行证明；真实receipt不自动证明模型任务或正式G8成功。

### 6.3 清理与留证

`try/finally`中对本次workspace执行`close()`，再对本次connection执行`revoke()`，最后关闭本次server和browser context；逐项保留脱敏确认。只针对本次确切workspace/owner标签只读检查容器/volume已消失；若清理未知，保留错误并停止新任务，不运行全局janitor。

本次镜像可留作证据或在核对唯一tag仍指向本次构建ID后，仅移除本次tag；不删除共享基础image、不做prune。失败、skip、cleanup未知、只有metadata但无实际进程回执等均原样记录。现有用户服务、旧owner资源、模型/G8、实际业务许可及物理资格不会因此改变。

## 7. 集成后实际观察

- 当前owner资源存留／替换竞态2项通过；旧过期foreign-owner清理的2次删除只在受控命令夹具复现，没有执行真实foreign删除。9项opt-in真实Docker与本地Origin浏览器协议消费者另行通过。
- 同最终源码构建manifest、sealed runner源码hash与新建唯一镜像完成真实链路：原starter测试实际exit1 → 只修源码后相同测试exit0 → build exit0 → 当前tree／build call绑定制品 → `SourceConnection`真实浏览器fetch传输 → 原typed draft工具导入 → 实际离线候选与inspection ready。原测试/build源码未改，未伪造Origin或回执。
- 私有候选阶段live r0保持；显式host commit场景才到r1，标题及188.5×244.2mm生效，data/schema原样。此烟测没有运行原生AIPanel UI或模型；AIPanel Preview／Apply幂等与门禁由17项消费者回归覆盖，不能混称为公开模型任务成功。源码工作区、连接、server及浏览器均已确认关闭，managed容器／卷检查仍为0。
- 第一轮在任何workspace创建前报`IMAGE_UNAVAILABLE`，失败文件保留。后续全环境／受限环境的独立只读检查均读到相同tag及digest，未改Docker上下文／产品；首因未证实，不捏造修复。恢复后的真实链路在独立目录留证。
- 脱敏进程／制品／纸面结果见[实际证据](acceptance/STUDIO_V3_SOURCE_ARTIFACT_20261019.json)。本地首次全量3504通过／1失败／9跳过来自未先刷新workflow生成物；既有生成器刷新后，12项发现／知识回归、127契约／39审查及运行包／站点构建通过。源码镜像断言与残留源码文本断言已移除，不重新钉住文案；首轮5项新夹具变量错误亦保留。

上述均不新增正式G8 attempt，不关闭固定upstream、DPA、完整G6/G8/G9或实体资格。
