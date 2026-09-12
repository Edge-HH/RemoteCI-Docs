// 图标资源在构建时打包为站点本地文件，避免运行时依赖 jsDelivr 和 Iconify API。
// 图标名统一按 Font Awesome 6 的短名称解析，详见 theme.ts 中的 plugins.icon 配置。
import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";
import "@fortawesome/fontawesome-free/css/regular.css";
import "@fortawesome/fontawesome-free/css/brands.css";
