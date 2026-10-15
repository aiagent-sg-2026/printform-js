# 浏览器优先的隔离源码工作区

状态：**有界本地Production Pilot，不是完整生产资格**。同一个Pi Harness增加真实文件、测试、修复、构建、diff和结构化制品工具；没有第二套代理引擎，不把浏览器Worker冒充OS shell。

## 非编程用户

普通表单设计仍直接在浏览器使用，无须Pi CLI、Docker或模型密钥。需要源码任务时，由本地管理员安装并运行下述companion；用户只需：

1. AI Settings → Isolated source workspace，打开本机配对页，将一次性代码填入配对框。代码不应发送到聊天。
2. Chromium询问本地网络权限时，确认来源是自己的Studio。配对本身不授权模型执行。
3. 在Sharing permissions明确勾选**仅本次虚构源码/命令输出**，再描述需求。默认关闭；只读建议不会获得写入/进程权限。
4. AI实际读写源码、运行测试并修复，构建JSON操作制品；制品仍经原有作用域、金融绑定、精确候选检查。
5. 用户Preview → Apply；AI不能替用户提交。Undo仍由原有历史管理。Disconnect撤销该连接及其所有工作区。

此profile仅上传内置公开虚构starter，不上传当前project、dataset或schema。不要将真实员工、客户、银行记录或密钥放进Demo聊天、源码或命令输出。

## 管理员启动

要求：仓库依赖、项目要求的Node24及运行中的Docker。当前实际验证平台是Darwin arm64、Docker29.4.0/OrbStack、Chromium151；其他平台/浏览器不能从此外推认证。

```sh
npm run studio:coding-runner
# 自托管Studio仅配置精确Origin，不包含路径：
npm run studio:coding-runner -- --origin https://studio.example.com
```

默认Origin为 `https://yapweijun1996.github.io`，固定绑定 `127.0.0.1:4317`。先校验Origin，再只以 `coding-runner/` 为Docker构建上下文。镜像按源码hash命名，启动校验sealed源码与不可变image identity；不接收任意镜像、宿主命令、模型或预算参数。终端只显示配对URL及公开profile/hash，不显示一次性代码或bearer。Ctrl+C关闭自己拥有的工作区。

升级Studio后须使用相同发布的companion源码；hash不匹配直接拒绝，不切换旧镜像、不关闭Origin/CORS或浏览器安全功能。HTTPS公开页面到loopback属于本地网络访问；不支持时报告缺少环境，不伪造Origin或使用浏览器禁安全参数。

## 支持的边界

| 项目 | 实际契约 |
| --- | --- |
| Profile | `local-docker-node24-source-json-v1` |
| 源码 | UTF8，最多128文件/128目录、每文件256KiB、总4MiB；拒绝越界、symlink及危险路径 |
| 读取 | 有界offset/maxChars窗口，返回完整文件digest、截断状态及nextOffset；不把截断片段冒充全文件 |
| 执行 | 真实 `/bin/sh`、Node24内置模块；单命令最多60秒、输出合计64000原始bytes |
| 传输 | 最大1MiB序列化JSON，覆盖控制字符转义；不是提高模型token/时间预算 |
| 容器 | 无网络、无宿主bind/daemon socket/秘密环境；UID1000、root只读、cap-drop、no-new-privileges、默认seccomp |
| 资源 | 512MiB、CPU2、64pids；独立临时volume12MiB/1024inodes，`/tmp`16MiB/noexec |
| 生命周期 | 每连接最多2工作区；每工作区64calls/16receipts、空闲10分钟、配对token1小时；运行容器在快照前销毁全部子进程 |
| 制品 | 最多64000bytes的JSON，host导出的opaque ID；绑定source revision/tree/image、build call、release四元组、document/base/run |
| Studio导入 | exact格式/version、summary1..500、operations1..24；仍走同一个typed parser/私有draft/金融保护/inspect/人工Apply |

没有依赖下载、宿主仓库挂载、任意HTML/JS浏览器执行、支付/过账、跨租户托管或自动Apply。工作区可修改的测试及stdout“passed”不是独立资格oracle。未知效果不盲重试；清理未确认必须显示未知状态并阻止新任务。

## 已实际执行的本地证据

- backend三文件27项通过，其中9项实际Docker和真实本地Origin浏览器协议：失败→修复→build、越权/Origin/stale/重复intent、Stop/子进程、symlink/配额、未消费创建响应撤销、运行中owner撤销、BOM及转义输出。
- 真正公开Studio Origin的Chromium原生fetch，未设置Origin/Fetch-Metadata、未关闭安全功能；当前**未发布前端模块**与真实companion完成失败exit1→修复exit0→build0→artifact→现有typed draft及binding。此项不是部署后UI或真实模型证明。
- `EFBBBF78`四个源码bytes在无关全树patch后保持；50000个NUL输出的JSON为300864bytes，客户端接受且后续revision一致。
- 合法256KiB控制字符UTF8文件分5个窗口读完，最大响应384586bytes、逐byte相等。初次“必然超预算”的假设被真实分页读取否定，未因此放大限制。
- 两工作区close均确认、principal revoke确认；金融绑定/selected scope/跨release与hash篡改由实际消费者单元回归拒绝。


- 完整Node24 `build:site`实际236文件通过、2552项通过，默认9项Docker opt-in跳过；上述独立PF_CODING_INTEGRATION=1实际执行了这些9项，不把默认skip说成通过。后将原428行传输测试按主题拆成272/163行，原全部74项单独通过。
- 首轮集成发现Stop清理等待颠倒了两次预览恢复顺序，以及重复宿主的ID查询返回null；恢复立即启动并与清理共同等待、控件使用局部属性查询。原有真实竞态/附件行为等7文件128项通过。删除过时文案/源码标题断言，不重新钉住提示语或注册数量。
- 当前未发布本地完整UI在1440×900及390×844实际打开Settings/源码控件：授权默认关闭、无页面异常、无网关推理、无横向溢出，两份实际截图已查看。公开部署后配对/模型任务另行记录。

真实模型、已部署新UI和跨平台负载资格必须单独记录；上述证据不给G8任务计分。正式register仍0/60、0/180，G6/G9、DPA及外部业务权限不因此关闭。

## 官方研究

- [Docker run约束](https://docs.docker.com/engine/containers/run/)与[默认seccomp](https://docs.docker.com/engine/security/seccomp/)：约束及默认过滤不等于完美隔离。
- [Chrome Local Network Access](https://developer.chrome.com/blog/local-network-access)：公开安全来源访问loopback需要真实浏览器权限；不允许伪造来源。
- [Node24 disable-sigusr1](https://nodejs.org/docs/latest-v24.x/api/cli.html#--disable-sigusr1)：sealed PID1禁用SIGUSR1 inspector。
- [RFC8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)：JSON UTF8与BOM边界。源码raw bytes/hash保留BOM，只在JSON parse视图忽略前导BOM。
