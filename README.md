# EconLab 基础经济学训练

面向英文基础薄弱学生的双语经济学概念、图形与错题训练网站。题库依据项目目录中的 U1、U2 复习资料整理，并对容易混淆的定义进行了校准。

公网练习地址：<https://nightwander5457.github.io/econlab-practice/>

## 当前功能

- U1、U2 共 46 道基础选择题与填空题
- 辅助、标准、考试三档语言支持
- 中文错因讲解与正确答案反馈
- 错题自动回流，连续答对两次后暂时移出错题本
- Demand、Supply、AD、LRAS 手绘直线图训练与标签检查
- 练习开始时间、有效活跃时长、正确率与章节掌握度
- 当前设备学习记录与 CSV 导出
- Supabase 匿名学生身份、云端答题记录与会话同步
- 教师、班级和学生权限数据模型

## 本地运行

```bash
npm install
npm run dev
```

默认访问 `http://localhost:3000`。

## 数据说明

浏览器记录作为离线缓存保留；配置 Supabase 环境变量后，学生会自动获得匿名身份，并把练习会话、答题记录和掌握度同步到云端。公开仓库不得提交 Supabase secret key 或 service-role key。

将 `.env.example` 复制为 `.env.local`，填写项目 URL 和 Publishable Key。不要在浏览器环境或 GitHub 中使用 Secret Key。

## 构建

```bash
npm run build
```
