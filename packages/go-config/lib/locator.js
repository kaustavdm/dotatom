'use babel'

import {CompositeDisposable} from 'atom'
import {isTruthy, isFalsy} from './check'
import {Executor} from './executor'
import {PathHelper} from './pathhelper'
import _ from 'lodash'
import fs from 'fs'
import os from 'os'
import path from 'path'

class Locator {
  constructor (options) {
    this.subscriptions = new CompositeDisposable()
    this.environmentFn = null
    this.executor = null
    this.executableSuffix = ''
    this.pathKey = 'PATH'
    if (os.platform() === 'win32') {
      this.executableSuffix = '.exe'
      this.pathKey = 'Path'
    }
    this.goExecutables = ['go' + this.executableSuffix, 'goapp' + this.executableSuffix]
    this.pathhelper = new PathHelper()
    this.readyFn = null
    if (isTruthy(options)) {
      if (isTruthy(options.environment)) {
        this.environmentFn = options.environment
      }
      if (isTruthy(options.ready)) {
        this.readyFn = options.ready
      }
      if (isTruthy(options.executor)) {
        this.executor = options.executor
      }
    }

    if (this.executor === null) {
      this.executor = new Executor({environmentFn: this.environment.bind(this)})
    }

    this.subscriptions.add(this.executor)
    this.goLocators = [
      // Avoid using gorootLocator / GOROOT unless you know what you're doing
      // (and assume you don't know what you're unless you have significant
      // go experience)
      () => { return this.gorootLocator() },
      () => { return this.editorconfigLocator() },
      () => { return this.configLocator() },
      () => { return this.pathLocator() },
      () => { return this.defaultLocator() }
    ]

    this.setKnownToolStrategies()
    this.setKnownToolLocations()
  }

  dispose () {
    this.resetRuntimes()
    if (this.subscriptions) {
      this.subscriptions.dispose()
    }
    this.goLocators = null
    this.executableSuffix = null
    this.pathKey = null
    this.goExecutables = null
    this.subscriptions = null
    this.environmentFn = null
    this.executor = null
    this.readyFn = null
    this.toolLocations = null
    this.toolStrategies = null
  }

  // Public
  runtimes (project, options) {
    if (isTruthy(this.runtimesCache)) {
      return Promise.resolve(this.runtimesCache)
    }

    return new Promise((resolve, reject) => {
      let candidates = this.runtimeCandidates(project)
      if (isFalsy(candidates) || candidates.constructor !== Array || candidates.length < 1) {
        return resolve([])
      }

      let viableCandidates = []
      for (let candidate of candidates) {
        let goversion = this.executor.execSync(candidate, ['version'], {cwd: path.dirname(candidate)})
        if (isTruthy(goversion) && goversion.code === 0 && goversion.stdout.startsWith('go ')) {
          let v = {path: candidate, version: goversion.stdout.replace(/\r?\n|\r/g, '')}
          let versionComponents = v.version.split(' ')
          v.name = versionComponents[2]
          v.semver = versionComponents[2]
          if (v.semver.startsWith('go')) {
            v.semver = v.semver.substring(2, v.semver.length)
          }
          viableCandidates.push(v)
        }
      }

      let finalCandidates = []
      for (let viableCandidate of viableCandidates) {
        let goenv = this.executor.execSync(viableCandidate.path, ['env'], {cwd: path.dirname(viableCandidate.path)})
        if (isTruthy(goenv) && goenv.code === 0 && goenv.stdout.trim() !== '') {
          let items = goenv.stdout.split('\n')
          for (let item of items) {
            item = item.replace(/[\n\r]/g, '')
            if (item.includes('=')) {
              let tuple = item.split('=')
              let key = tuple[0]
              let value = tuple[1]
              if (tuple.length > 2) {
                value = tuple.slice(1, tuple.length + 1).join('=')
              }
              if (os.platform() === 'win32') {
                if (key.startsWith('set ')) {
                  key = key.substring(4, key.length)
                }
              } else {
                if (value.length > 2) {
                  value = value.substring(1, value.length - 1)
                } else {
                  value = ''
                }
              }
              viableCandidate[key] = value
            }
          }
          finalCandidates.push(viableCandidate)
        }
      }

      this.runtimesCache = finalCandidates
      resolve(this.runtimesCache)
    })
  }

  resetRuntimes () {
    this.runtimesCache = null
  }

  statishSync (pathValue) {
    let stat = false
    if (isTruthy(pathValue) && !(pathValue.trim() === '')) {
      try { stat = fs.statSync(pathValue) } catch (e) { }
    }
    return stat
  }

  stat (p) {
    if (isFalsy(p) || p.constructor !== String || p.trim() === '') {
      return Promise.resolve(false)
    }

    return new Promise((resolve, reject) => {
      fs.stat(p, (err, stat) => {
        if (isTruthy(err)) {
          this.handleError(err)
          resolve(false)
          return
        }
        resolve(stat)
      })
    })
  }

  pathExists (p) {
    return this.exists(p).then((e) => {
      if (isFalsy(e)) {
        return false
      }
      return p
    })
  }

