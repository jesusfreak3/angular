import {spawn} from 'child_process';
import {TscWatch, TSC, reportError} from './tsc_watch';
import {writeFileSync, mkdirSync, existsSync} from 'fs';
export * from './tsc_watch';
import 'reflect-metadata';

const OFFLINE_COMPILE = [
  'output/output_emitter_codegen_untyped',
  'output/output_emitter_codegen_typed',
  'offline_compiler_codegen_untyped',
  'offline_compiler_codegen_typed'
];

function processOutputEmitterCodeGen(): Promise<number> {
  return new Promise((resolve, reject) => {
           var outDir = 'dist/all/@angular/compiler/test/';
           var promises = [];
           console.log('Processing codegen...');
           OFFLINE_COMPILE.forEach((file: string) => {
             var codegen = require('../../all/@angular/compiler/test/' + file + '.js');
             if (codegen.emit) {
               console.log(`  ${file} has changed, regenerating...`);
               promises.push(Promise.resolve(codegen.emit())
                                 .then((code) => { writeFileSync(outDir + file + '.ts', code); }));
             }
           });
           if (promises.length) {
             Promise.all(promises)
                 .then(() => {
                   var args =
                       ['--project', 'tools/cjs-jasmine/tsconfig-output_emitter_codegen.json'];
                   console.log('    compiling changes: tsc ' + args.join(' '));
                   var tsc = spawn(TSC, args, {stdio: 'pipe'});
                   tsc.stdout.on('data', (data) => process.stdout.write(data));
                   tsc.stderr.on('data', (data) => process.stderr.write(data));
                   tsc.on('close',
                          (code) => code ? reject('Tsc exited with: ' + code) : resolve(code));
                 })
                 .catch(reportError);
           } else {
             resolve(0);
           }
         })
      .catch(reportError);
}

function md(dir: string, folders: string[]) {
  if (folders.length) {
    var next = folders.shift();
    var path = dir + '/' + next;
    if (!existsSync(path)) {
      mkdirSync(path);
    }
    md(path, folders);
  }
}

var tscWatch: TscWatch = null;
var platform = process.argv.length >= 3 ? process.argv[2] : null;
var runMode: string = process.argv.length >= 4 ? process.argv[3] : null;

if (platform == 'node') {
  tscWatch = new TscWatch({
    tsconfig: 'modules/tsconfig.json',
    start: 'File change detected. Starting incremental compilation...',
    error: 'error',
    complete: 'Compilation complete. Watching for file changes.',
    onChangeCmds: [
      processOutputEmitterCodeGen,
      [
        'node',
        'dist/tools/cjs-jasmine',
        '--',
        '{@angular,benchpress}/**/*_spec.js',
        '@angular/compiler_cli/test/**/*_spec.js'
      ]
    ]
  });
} else if (platform == 'browser') {
  tscWatch = new TscWatch({
    tsconfig: 'modules/tsconfig.json',
    start: 'File change detected. Starting incremental compilation...',
    error: 'error',
    complete: 'Compilation complete. Watching for file changes.',
    onStartCmds:
        [['node', 'node_modules/karma/bin/karma', 'start', '--no-auto-watch', 'karma-js.conf.js']],
    onChangeCmds: [['node', 'node_modules/karma/bin/karma', 'run', 'karma-js.conf.js']]
  });
} else if (platform == 'tools') {
  tscWatch = new TscWatch({
    tsconfig: 'tools/tsconfig.json',
    start: 'File change detected. Starting incremental compilation...',
    error: 'error',
    complete: 'Compilation complete. Watching for file changes.',
    onChangeCmds: [
      // TODO: fix and enable tests for public_api_spec again!
      // ['node', 'dist/tools/cjs-jasmine/index-tools', '--',
      // '{ts-metadata-collector,public_api_guard}/**/*{_,.}spec.js']
      ['node', 'dist/tools/cjs-jasmine/index-tools', '--', 'ts-metadata-collector/**/*{_,.}spec.js']
    ]
  });
}

if (runMode === 'watch') {
  tscWatch.watch();
} else if (runMode === 'triggerCmds') {
  tscWatch.triggerCmds();
} else {
  tscWatch.run();
}
