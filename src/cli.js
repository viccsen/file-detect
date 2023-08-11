#!/usr/bin/env node
/*
 * @Author: Viccsen
 * @Date: 2023-08-07 17:33:41
 * @LastEditTime: 2023-08-11 13:39:27
 * @LastEditors: Viccsen
 * @Description:
 */

const yParser = require('yargs-parser');
const semver = require('semver');
const { existsSync } = require('fs');
const { join } = require('path');
const chalk = require('chalk');
const { program } = require('commander');
const cfonts = require('cfonts');
const ora = require('ora');
const fs = require('fs');
const path = require('path');
const { table } = require('table');
const PDFDocument = require('pdfkit-table');

export async function run() {
  // print version and @local
  const args = yParser(process.argv.slice(2));

  if (args.v || args.version) {
    // eslint-disable-next-line global-require
    if (existsSync(join(__dirname, '.local'))) {
      console.log(chalk.cyan('@local'));
    }
    process.exit(0);
  }

  program.version(require('../package').version);

  if (!semver.satisfies(process.version, '>= 8.0.0')) {
    console.error(
      chalk.red('✘ The generator will only work with Node v8.0.0 and up!')
    );
    process.exit(1);
  }

  cfonts.say('FILE|DETECT!', {
    font: 'simple', // define the font face
    align: 'left', // define text alignment
    colors: ['#fa0', 'yellow'], // define all colors
    background: 'transparent', // define the background color, you can also use `backgroundColor` here as key
    letterSpacing: 1, // define letter spacing
    lineHeight: 1, // define the line height
    space: true, // define if the output text should have empty lines on top and on the bottom
    maxLength: '0', // define how many character can be on one line
    gradient: false, // define your two gradient colors
    independentGradient: false, // define if you want to recalculate the gradient for each new line
    transitionGradient: false, // define if this is a transition between colors directly
    env: 'node', // define the environment cfonts is being executed in
  });

  program.command('test').action(() => {
    console.log('test');
  });

  program
    .command('search [target]')
    .description('search a file from given directory')
    .option('-S, --source <char>', 'detect source directory', 'src')
    .option('-E,--ext <char>', 'filter file extension', '.js, .jsx, .ts, .tsx')
    .option(
      '-P,--paths <char>',
      'Specify a set of entries that re-map imports to additional lookup locations, split with ,',
      '@=src'
    )
    .option(
      '--ignore <char>',
      'Specify a list of ignore directory or file, split with ,',
      'node_modules'
    )
    .option('--pdf', 'Generate a PDF file containing the results')
    .action((target, options) => {
      const { source } = options;
      const spinner = ora('Detecting').start();
      if (path.isAbsolute(target)) {
        target = path.relative(process.cwd(), target);
      }
      target = target || '.';
      spinner.color = 'yellow';
      spinner.prefixText = chalk.bgCyanBright(`Detecting`);
      spinner.text = `${chalk.yellowBright(target)} in ${source}`;
      // console.log('\n ==============================================');
      const detectResult = handleWithTarget(target, source, options);
      spinner.prefixText = '';
      spinner.succeed('Detect successfully!');
      handleResult(detectResult, options);
    });

  program.parse(process.argv);
}

function handleWithTarget(targetPath, sourcePath, options) {
  const { exts, ignore } = options;
  const ignoreKeyWords = ignore.split(',');
  let result = {};
  if (ignoreKeyWords.some((ignore) => targetPath.includes(ignore))) {
    return result;
  }

  const stats = fs.statSync(targetPath);
  const _exts = exts
    ? exts.replace(/\s/g, '').split(',')
    : ['.js', '.jsx', '.ts', '.tsx'];

  function handleDir(dirPath, searchResult = {}) {
    if (ignoreKeyWords.some((ignore) => dirPath.includes(ignore))) {
      return searchResult;
    }
    const files = fs.readdirSync(dirPath);
    for (let filename of files) {
      const filepath = path.join(dirPath, filename);
      const stats = fs.statSync(filepath);
      if (stats.isFile() && _exts.includes(path.extname(filepath))) {
        searchResult[filepath] = readFileFromSrc(filepath, sourcePath, options);
      } else if (stats.isDirectory()) {
        handleDir(filepath, searchResult);
      }
    }
    return searchResult;
  }

  if (stats.isFile()) {
    result[targetPath] = readFileFromSrc(targetPath, sourcePath, options);
  } else if (stats.isDirectory()) {
    return handleDir(targetPath, result);
  }
  return result;
}