  fileExists (p) {
    return this.stat(p).then((s) => {
      if (isFalsy(s)) {
        return false
      }

      if (s.isFile()) {
        return p
      }

      return false
    })
  }

  directoryExists (p) {
    return this.stat(p).then((s) => {
      if (isFalsy(s)) {
        return false
      }

      if (s.isDirectory()) {
        return p
      }

      return false
    })
  }

  exists (p) {
    return this.stat(p).then((s) => {
      if (isFalsy(s)) {
        return false
      }

      return true
    })
  }

  runtimeCandidates (project) {
    let candidates = []
    for (let locator of this.goLocators) {
      let c = locator(project)
      if (isTruthy(c) && c.constructor === Array && c.length > 0) {
        candidates = _.union(candidates, c)
      }
    }
    return candidates
  }

  editorconfigLocator (project) {
    // TODO: .editorconfig
    return false
  }

  configLocator (project) {
    let goinstallation = atom.config.get('go-plus.goInstallation')
    let stat = this.statishSync(goinstallation)
    if (isTruthy(stat)) {
      let d = goinstallation
      if (stat.isFile()) {
        d = path.dirname(goinstallation)
      }
      return this.findExecutablesInPath(d, this.executables)
    }

    return []
  }

  gorootLocator () {
    if (isFalsy(this.environment().GOROOT) || this.environment().GOROOT.trim() === '') {
      return []
    }
    return this.findExecutablesInPath(path.join(this.environment().GOROOT, 'bin'), this.goExecutables)
  }

  pathLocator () {
    return this.findExecutablesInPath(this.environment()[this.pathKey], this.goExecutables)
  }

  defaultLocator () {
    let installPaths = []
    if (os.platform() === 'win32') {
      /*
      c:\go\bin = Binary Distribution
      c:\tools\go\bin = Chocolatey
      */
      installPaths.push(path.join('c:', 'go', 'bin'))
      installPaths.push(path.join('c:', 'tools', 'go', 'bin'))
    } else {
      /*
      /usr/local/go/bin = Binary Distribution
      /usr/local/bin = Homebrew
      */
      installPaths.push(path.join('/', 'usr', 'local', 'go', 'bin'))
      installPaths.push(path.join('/', 'usr', 'local', 'bin'))
    }
    return this.findExecutablesInPath(installPaths.join(path.delimiter), this.goExecutables)
  }

  findExecutablesInPath (pathValue, executables) {
    let candidates = []
    if (isFalsy(pathValue) || pathValue.constructor !== String || pathValue.trim() === '') {
      return candidates
    }

    if (isFalsy(executables) || executables.constructor !== Array || executables.length < 1) {
      return candidates
    }

    let elements = this.pathhelper.expand(this.environment(), pathValue).split(path.delimiter)
    for (let element of elements) {
      for (let executable of executables) {
        let candidate = path.join(element, executable)
        let stat = this.statishSync(candidate)
        if (isTruthy(stat) && stat.isFile()) {
          candidates.push(candidate)
        }
      }
    }
    return candidates
  }

  // Public
  gopath (options) {
    let e = this.environment()
    if (isFalsy(e.GOPATH) || e.GOPATH.trim() === '') {
      return false
    }

    return this.pathhelper.expand(e, e.GOPATH)
  }

  environment () {
    if (isFalsy(this.environmentFn)) {
      return process.env
    }

    let e = this.environmentFn()
    if (isFalsy(e)) {
      return process.env
    }
    return e
  }

  ready () {
    if (isFalsy(this.readyFn)) {
      return true
    }
    return this.readyFn()
  }

  setKnownToolLocations () {
    this.toolLocations = new Map()
    this.toolLocations.set('goimports', 'golang.org/x/tools/cmd/goimports')
    this.toolLocations.set('goreturns', 'sourcegraph.com/sqs/goreturns')
    this.toolLocations.set('gometalinter', 'github.com/alecthomas/gometalinter')
    this.toolLocations.set('godebug', 'github.com/mailgun/godebug')
    this.toolLocations.set('oracle', 'golang.org/x/tools/cmd/oracle')
    this.toolLocations.set('gocode', 'github.com/nsf/gocode')
  }

