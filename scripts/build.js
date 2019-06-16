const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const rollup = require('rollup')
const terser = require('terser')

// 创建 dist文件夹
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist')
}

//  获取配置文件
let builds = require('./config').getAllBuilds()
// process.argv : 启动 Node.js 进程时传入的命令行参数

// filter builds via command line arg
// 处理命令行参数
if (process.argv[2]) { // 第三个参数为用户自定义
  const filters = process.argv[2].split(',')
  builds = builds.filter(b => {
    return filters.some(f => b.output.file.indexOf(f) > -1 || b._name.indexOf(f) > -1)
  })
} else {
  // filter out weex builds by default
  builds = builds.filter(b => { //  过滤weex相关
    return b.output.file.indexOf('weex') === -1
  })
}

build(builds)

function build (builds) {
  let built = 0
  const total = builds.length
  const next = () => {
    buildEntry(builds[built]).then(() => {
      built++
      if (built < total) {
        next()
      }
    }).catch(logError)
  }

  next()
}

function buildEntry (config) {
  const output = config.output
  const { file, banner } = output
  const isProd = /(min|prod)\.js$/.test(file) // 是否生产环境
  // JavaScript 模块打包器
  // 才想起来这是一个生成框架的 项目，不是运行的，
  return rollup.rollup(config) // 这里会把vue 相关的代码 字符串合并起来
    .then(bundle => bundle.generate(output))
    .then(({ output: [{ code }] }) => { // code 已经合并完成的js代码（字符串 还未打包）所以在里面怎么打log都没用
      if (isProd) {
        // 压缩过后的js代码
        const minified = (banner ? banner + '\n' : '') + terser.minify(code, {
          toplevel: true,
          output: {
            ascii_only: true
          },
          compress: {
            pure_funcs: ['makeMap']
          }
        }).code
        return write(file, minified, true)
      } else {
        return write(file, code)
      }
    })
}

function write (dest, code, zip) {
  return new Promise((resolve, reject) => {
    function report (extra) {
      console.log(blue(path.relative(process.cwd(), dest)) + ' ' + getSize(code) + (extra || ''))
      resolve()
    }
    // 把处理完成的 code 代码写入的 dest
    fs.writeFile(dest, code, err => {
      if (err) return reject(err)
      if (zip) {
        zlib.gzip(code, (err, zipped) => {
          if (err) return reject(err)
          report(' (gzipped: ' + getSize(zipped) + ')')
        })
      } else {
        report()
      }
    })
  })
}

function getSize (code) {
  return (code.length / 1024).toFixed(2) + 'kb'
}

function logError (e) {
  console.log(e)
}

function blue (str) {
  return '\x1b[1m\x1b[34m' + str + '\x1b[39m\x1b[22m'
}
