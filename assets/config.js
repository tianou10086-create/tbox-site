// T-Box 站点配置 —— 单一数据源，页面所有动态值都从这里取。
//
// 2026-10-19 修正：此前这里的 SIZE/SHA256 与实际安装包对不上
//   SIZE   声称 183,102,552  → 实测 183,155,560
//   SHA256 声称 1364F55F…921F86 → 实测 D1F82B19…593E74（完全不同）
// 站点主打「每个宣称都能自己验证」，哈希写错等于自毁信任，故按实测值写死。
//
// BUY_URL / MIRROR_1 / MIRROR_2 留空 = 未配置购买通道：
//   前端不会弹内部开发提示，而是显示「购买通道即将开放」。
//   接入发卡平台后把商品页链接填进 BUY_URL 即可，无需改 HTML。
window.TBOX_CONFIG = {
  // 2026-10-21 已接通线上支付：16688 店铺 S667305「TBOX」。
  // 三档卡密商品均已过审在架、自动发货、支付宝/微信可付。
  // 实测（2026-10-21 23:44）月卡商品页：¥29 · 库存很多 · 自动发货 · 立即购买。
  // 兜底填店铺首页：万一某个商品被下架，点任何一档都能进店找到在售同类，不会落到死链。
  BUY_URL: "https://www.16688.com.cn/shop/S667305",
  // 三档各自直链（填了就用各自的；留空则回落到上面的 BUY_URL）
  // 为什么分开：买家点「先试 7 天」却落到 69 元季卡页，价格对不上就是纠纷。
  // 商品号来自商家后台实测：G32787408 / G11327877 / G80959262。
  BUY_URL_TRIAL: "https://www.16688.com.cn/goods/G32787408",
  BUY_URL_MONTH: "https://www.16688.com.cn/goods/G11327877",
  BUY_URL_SEASON: "https://www.16688.com.cn/goods/G80959262",
  // 备用线路 1：生产仓库的版本列表页。
  // 生产仓库目前没有 Release，点进去是「暂无发布版本」——
  // 所以它只能当备用，主线路必须指向真能下到文件的地址。
  MIRROR_1: "https://github.com/tianou10086-create/tbox-site/releases",
  // 备用线路 2 = 便携包（解压即用，不写注册表），同样走 Release 资产。
  // 0.1.31 起主下载也指向便携包：授权门已经在产品本体里，不再依赖 TBoxLauncher.exe。
  // 0.1.30 的包只有 TishiBox/、没有任何授权门，已撤下，不要再引用。
  // 安装版 TBox-Setup.exe 停在 0.1.29；要出安装版需先更新 commercial/TBox-Setup.iss。
  // 便携包 247MB 进不了 Pages 仓库（单文件上限 100MB），只能挂 Release。
  MIRROR_2: "https://github.com/POP-YU/tbox-site-preview/releases/download/v0.1.33/TBox-Setup-0.1.33.exe",
  VERSION: "0.1.33",
  SIZE: "106,637,315 bytes (101.70 MB)",
  SHA256: "2D63A7A035E3D81B7DEF5B5AB280CD018B2E99245E8D27AFC66B1E1974DC42B5",
  RELEASE_DATE: "2026-10-23",
  // 183MB 安装包不进 Pages 仓库（GitHub 单文件上限 100MB），走 Release 发布。
  // 主线路必须**直连文件**：原来指向 tianou10086-create/tbox-site/releases，
  // 而那个仓库还没有 Release，点主线路等于走进「暂无发布版本」的死胡同
  // （2026-10-19 实测：这条直链 200 / 183,155,560 B；原主线路是空列表页）。
  // 生产仓库建好自己的 Release 后，把这两行对调回来（见 STATE.md 待办）。
  //
  // 2026-10-21 修：release.py publish 曾把这里写成相对路径
  //   "assets/download/TBox-Setup-0.1.29.exe"，但 *.exe 被 site/.gitignore 排除，
  //   Pages 上根本不存在这个文件，且 publish-common.ps1 会因「不是 https」直接中止发布。
  //   改回 Release 资产绝对直链，与 0.1.23 线上可用形态一致。
  //
  // 0.1.21 → 0.1.22 变的是什么：激活。
  //   0.1.21 的启动器把卡密发往 license.tbox.example.com（IANA 保留占位域名），
  //   必然失败；0.1.22 改成离线签名卡密，旧启动器 TB1. 卡为 RSA-SHA256；当前产品 TB-…#签名 卡为 Ed25519，本机验签。
  PRIMARY_DOWNLOAD: "https://github.com/POP-YU/tbox-site-preview/releases/download/v0.1.33/TBox-Setup-0.1.33.exe",
  // 0.1.31 起主下载是安装版（用户级安装，不需要管理员）；便携版作为备选。
  PORTABLE_URL: "https://github.com/POP-YU/tbox-site-preview/releases/download/v0.1.33/TBox-0.1.33-portable.zip",
  PORTABLE_SIZE: "157,875,938 bytes (150.56 MB)",
  PORTABLE_SHA256: "B74CBF3A156AD13B0E462E4C3E95EE7AFC3C8E5C5B21B625B620DF6F8C47FB21"
};



