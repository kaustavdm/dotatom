'use babel'

import {CompositeDisposable} from 'atom'
import {isTruthy, isFalsy} from './check'
import {Executor} from './executor'

export default {
  environment: null,
  locator: null,
  subscriptions: null,
  dependenciesInstalled: null,

  activate () {
    this.dependenciesInstalled = false
    this.subscriptions = new CompositeDisposable()
    this.subscriptions.add(atom.commands.add('atom-workspace', 'go-config:detect', () => { }))
    require('atom-package-deps').install('go-config').then(() => {
      this.dependenciesInstalled = true
    }).catch((e) => {
      console.log(e)
    })
  },

  deactivate () {
    this.dispose()
  },

  dispose () {
    if (isTruthy(this.subscriptions)) {
      this.subscriptions.dispose()
    }
    this.subscriptions = null
    this.environment = null
    this.locator = null
    this.dependenciesInstalled = null
  },

  getExecutor (options) {
    let e = new Executor({environmentFn: this.getEnvironment.bind(this)})
    return e
  },

  getLocator () {
    if (isTruthy(this.locator)) {
      return this.locator
    }
    let Locator = require('./locator').Locator
    this.locator = new Locator({
      environment: this.getEnvironment.bind(this),
      executor: this.getExecutor(),
      ready: this.ready.bind(this)
    })
    this.subscriptions.add(this.locator)
    return this.locator
  },

  ready () {
    if (isFalsy(this.dependenciesInstalled)) {
      return false
    }
    if (isTruthy(this.environment)) {
      return true
    } else {
      return false
    }
  },

  getEnvironment () {
    if (this.ready()) {
      return this.environment
    }

    return process.env
  },

  provide () {
    return {executor: this.getExecutor(), locator: this.getLocator(), environment: this.getEnvironment.bind(this)}
  },

  consumeEnvironment (environment) {
    this.environment = environment
  }
}