function readFileFromSrc(componentPath, sourcePath, options) {
  const temp = new Array();
  const { exts, paths, ignore } = options;
  const ignoreKeyWords = ignore.split(',');
  // 搜索目标ignore
  if (ignoreKeyWords.some((ignore) => componentPath.includes(ignore))) {
    return temp;
  }
  // 搜索源ignore
  if (ignoreKeyWords.some((ignore) => sourcePath.includes(ignore))) {
    return temp;
  }
  const _exts = exts
    ? exts.replace(/\s/g, '').split(',')
    : ['.js', '.jsx', '.ts', '.tsx'];

  function fileDisplay(filePath) {
    const files = fs.readdirSync(filePath);
    for (let filename of files) {
      const filepath = path.join(filePath, filename);
      if (ignoreKeyWords.some((ignore) => filepath.includes(ignore))) {
        continue;
      }
      const stats = fs.statSync(filepath);
      const isFile = stats.isFile();
      const isDir = stats.isDirectory();
      if (
        isFile &&
        _exts.includes(path.extname(filepath)) &&
        ifImportFile(componentPath, filepath, paths, _exts)
      ) {
        temp.push(filepath);
      }
      if (isDir) {
        fileDisplay(filepath);
      }
    }
  }

  fileDisplay(sourcePath);

  return temp;
}

function ifImportFile(componentPath, filePath, paths, exts) {
  const content = fs.readFileSync(filePath, 'utf8');
  const alias = paths ? paths.split(',').map((p) => p.split('=')) : [];
  let waitToTestTargetPaths = dealWithRoutePath(componentPath, exts);

  if (alias.length) {
    waitToTestTargetPaths = Array.from(
      new Set(
        alias.reduce(
          (res, paths) =>
            res.concat(
              waitToTestTargetPaths.map((path) =>
                path.replace(paths[1], paths[0])
              )
            ),
          [componentPath]
        )
      )
    );
  }
  return waitToTestTargetPaths.some((path) => {
    // 使用正则表达式来检查文件内容是否包含组件引用
    const regex = new RegExp(`import\\s+.+\\s+from\\s+('|")${path}`, 'g');
    if (regex.test(content)) {
      // console.log(
      //   chalk.greenBright(`Component ${path} found in file: ${filePath}`)
      // );
      return true;
    }
    return false;
  });
}

function dealWithRoutePath(_path, exts) {
  if (_path && exts.some((ext) => _path.endsWith(`index${ext}`))) {
    const extName = path.extname(_path);
    return [
      _path,
      _path.replace(new RegExp(`^(.+)\/(index${extName})$`), '$1'),
    ];
  }
  return [_path];
}

function handleResult(result, options) {
  const resultList = Object.entries(result);
  let tableConfig = {
    header: {
      alignment: 'center',
      content: chalk.yellowBright('Detect Result'),
    },
    spanningCells: [],
  };

  if (resultList.length) {
    if (resultList.length === 1) {
      resultList.push(['detect-file: ignore this line', []]);
    }
    let rowsLength = 0;
    const data = resultList.reduce((res, rows) => {
      const length = rows[1].length;
      if (length) {
        res.push([rows[0], rows[1][0]]);
        res = res.concat(rows[1].map((str) => ['', str]).slice(1));
        tableConfig.spanningCells.push({
          col: 0,
          row: rowsLength,
          rowSpan: length,
          verticalAlignment: 'middle',
        });
        rowsLength += length;
      } else {
        res.push([rows[0], '']);
        rowsLength++;
      }
      return res;
    }, []);
    if (options.pdf) {
      generatePDF(data);
    }
    console.log(table(data, tableConfig));
  } else {
    console.log(chalk.grey('no file detected!'));
  }
}

function generatePDF(data) {
  let doc = new PDFDocument({ margin: 30, size: 'A4' });
  doc.pipe(fs.createWriteStream('detect-result.pdf'));
  (async function createTable() {
    // table
    const table = {
      title: 'Detect Result',
      headers: ['target', 'result'],
      rows: data,
    };

    // the magic (async/await)
    await doc.table(table, {
      /* options */
    });
    // -- or --
    // doc.table(table).then(() => { doc.end() }).catch((err) => { })

    // if your run express.js server
    // to show PDF on navigator
    // doc.pipe(res);

    // done!
    doc.end();
  })();
}
