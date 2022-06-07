/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

// 初始化全局API入口
export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  // vue全局默认的配置
  const configDef = {}
  configDef.get = () => config
  // Vue.config.newProperty == val
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // 将配置代理到 Vue 对象上，通过 Vue.config 的方式去访问
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // 向外暴露一些内部的工具方法
  Vue.util = {
    // 日志
    warn,
    // 将 A 对象上的属性复制到 B 对象上
    extend,
    // 合并选项
    mergeOptions,
    // 给对象设置 getter setter, 涉及到依赖收集，更新触发依赖通知
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  // 向外暴露为对象设置响应式的方法
  Vue.observable = <>(obj: T): T => {
    // 为对象设置响应式
    observe(obj)
    return obj
  }

  // Vue全局配置上的 component、directive、filter选项
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  // 将Vue构造函数赋值给 Vue.options_base
  Vue.options._base = Vue

  // 将 keep-alive 组件放到 Vue.options.component 对象中
  extend(Vue.options.components, builtInComponents)

  // 初始化Vue.use
  initUse(Vue)
  // Vue.mixin
  initMixin(Vue)
  // Vue.extend
  initExtend(Vue)
  // Vue.component\directive\filter
  initAssetRegisters(Vue)
}
