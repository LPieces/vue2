/* @flow */

import { mergeOptions } from '../util/index'

// 利用 mergeOptions 合并两个选项
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
