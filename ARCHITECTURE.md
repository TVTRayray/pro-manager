# Pro Manager Architecture Snapshot

## 项目结构

- `web/`: React + Vite 前端，负责工作空间与项目的可视化管理。
- `src-tauri/`: Rust + Tauri 后端，暴露命令给前端并负责本地数据管理、系统能力接入。
- `pro-manager.md`: 初始需求说明。

## 数据流与存储

1. **工作空间配置**
   - 配置文件位于 `AppData/workspaces.json`（操作系统相关的 Tauri `app_data_dir` 目录内）。
   - 记录所有工作空间的基本信息、数据库路径以及当前激活的工作空间。
   - 首次启动会自动创建默认工作空间，并持久化配置。

2. **项目数据（每个工作空间独立）**
   - 每个工作空间拥有独立的 SQLite 数据库（默认位于 `AppData/workspaces/<workspace-id>/projects.sqlite`）。
   - 数据库表 `projects` 结构：
     | 字段 | 类型 | 说明 |
     | --- | --- | --- |
     | `id` | TEXT (UUID) | 主键 |
     | `name` | TEXT | 项目名称 |
     | `path` | TEXT | 项目路径（唯一约束） |
     | `description` | TEXT | 备注 |
     | `open_config` | TEXT | JSON 序列化的默认打开配置 |
     | `created_at` / `updated_at` | TEXT | RFC3339 时间戳 |

3. **默认打开方式（OpenConfig）**
   - `system_default`：调用系统关联应用。
   - `custom_command`：用户自定义命令和参数，适配 macOS/Linux 场景。

## 后端命令接口

| 命令 | 功能 |
| --- | --- |
| `list_workspaces` | 获取所有工作空间列表 |
| `get_active_workspace` | 返回当前激活的工作空间（若存在） |
| `create_workspace` | 新建工作空间，可传入自定义数据库路径 |
| `set_active_workspace` | 切换当前激活的工作空间 |
| `list_projects` | 列出指定/当前工作空间的项目 |
| `upsert_project` | 新增或更新项目配置 |
| `delete_project` | 删除项目 |
| `launch_project` | 按配置启动项目（系统默认/指定程序/自定义命令） |
| `get_settings` | 获取全局设置（主题、字体、启动预设） |
| `update_settings` | 更新全局设置并持久化 |

前端通过 `@tauri-apps/api/core` 的 `invoke` 调用上述命令。

## 前端要点

- 左侧侧边栏：显示工作空间列表，支持切换与新增。
- 主区域：
  - 平铺视图与列表视图切换。
  - 项目导入/编辑对话框，支持自定义默认打开方式（系统默认 / 指定程序 / 自定义命令），可直接套用启动预设。
  - 项目卡片与列表提供“启动”操作，依据默认方式调用系统或指定程序。
  - 左下角浮动工作空间选择器可切换/新建工作空间；右下角齿轮入口打开全局设置（主题、字体、启动预设）。
  - 集成 `@tauri-apps/plugin-dialog` 提供文件夹/文件选择体验。
- 构建产物输出到 `web/dist`，Tauri 配置通过 `beforeDevCommand` 和 `frontendDist` 关联。

## 后续建议迭代

1. **多语言支持**：提供多语言切换，适配设置面板与主界面。
2. **Git 信息预览**：在项目卡片中展示 Git 状态（分支、是否脏）。
3. **工作空间导出/导入**：支持备份或分享工作空间配置与启动预设。
4. **测试覆盖**：添加后端命令的单元测试与前端组件测试。
