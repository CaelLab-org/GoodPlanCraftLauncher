/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
// 每组对应使用流程的一段：先装、再登录，然后处理游戏与模组，最后是出问题时看的页面。
// 加页面就往对应那组里加一行；文件没写出来时构建会直接失败，这是有意的。
const sidebars = {
  mainSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: '概述',
    },
    {
      type: 'category',
      label: '开始使用',
      items: [
        'install',
        'login',
      ],
    },
    {
      type: 'category',
      label: '游戏与模组',
      items: [
        'java-memory',
        'modloader',
        'mods',
      ],
    },
    {
      type: 'doc',
      id: 'download',
      label: '下载与镜像源',
    },
    {
      type: 'category',
      label: '出问题了',
      items: [
        'mc-game',
        'magic-words',
      ],
    },
  ],
};

module.exports = sidebars;
