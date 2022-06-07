/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    def(value, '__ob__', this)
    // 处理数组响应式
    if (Array.isArray(value)) {
      // 判断是否有__proto__属性
      // caniuse 网站查
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value)
    } else {
      // 处理对象响应式
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    // 遍历数组的每一项，对其进行响应式处理
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /**
   * 用经过增强的数组原型方法，覆盖默认的原型方法,之后再执行那7个方法时就巨呀了依赖通知更新的能力
   * 以达到数组响应式的能力
   */
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
// 将增强的那7个方法直接赋值到数组对象上
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// 响应式处理的入口
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 不是对象 return
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 判断是否有 __ob__属性 如果有说明被响应式处理了
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 如果没有经过响应式处理走这里
    // 实例化 Observer 进行响应式处理
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  // 返回响应式处理结果
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 实例化一个 dep, 一个 key 对应一个 dep
  const dep = new Dep()

  // 获取属性描述符
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // 通过递归的方式处理 val 为对象的情况，即处理嵌套对象
  let childOb = !shallow && observe(val)
  // 拦截 obj[key]的访问和设置
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    // 拦截 obj.key, 进行依赖收集返回最新的值
    get: function reactiveGetter () {
      // obj.key 的值
      const value = getter ? getter.call(obj) : val

      // 中间做了关键的依赖收集
      if (Dep.target) {
        // 读取时进行的依赖收集，将 dep 添加到 watcher 中，也将 watcher 添加到 dep 中
        dep.depend()
        if (childOb) {
          // 对嵌套对象也进行依赖收集
          childOb.dep.depend()
          if (Array.isArray(value)) {
            // 处理嵌套值为数组的情况
            dependArray(value)
          }
        }
      }

      // 返回obj.key 的值
      return value
    },
    // 拦截obj.key = newVal 的操作
    set: function reactiveSetter (newVal) {
      // 首先获取老值
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      // 这是新值，用新值替换老值
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 对新值做响应式处理
      childOb = !shallow && observe(newVal)
      // 当响应式数据g更新时，做依赖通知更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
 // set用在运行时新添加的根属性做响应式处理
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 处理数组，Vue.set(arr, idx, val)
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    // 利用数组原生方法 splice 实现
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  // 对新属性设置 getter 和 setter 读取时收集依赖，更新时触发依赖通知更新
  defineReactive(ob.value, key, val)
  // 直接进行依赖通知更新
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 数组 还是利用 splice 方法实现删除元素
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  // 处理对象的情况
  if (!hasOwn(target, key)) {
    return
  }
  /// 使用delete 操作符删除对象上的属性
  delete target[key]
  if (!ob) {
    return
  }
  // 触发依赖通知更新
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
// 处理数组选项为对象的情况，对其进行依赖收集，因为前面的所有处理都没有办法对数组项为对象的元素进行依赖收集

/**
 * arr[0]
 * arr[1].a  数组中的对象依赖收集发生在这里
 * data: { arr: [1, {a: 'a'}] }
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
