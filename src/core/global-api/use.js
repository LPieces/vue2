/* @flow */

import { toArray } from '../util/index'

// Vue.use(plugin)
// 总结：本质是在执行插件暴露出来的 install 方法，开始的时候会有判重，防止重复注册同一个插件
export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // 不会重复注册同一个插件
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      // plugin是对象
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // plugin是函数
      plugin.apply(null, args)
    }
    // 将 plugin 放入已安装的插件数组中
    installedPlugins.push(plugin)
    return this
  }
}
