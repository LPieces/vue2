/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute,
  invokeWithErrorHandling
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}
// 将 key 代理到 vue this 实例上
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    // this._props.key
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  // 拦截 对 this.key 的访问 其实执行是 this._props.key
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
// 响应式原理的入口
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  // 对 props 配置做响应式处理
  // 代理 props 配置上的key 到 vue 实例 支持this.propKey 的方式访问
  if (opts.props) initProps(vm, opts.props)
  // 判重处理，methods 中定义的属性不能和 props 对象中的属性重复，props 优先级 > methods 的优先级
  // 将定义的 methods 赋值到 vue 实例 支持 this.methodKey 的方式访问
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    // 判重处理， data 中的属性不能和 props 以及 methods 中的属性重复
    // 代理 将 data 中的属性代理到 vue 实例上 支持通过 this.key 的方式访问
    // 调 observe 响应式处理
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  // computed 是通过 watcher 来实现的， 对每个 computedKey 实例化一个 watcher, 默认懒执行
  // 将 computedKey 代理到 vue 实例上，支持通过 this.computedKey 的方式访问 computed.key
  // 注意理解 computed 缓存的实现原理
  if (opts.computed) initComputed(vm, opts.computed)
  // 核心：实例化一个 watcher 实例，并返回一个 unwatch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
  // computed 和 watch 有什么区别?
  // computed 默认懒执行，且不可更改, 但是 watch 可配置
  // 使用场景不同
}
//
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      // 对props 数据做响应式处理
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.

    // 代理 this.propsKey
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

function initData (vm: Component) {
  let data = vm.$options.data
  // 保证后续处理的 data 是一个对象
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    // 如果函数返回不是一个对象 重置为 {} 提示用户返回应该为对象
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    // 判重处理 data 中的属性不能和 props 以及 methods 中的属性重复
    if (process.env.NODE_ENV !== 'production') {
      // 判断是否和methods中的属性重复
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // 判断是否和props中的属性重复
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 代理 data 中的属性到 vue 实例上，支持通过 this.key 的方式访问
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  // 数据响应式处理
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  // {
  //   computed: {
  //     msg: function () {

  //     }
  //   }
  // }
  // 遍历 computed 对象
  for (const key in computed) {
    // 获取 key 对应的值
    const userDef = computed[key]
    // 获取计算属性的getter  如果是对象的化拿 get  如果是函数就是函数本身
    // 为对象的化 必须要有get选项
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    // 如果getter 为null 则表示缺少get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 实例化一个 watcher 所以 computed 的原理其实就是通过 watcher 来实现的
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      } else if (vm.$options.methods && key in vm.$options.methods) {
        warn(`The computed property "${key}" is already defined as a method.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 将 computed 配置项中的 key 代理到 vue 实例上，支持通过 this.computedKey 的方式访问
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter (key) {
  return function computedGetter () {
    // 拿到 watcher
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        // 执行 watcher.evaluate 方法
        // 执行 computed.key 的值（函数）得到函数的执行结果，赋值给watcher.value
        // 将 watcher.dirty 置为 false 这个很关键

        // computed 和 methods 有什么区别？
        // 一次渲染当中 只执行一次 computed 函数，后续的访问就不会再执行了
        // 直到下一次数据更新需要重新渲染才会再次执行
        // computed 在一次渲染中只执行一次evaluate把dirty置false, 所以一次渲染中多次调用只执行一次, 只在updata置为true时才会再次执行evaluate
        // 其实computed缓存实现原理很简单 就是定义了一个 dirty 开关
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props4
  // 判重 methods中的 key 不能和 props 中的 key 重复
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 将 methods 中的所有方法赋值到 vue 实例上 支持通过 this.methodKey 的方式访问定义的方法
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

function initWatch (vm: Component, watch: Object) {
  // 遍历 watch 配置项对象
  for (const key in watch) {
    const handler = watch[key]
    // 如果是数组 就循环处理
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      // 不是数组 直接处理
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 对象 从 handler 属性中获取 函数
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 字符串 表示的是一个 methods 方法，直接通过 this.methodKey 的方式拿到这个函数
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  // 然后调用 $watch 方法
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  // 处理 data 数据，定义 get 方法，访问 this._data
  const dataDef = {}
  dataDef.get = function () { return this._data }
  // 处理 props 数据
  const propsDef = {}
  propsDef.get = function () { return this._props }
  // 异常提示
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    // 你设置它的时候，直接告诉你 props 是只读的
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  // 将$data和$props挂载到Vue原型链，支持通过this.$data 和 this.$props的方式访问
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)
  // this.$set和this.$delete
  // Vue.set 和 Vue.delete的一个别名
  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // this.$watch
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    // 处理 cb 是对象的情况
    // 用户可以 this.$watch() 直接调用$watch
    // 这里处理 cb 是保证 后续处理中 cb 肯定是一个函数
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    // 标记 这是一个 用户 watcher
    options.user = true
    // 实例化 watcher
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // 存在 immediate: true 则立即执行回调函数
    if (options.immediate) {
      const info = `callback for immediate watcher "${watcher.expression}"`
      pushTarget()
      invokeWithErrorHandling(cb, vm, [watcher.value], vm, info)
      popTarget()
    }
    // 返回一个 unwarch
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
