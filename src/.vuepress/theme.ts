import { hopeTheme } from "vuepress-theme-hope";

export default hopeTheme({
  hostname: "https://edge-hh.github.io/RemoteCI-Docs/",
  author: {
    name: "Edge-HH",
    url: "https://github.com/Edge-HH",
  },
  logo: "/logo.svg",
  repo: "Edge-HH/RemoteCI-Docs",
  docsDir: "src",
  pure: true,
  lastUpdated: false,
  contributors: false,
  changelog: false,
  displayFooter: true,
  footer: "RemoteCI 文档",
  copyright: "Copyright © 2026 Edge-HH",
  navbar: [
    { text: "首页", icon: "home", link: "/" },
    { text: "快速开始", icon: "rocket", link: "/guide/getting-started" },
    { text: "使用文档", icon: "book", link: "/guide/features" },
    { text: "服务端部署", icon: "server", link: "/server/deployment" },
    { text: "接入扩展", icon: "puzzle-piece", link: "/extensions/" },
    { text: "开发与贡献", icon: "code", link: "/development/docs-maintenance" },
  ],
  sidebar: {
    "/guide/": [
      {
        text: "开始使用",
        icon: "rocket",
        children: [
          "getting-started",
          "status",
          "features",
          "connection",
          "troubleshooting",
        ],
      },
    ],
    "/server/": [
      {
        text: "服务端",
        icon: "server",
        children: ["deployment", "fnos", "configuration", "operations"],
      },
    ],
    "/extensions/": [
      {
        text: "接入扩展",
        icon: "puzzle-piece",
        children: ["index"],
      },
    ],
    "/development/": [
      {
        text: "开发与贡献",
        icon: "code",
        children: ["architecture", "docs-maintenance"],
      },
    ],
    "/": [],
  },
  plugins: {
    // 空仓库首次构建时不读取提交历史；发布后仍由 GitHub 保留完整历史。
    git: {
      createdTime: false,
      updatedTime: false,
      contributors: false,
      changelog: false,
    },
    // 图标统一使用 Font Awesome 6 短名称（如 home、brands:github）。
    // CSS 与字体由 .vuepress/client.ts 在构建时打包，assets 留空即可，
    // 这样不会再从 CDN 动态拉取图标资源。
    icon: {
      assets: [],
      type: "fontawesome",
    },
    slimsearch: true,
    components: {
      components: ["Badge", "VPCard"],
    },
  },
  markdown: {
    alert: true,
    hint: true,
    tabs: true,
    codeTabs: true,
    highlighter: {
      type: "shiki",
      themes: {
        light: "one-light",
        dark: "one-dark-pro",
      },
    },
  },
});