  setKnownToolStrategies () {
    this.toolStrategies = new Map()

    // Built-In Tools
    this.toolStrategies.set('go', 'GOROOTBIN')
    this.toolStrategies.set('gofmt', 'GOROOTBIN')
    this.toolStrategies.set('godoc', 'GOROOTBIN')
    this.toolStrategies.set('addr2line', 'GOTOOLDIR')
    this.toolStrategies.set('api', 'GOTOOLDIR')
    this.toolStrategies.set('asm', 'GOTOOLDIR')
    this.toolStrategies.set('cgo', 'GOTOOLDIR')
    this.toolStrategies.set('compile', 'GOTOOLDIR')
    this.toolStrategies.set('cover', 'GOTOOLDIR')
    this.toolStrategies.set('dist', 'GOTOOLDIR')
    this.toolStrategies.set('doc', 'GOTOOLDIR')
    this.toolStrategies.set('fix', 'GOTOOLDIR')
    this.toolStrategies.set('link', 'GOTOOLDIR')
    this.toolStrategies.set('nm', 'GOTOOLDIR')
    this.toolStrategies.set('objdump', 'GOTOOLDIR')
    this.toolStrategies.set('pack', 'GOTOOLDIR')
    this.toolStrategies.set('pprof', 'GOTOOLDIR')
    this.toolStrategies.set('tour', 'GOTOOLDIR')
    this.toolStrategies.set('trace', 'GOTOOLDIR')
    this.toolStrategies.set('vet', 'GOTOOLDIR')
    this.toolStrategies.set('yacc', 'GOTOOLDIR')

    // External Tools
    this.toolStrategies.set('git', 'PATH')

    // Other Tools Are Assumed To Be In PATH or GOBIN or GOPATH/bin
    // GOPATHBIN Can Be Used In The Future As A Strategy, If Required
    // GOPATHBIN Will Understand GO15VENDOREXPERIMENT
  }

  // Public
  runtimeForProject (project) {
    if (isTruthy(project) && project.constructor === String || name.trim() !== '') {
      // Do something specific for the project
    }

    return this.runtimes(project).then((r) => {
      if (isFalsy(r) || r.length < 1) {
        return false
      } else {
        return r[0]
      }
    })
  }

  // Public
  findTool (name, project, options) {
    if (isFalsy(name) || name.constructor !== String || name.trim() === '') {
      return Promise.resolve(false)
    }

    let strategy = false
    return Promise.resolve(null).then(() => {
      if (isTruthy(project)) {
        // Do something here
      }
      if (this.toolStrategies.has(name)) {
        strategy = this.toolStrategies.get(name)
      }
      if (isFalsy(strategy)) {
        strategy = 'DEFAULT'
      }
    }).then(() => {
      if (strategy !== 'GOROOTBIN' && strategy !== 'GOTOOLDIR') {
        return false
      }

      return this.runtimeForProject(project).then((runtime) => {
        if (isFalsy(runtime)) {
          return false
        }

        if (strategy === 'GOROOTBIN') {
          return path.join(runtime.GOROOT, 'bin', name + runtime.GOEXE)
        } else if (strategy === 'GOTOOLDIR') {
          return path.join(runtime.GOTOOLDIR, name + runtime.GOEXE)
        }
        return false
      })
    }).then((specificTool) => {
      if (isTruthy(specificTool)) {
        return this.stat(specificTool).then((s) => {
          if (isTruthy(s) && s.isFile()) {
            return specificTool
          }
        }).catch((err) => {
          this.handleError(err)
          return false
        })
      }

      if (strategy === 'GOPATHBIN') {
        return this.findToolInDelimitedEnvironmentVariable(name, 'GOPATH', project)
      }

      if (strategy === 'PATH') {
        return this.findToolInDelimitedEnvironmentVariable(name, this.pathKey, project)
      }

      return this.findToolWithDefaultStrategy(name, project)
    })
  }

  handleError (err) {
    if (isTruthy(err.handle)) {
      err.handle()
    }
    // console.log(err)
  }

  handleAndReject (err, reject) {
    this.handleError(err)
    reject(err)
  }

  findToolWithDefaultStrategy (name, project, options) {
    if (isFalsy(name) || name.constructor !== String || name.trim() === '') {
      return Promise.resolve(false)
    }

    // Default Strategy Is: Look For The Tool In GOPATH, Then Look In PATH
    return Promise.resolve().then(() => {
      return this.findToolInDelimitedEnvironmentVariable(name, 'GOPATH', project)
    }).then((tool) => {
      if (isTruthy(tool)) {
        return tool
      }
      return this.findToolInDelimitedEnvironmentVariable(name, this.pathKey, project)
    })
  }

  findToolInDelimitedEnvironmentVariable (toolName, key, project) {
    if (isFalsy(toolName) || toolName.constructor !== String || toolName.trim() === '') {
      return Promise.resolve(false)
    }

    let p = this.environment()[key]
    if (isFalsy(p)) {
      return Promise.resolve(false)
    }

    return Promise.resolve(false).then(() => {
      let elements = p.split(path.delimiter)
      if (key === 'GOPATH' && isTruthy(this.environment()['GO15VENDOREXPERIMENT'])) {
        // TODO: Understand Vendor Experiment Paths Better
        // elements.unshift('vendor')
      }
      for (let element of elements) {
        let item = ''
        if (key === 'GOPATH') {
          item = path.join(element, 'bin', toolName + this.executableSuffix)
        } else {
          item = path.join(element, toolName + this.executableSuffix)
        }

        if (fs.existsSync(item) && fs.statSync(item).isFile()) {
          return item
        }
      }

      return false
    })
  }

  getTool (name, project, options) {
    return new Promise((resolve, reject) => {
      resolve(false)
    })
  }

  // Public
  promptForTool (name, project, options) {
    return false
  }
}

export {Locator}
