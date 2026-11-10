import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

export default defineUserConfig({
  base: process.env.DOCS_BASE ?? "/RemoteCI-Docs/",
  lang: "zh-CN",
  title: "RemoteCI 文档",
  description: "RemoteCI 集控、教务与日程管理平台的介绍、使用指南、服务端部署与扩展接入文档",
  head: [
    ["meta", { name: "theme-color", content: "#6750a4" }],
    ["link", { rel: "icon", href: "logo.svg" }],
  ],
  theme,
});
