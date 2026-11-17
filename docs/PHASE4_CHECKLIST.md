# Phase 4 — MCP Server 开发验收清单

日期：2026-11-17

| 优先级 | 任务 | 本次交付 | 尚待验证或实施 |
|---|---|---|---|
| P0 | Node.js LTS、TypeScript、MCP SDK | package.json、tsconfig、SDK v2 代码 | npm 安装与 TS 类型编译（本环境 npm DNS 不可用） |
| P0 | Streamable HTTP Endpoint | `/mcp` + HTTP Bearer + `/health` | 真实 SDK HTTP 握手 |
| P0 | list_custom_forms | MCP 工具 + MOCK + SAP Bridge 契约 | SAP ICF 服务实施 |
| P0 | get_form_metadata | MCP 工具 + MOCK + SAP Bridge 契约 | SFP 数据提取与 SAP 授权 |
| P0 | get_form_interface | MCP 工具 + MOCK + SAP Bridge 契约 | SFP Interface ABAP 读取实现 |
| P0 | get_form_context | MCP 工具 + MOCK + SAP Bridge 契约 | SFP Context ABAP 读取实现 |
| P1 | get_form_layout | XDP base64 解码、XML 校验、按需输出 | 在 DEV 验证从经典 SFP 提取 XDP |
| P1 | analyze_form_scripts | FormCalc / JavaScript 生命周期静态扫描 | 使用真实 XDP 做事件完整性和回归验证 |
| P1 | SAP Destination / Client | JSON 定义 DEV100，环境变量存储 SAP 密钥 | 接入 DEV100、证书和 SAP 技术用户权限 |

## 必须坚持的边界

- 这是只读服务，不对 SFP 对象执行编辑、创建、激活、删除或传输。
- `SAP_BRIDGE` 是自定义接口契约，不是 SAP 官方内置现成 API。
- Mock 的 ZDEMO 表单为人工创建的演示数据，不能被当成真实 SAP 结果。
- 不能将语法检查通过等同于 TypeScript 类型编译、npm test、实际 SAP 连接成功。
- 完整测试顺序：安装依赖 → `npm run check` → `npm run build` → `npm test` → `npm start` → `npm run smoke` → SAP 端端到端验证。
